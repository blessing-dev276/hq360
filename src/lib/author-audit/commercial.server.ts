import { z } from "zod";
import { auditActor } from "./workflow-access.server";
import {
  clientDb,
  clientSession,
  privateJson,
  snapshotFor,
  throttle,
} from "./client-access.server";
import { workflowState, clientSnapshot, type WorkflowSnapshot } from "./workflow.server";
import {
  buildCommercialPlan,
  findingCommercialSchema,
  integrityIssues,
  proposalDraft,
  proposalSchema,
  validateProposalServices,
  unsafeClaims,
  type ProposalDraft,
} from "./commercial";
import { commercialConfigSchema, DEFAULT_COMMERCIAL_CONFIG } from "./services";

export async function loadCommercialConfig() {
  const { data, error } = await clientDb()
    .from("audit_commercial_config")
    .select("payload,updated_at")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error("Service settings unavailable. Apply the audit commercial migration.");
  return {
    config: data ? commercialConfigSchema.parse(data.payload) : DEFAULT_COMMERCIAL_CONFIG,
    revision: data?.updated_at ?? "default",
  };
}
const uuid = z.string().uuid();
const originOk = (request: Request) =>
  request.headers.get("origin") === new URL(request.url).origin;
const checked = <T extends { error: unknown }>(result: T) => {
  if (result.error) throw new Error("Could not save changes; refresh and retry.");
  return result;
};
export type SavedProposal = {
  draft: ProposalDraft;
  revision: number;
  status: "draft" | "approved" | "shared";
  audit_revision: number;
  config_revision: string;
  approved_at: string | null;
};
export async function commercialAdmin(request: Request, id: string) {
  if (!uuid.safeParse(id).success) return privateJson({ error: "Invalid audit" }, 400);
  const actor = await auditActor(request, id);
  if (!actor?.admin) return privateJson({ error: "Administrator access required" }, 403);
  if (request.method !== "GET" && !originOk(request))
    return privateJson({ error: "Invalid origin" }, 403);
  try {
    const db = clientDb();
    const state = await workflowState(id);
    const { config, revision: configRevision } = await loadCommercialConfig();
    const snapshot = clientSnapshot(state);
    const plan = buildCommercialPlan(snapshot.findings, config, snapshot.objective);
    const saved = checked(
      await db.from("audit_proposals").select("*").eq("audit_id", id).maybeSingle(),
    ).data as SavedProposal | null;
    if (request.method === "GET")
      return privateJson({
        config,
        configRevision,
        plan,
        findings: state.findings,
        proposal: saved,
        author: snapshot.author.name,
        book: snapshot.book.title,
        auditRevision: state.audit.workflow_revision,
      });
    const body = await request.json();
    const action = z
      .enum([
        "config",
        "objective",
        "match",
        "generate",
        "save",
        "approve",
        "share",
        "unshare",
        "annotate",
      ])
      .parse(body.action);
    if (action === "config") {
      const next = commercialConfigSchema.parse(body.config);
      if (unsafeClaims(JSON.stringify(next)))
        throw new Error("Remove unsupported commercial claims from service settings.");
      if (body.configRevision !== configRevision)
        return privateJson({ error: "Settings changed. Refresh before saving." }, 409);
      const values = { id: "default", payload: next, updated_at: new Date().toISOString() };
      const changed =
        configRevision === "default"
          ? await db.from("audit_commercial_config").insert(values).select("id").single()
          : await db
              .from("audit_commercial_config")
              .update(values)
              .eq("id", "default")
              .eq("updated_at", configRevision)
              .select("id")
              .single();
      checked(changed);
      return privateJson({ ok: true });
    }
    if (action === "annotate") {
      const finding = state.findings.find((f) => f.id === body.findingId);
      if (!finding) throw new Error("Finding not found in this audit.");
      const commercial = findingCommercialSchema.parse(body.commercial);
      const issues = integrityIssues({ ...finding, commercial });
      if (issues.length) throw new Error(issues.join("; "));
      checked(
        await db
          .from("audit_findings")
          .update({ commercial, review_status: "needs_verification", client_visible: false })
          .eq("id", finding.id)
          .eq("audit_id", id),
      );
      return privateJson({ ok: true });
    }
    if (action === "objective") {
      const objective = z.string().trim().max(2000).parse(body.objective);
      if (unsafeClaims(objective))
        throw new Error("Remove unsupported outcome guarantees from the objective.");
      checked(
        await db
          .from("author_audits")
          .update({
            input_snapshot: { ...state.audit.input_snapshot, objective },
            workflow_revision: state.audit.workflow_revision + 1,
          })
          .eq("id", id)
          .eq("workflow_revision", body.auditRevision)
          .select("id")
          .single(),
      );
      return privateJson({ ok: true });
    }
    if (action === "match") {
      checked(
        await db.rpc("audit_save_service_matches", {
          p_audit: id,
          p_revision: state.audit.workflow_revision,
          p_matches: plan.matches,
        }),
      );
      return privateJson({ ok: true, count: plan.matches.length });
    }
    if (action === "generate" || action === "save") {
      checked(
        await db.rpc("audit_save_service_matches", {
          p_audit: id,
          p_revision: state.audit.workflow_revision,
          p_matches: plan.matches,
        }),
      );
      const draft =
        action === "generate"
          ? proposalDraft(plan, snapshot.author.name, snapshot.book.title)
          : proposalSchema.parse(body.draft);
      validateProposalServices(draft, plan);
      if ((saved?.revision ?? 0) !== body.revision)
        return privateJson({ error: "Proposal changed. Refresh before saving." }, 409);
      const values = {
        audit_id: id,
        draft,
        revision: (saved?.revision ?? 0) + 1,
        audit_revision: state.audit.workflow_revision,
        config_revision: configRevision,
        status: "draft",
        approved_by: null,
        approved_at: null,
        shared_at: null,
        updated_at: new Date().toISOString(),
      };
      checked(
        saved
          ? await db
              .from("audit_proposals")
              .update(values)
              .eq("audit_id", id)
              .eq("revision", saved.revision)
              .select("audit_id")
              .single()
          : await db.from("audit_proposals").insert(values).select("audit_id").single(),
      );
      return privateJson({ ok: true });
    }
    if (!saved || saved.revision !== body.revision)
      return privateJson({ error: "Proposal changed. Refresh before continuing." }, 409);
    if (action !== "unshare") {
      if (
        saved.audit_revision !== state.audit.workflow_revision ||
        saved.config_revision !== configRevision
      )
        return privateJson(
          {
            error:
              "Evidence or service settings changed. Save a refreshed draft and approve it again.",
          },
          409,
        );
      validateProposalServices(proposalSchema.parse(saved.draft), plan);
    }
    if (action === "approve" && saved.status !== "draft")
      throw new Error("Only a saved draft can be approved.");
    if (action === "share" && saved.status !== "approved")
      return privateJson({ error: "An administrator must approve the draft before sharing." }, 409);
    const now = new Date().toISOString();
    checked(
      await db
        .from("audit_proposals")
        .update({
          status: action === "approve" ? "approved" : action === "share" ? "shared" : "draft",
          revision: saved.revision + 1,
          updated_at: now,
          ...(action === "approve" ? { approved_by: "admin", approved_at: now } : {}),
          ...(action === "share" ? { shared_at: now } : {}),
          ...(action === "unshare"
            ? { approved_by: null, approved_at: null, shared_at: null }
            : {}),
        })
        .eq("audit_id", id)
        .eq("revision", saved.revision)
        .eq("status", saved.status)
        .select("audit_id")
        .single(),
    );
    return privateJson({ ok: true });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof z.ZodError
            ? "Check the fields: " +
              error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : (error as Error).message,
      },
      422,
    );
  }
}
export async function clientCommercial(request: Request) {
  const access = await clientSession(request);
  if (!access) return privateJson({ error: "Please unlock your audit first." }, 401);
  try {
    const snapshot = (await snapshotFor(access)) as unknown as WorkflowSnapshot;
    if (snapshot.workflowVersion !== 1) return privateJson({ plan: null, proposal: null });
    const { config, revision } = await loadCommercialConfig();
    const plan = buildCommercialPlan(snapshot.findings, config, snapshot.objective ?? "");
    const saved = checked(
      await clientDb()
        .from("audit_proposals")
        .select("*")
        .eq("audit_id", access.audit_id)
        .eq("status", "shared")
        .maybeSingle(),
    ).data as SavedProposal | null;
    const live = checked(
      await clientDb()
        .from("author_audits")
        .select("workflow_revision")
        .eq("id", access.audit_id)
        .single(),
    ).data;
    let proposal: ProposalDraft | null = null;
    if (
      saved &&
      saved.approved_at &&
      saved.audit_revision === snapshot.revision &&
      saved.audit_revision === live?.workflow_revision &&
      saved.config_revision === revision
    ) {
      const parsed = proposalSchema.safeParse(saved.draft);
      if (
        parsed.success &&
        parsed.data.serviceIds.every((id) => plan.services.some((s) => s.id === id))
      )
        proposal = parsed.data;
    }
    return privateJson({ plan, proposal });
  } catch {
    return privateJson(
      { error: "Recommendations are temporarily unavailable. Your audit evidence is unchanged." },
      503,
    );
  }
}
export const auditInquirySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(320),
    serviceId: z.string().min(1).max(80),
    findingIds: z.array(uuid).min(1).max(50),
    message: z.string().trim().max(3000),
    consent: z.literal(true),
  })
  .strict();
export async function auditInquiry(request: Request) {
  if (!originOk(request)) return privateJson({ error: "Invalid origin" }, 403);
  const access = await clientSession(request);
  if (!access) return privateJson({ error: "Please unlock your audit first." }, 401);
  try {
    const body = auditInquirySchema.parse(await request.json());
    if (!(await throttle(`audit-inquiry:${access.audit_id}`, 5, 300)))
      return privateJson({ error: "Please wait a few minutes before submitting again." }, 429);
    const snapshot = (await snapshotFor(access)) as unknown as WorkflowSnapshot;
    if (!snapshot.ctaEnabled)
      return privateJson({ error: "Inquiries are not enabled for this audit." }, 403);
    const { config } = await loadCommercialConfig();
    const plan = buildCommercialPlan(snapshot.findings, config);
    const service = plan.services.find((s) => s.id === body.serviceId);
    if (!service || body.findingIds.some((id) => !service.matches.some((m) => m.finding_id === id)))
      return privateJson({ error: "Choose a current, evidence-supported recommendation." }, 400);
    // Use the existing inbox storage. No audit access code, evidence or private
    // report URL is sent to an external forwarding service.
    const result = checked(
      await clientDb()
        .from("project_inquiries")
        .insert({
          name: body.name,
          email: body.email.toLowerCase(),
          industry: "Authors & Publishing",
          help_with: [service.name],
          primary_goal: `Discuss ${service.name}`,
          message: `${body.message}\n\nAudit: ${access.audit_id}\nBook: ${snapshot.book.title}\nAuthor: ${snapshot.author.name}\nFindings: ${body.findingIds.join(", ")}\nConsent to reply recorded: ${new Date().toISOString()}`,
          source_path: "/author-audit",
          source_industry: "authors",
        })
        .select("id")
        .single(),
    );
    if (!result.data) throw new Error("Inquiry was not saved.");
    return privateJson({ ok: true, id: result.data.id }, 201);
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof z.ZodError
            ? "Enter your name, valid email and consent to a reply."
            : "Could not save your inquiry. Please retry.",
      },
      error instanceof z.ZodError ? 400 : 503,
    );
  }
}

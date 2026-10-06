import { z } from "zod";
import { randomUUID, randomBytes } from "node:crypto";
import { clientDb, privateJson } from "./client-access.server";
import { digest, normalizeCode, makeCode } from "./client-security";
import { auditActor } from "./workflow-access.server";
import {
  DEFAULT_PROMPT,
  findingInput,
  listopiaInput,
  actionInput,
  taskInput,
  safeUrl,
  promptFor,
  validateResearch,
  reviewIssues,
  label,
  type WorkflowState,
} from "./workflow";
const uuid = z.string().uuid();
const review = z.enum(["pending", "approved", "needs_changes", "rejected"]);
const manual = z.enum(["pending", "verified", "not_applicable"]);
const notes = z.string().max(6000);
const schemas = {
  finding: findingInput.extend({
    manual_status: manual,
    reviewer_notes: notes,
    featured: z.boolean(),
    hidden: z.boolean(),
    review_status: z.enum(["ai_research", "needs_verification", "approved", "rejected"]),
  }),
  section: z.object({
    key: z
      .string()
      .regex(/^[a-z0-9_-]+$/)
      .max(100),
    title: z.string().min(1).max(200),
    content: z.string().max(30000),
    enabled: z.boolean(),
    sort_order: z.number().int().min(0).max(500),
    review_status: review,
  }),
  listopia: listopiaInput.extend({
    manual_status: manual,
    review_status: review,
    reviewer_notes: notes,
  }),
  task: taskInput.extend({
    kind: z.enum(["screenshot", "manual"]),
    status: z.enum(["pending", "uploaded", "approved", "not_applicable"]),
    notes,
  }),
  action: actionInput.extend({
    review_status: review,
    finding_ids: z.array(uuid).max(100),
    sort_order: z.number().int().min(0).max(500),
  }),
  asset: z.object({
    finding_id: uuid.nullable(),
    listopia_id: uuid.nullable().default(null),
    task_id: uuid.nullable(),
    category: z.string().max(100),
    caption: z.string().max(1000),
    proves: z.string().max(3000),
    source: safeUrl.or(z.literal("")),
    asset_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
    review_status: review,
    display_kind: z.enum(["before", "current", "recommended"]),
    sort_order: z.number().int().min(0).max(500),
  }),
};
const tables = {
  finding: "audit_findings",
  section: "audit_sections",
  listopia: "audit_listopia",
  task: "audit_review_tasks",
  action: "audit_action_plan",
  asset: "audit_evidence_assets",
} as const;
export async function workflowState(id: string) {
  const db = clientDb();
  const audit = await db
    .from("author_audits")
    .select("*,authors(name),books(title)")
    .eq("id", id)
    .single();
  if (audit.error) throw new Error("Audit not found");
  const names = [
    "audit_findings",
    "audit_sections",
    "audit_listopia",
    "audit_review_tasks",
    "audit_evidence_assets",
    "audit_action_plan",
    "audit_research_imports",
    "audit_activity",
    "audit_client_versions",
    "audit_assignments",
  ];
  const results = await Promise.all(
    names.map((table) =>
      db
        .from(table)
        .select(
          table === "audit_research_imports"
            ? "id,created_at,source"
            : table === "audit_client_versions"
              ? "id,version_number,created_at,published_at,change_notes,qa_confirmed"
              : "*",
        )
        .eq("audit_id", id)
        .returns<Record<string, unknown>[]>(),
    ),
  );
  if (results.some((r) => r.error)) throw new Error("Audit workflow storage unavailable");
  const [access, template, sources] = await Promise.all([
    db
      .from("audit_client_access")
      .select("public_slug,access_enabled,view_count,last_viewed_at,expires_at")
      .eq("audit_id", id)
      .maybeSingle(),
    db.from("audit_prompt_templates").select("template").eq("id", "default").maybeSingle(),
    db
      .from("audit_sources")
      .select("id,url,provider,retrieved_at,raw_data")
      .eq("audit_id", id)
      .eq("source_type", "ai_web_research")
      .order("retrieved_at", { ascending: false })
      .limit(100),
  ]);
  if (access.error || template.error || sources.error) throw new Error("Audit storage unavailable");
  return {
    audit: audit.data,
    findings: (results[0]!.data ?? []).map((f) => ({
      ...f,
      what_we_found: f.observation,
      evidence: f.evidence_text,
      service_match: f.capability_slug ?? "",
    })),
    sections: results[1]!.data ?? [],
    listopia: results[2]!.data ?? [],
    tasks: results[3]!.data ?? [],
    assets: results[4]!.data ?? [],
    actions: results[5]!.data ?? [],
    imports: results[6]!.data ?? [],
    sources: sources.data ?? [],
    history: results[7]!.data ?? [],
    versions: results[8]!.data ?? [],
    assignments: results[9]!.data ?? [],
    access: access.data,
    template: template.data?.template ?? DEFAULT_PROMPT,
  } as unknown as Omit<WorkflowState, "permissions" | "experts"> & {
    audit: WorkflowState["audit"] & { workflow_revision: number };
  };
}
async function activity(id: string, actor: string, action: string, target?: string) {
  const r = await clientDb()
    .from("audit_activity")
    .insert({ audit_id: id, actor, action, target_id: target ?? null });
  if (r.error) throw new Error("Could not record audit history");
}
function assertOk(r: { error: unknown }) {
  if (r.error) throw new Error("Could not save audit changes");
}
async function setStatus(table: string, auditId: string, ids: string[], values: object) {
  if (ids.length)
    assertOk(await clientDb().from(table).update(values).eq("audit_id", auditId).in("id", ids));
}
/** Validate imported research automatically -- no manual verification step.
 *  A finding is accepted when it carries a recommendation and cited evidence
 *  (AI web research has already checked every citation against the sources it
 *  collected); anything else is rejected. Screenshot and manual-check
 *  requests are closed rather than left for a person. */
export async function autoValidate(id: string, actor: string) {
  const state = await workflowState(id);
  const pick = <T extends { id: string }>(rows: T[], test: (row: T) => boolean) => [
    rows.filter(test).map((r) => r.id),
    rows.filter((r) => !test(r)).map((r) => r.id),
  ];
  const open = state.findings.filter((f) => !f.hidden && f.review_status !== "rejected");
  const [goodFindings, badFindings] = pick(
    open,
    (f) => !!f.recommendation?.trim() && (f.source_urls.length > 0 || !!f.evidence_text?.trim()),
  );
  await setStatus("audit_findings", id, goodFindings!, {
    review_status: "approved",
    manual_status: "verified",
    client_visible: true,
  });
  await setStatus("audit_findings", id, badFindings!, {
    review_status: "rejected",
    client_visible: false,
  });
  await setStatus(
    "audit_sections",
    id,
    state.sections.filter((s) => s.enabled && s.review_status !== "approved").map((s) => s.id),
    { review_status: "approved" },
  );
  const [goodLists, badLists] = pick(
    state.listopia.filter((l) => l.review_status !== "rejected"),
    (l) => !!l.list_name?.trim() && !!l.list_url,
  );
  await setStatus("audit_listopia", id, goodLists!, {
    review_status: "approved",
    manual_status: "verified",
  });
  await setStatus("audit_listopia", id, badLists!, { review_status: "rejected" });
  const approved = new Set([
    ...goodFindings!,
    ...state.findings.filter((f) => f.review_status === "approved" && !f.hidden).map((f) => f.id),
  ]);
  const [goodActions, badActions] = pick(
    state.actions.filter((a) => a.review_status !== "rejected"),
    (a) => a.finding_ids.every((f) => approved.has(f)),
  );
  await setStatus("audit_action_plan", id, goodActions!, { review_status: "approved" });
  await setStatus("audit_action_plan", id, badActions!, { review_status: "rejected" });
  const [goodAssets, badAssets] = pick(
    state.assets.filter((a) => a.review_status === "pending"),
    (a) => !!(a.caption && a.proves && a.source && a.asset_date),
  );
  await setStatus("audit_evidence_assets", id, goodAssets!, {
    review_status: "approved",
    client_visible: true,
  });
  await setStatus("audit_evidence_assets", id, badAssets!, { review_status: "rejected" });
  const withImage = new Set(state.assets.filter((a) => a.task_id).map((a) => a.task_id));
  const [doneTasks, closedTasks] = pick(
    state.tasks.filter((t) => !["approved", "not_applicable"].includes(t.status)),
    (t) => t.kind === "screenshot" && withImage.has(t.id),
  );
  await setStatus("audit_review_tasks", id, doneTasks!, { status: "approved" });
  await setStatus("audit_review_tasks", id, closedTasks!, { status: "not_applicable" });
  await activity(id, actor, "auto_validated");
  const remaining = reviewIssues(await workflowState(id));
  if (!remaining.length)
    assertOk(
      await clientDb()
        .from("author_audits")
        .update({ status: "approved", review_status: "complete" })
        .eq("id", id),
    );
  return {
    accepted: goodFindings!.length,
    rejected: badFindings!.length,
    counts: {
      findings: goodFindings!.length,
      sections: state.sections.filter((s) => s.enabled && s.review_status !== "approved").length,
      listopia: goodLists!.length,
      actions: goodActions!.length,
      screenshots: goodAssets!.length,
      checks: doneTasks!.length + closedTasks!.length,
    },
    remaining,
  };
}
function hostOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
export function clientSnapshot(state: Awaited<ReturnType<typeof workflowState>>) {
  const sections = state.sections
    .filter(
      (s) =>
        s.enabled &&
        s.review_status === "approved" &&
        ![
          "services_not_to_pitch",
          "manual_review_queue",
          "screenshot_queue",
          "client_site",
          "evidence_library",
        ].includes(s.key),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ key, title, content, sort_order }) => ({ key, title, content, sort_order }));
  const keys = new Set(sections.map((s) => s.key));
  const findings = state.findings
    .filter((f) => f.review_status === "approved" && !f.hidden && keys.has(f.category))
    .map((f) => ({
      id: f.id,
      title: f.title,
      category: f.category,
      classification: f.classification,
      what_we_checked: f.what_we_checked,
      what_we_found: f.what_we_found,
      evidence: f.evidence,
      source_urls: f.source_urls,
      interpretation: f.interpretation,
      why_it_matters: f.why_it_matters,
      recommendation: f.recommendation,
      implementation_steps: f.implementation_steps,
      priority: f.priority,
      featured: f.featured,
    }));
  const ids = new Set(findings.map((f) => f.id));
  const assets = state.assets
    .filter((a) => a.review_status === "approved" && (!a.finding_id || ids.has(a.finding_id)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({
      id: a.id,
      finding_id: a.finding_id,
      listopia_id: a.listopia_id,
      category: a.category,
      caption: a.caption,
      proves: a.proves,
      source: a.source,
      asset_date: a.asset_date,
      display_kind: a.display_kind,
      storage_path: a.storage_path,
    }));
  const listopia = state.listopia
    .filter((l) => l.review_status === "approved" && keys.has("goodreads_listopia_audit"))
    .map(
      ({
        id,
        list_name,
        list_url,
        book_present,
        position,
        page,
        votes,
        number_of_books,
        competition,
        relevance_score,
        books_above,
        books_below,
        why_position,
        how_to_improve,
        evidence,
      }) => ({
        id,
        list_name,
        list_url,
        book_present,
        position,
        page,
        votes,
        number_of_books,
        competition,
        relevance_score,
        books_above,
        books_below,
        why_position,
        how_to_improve,
        evidence,
      }),
    );
  const actions = state.actions
    .filter(
      (a) =>
        a.review_status === "approved" &&
        keys.has("priority_action_plan") &&
        a.finding_ids.every((id) => ids.has(id)),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ id, title, description, horizon, service }) => ({
      id,
      title,
      description,
      horizon,
      service,
    }));
  const urls = [
    ...new Set([
      ...findings.flatMap((f) => f.source_urls),
      ...listopia.map((l) => l.list_url).filter(Boolean),
      ...assets.map((a) => a.source).filter(Boolean),
    ]),
  ];
  return {
    workflowVersion: 1 as const,
    revision: state.audit.workflow_revision,
    reviewIssues: reviewIssues(state),
    author: { name: state.audit.authors.name },
    book: { title: state.audit.books.title },
    preparedDate: state.audit.input_snapshot.researchDate || new Date().toISOString().slice(0, 10),
    sections,
    findings,
    assets,
    listopia,
    actions,
    ctaEnabled: state.audit.cta_enabled,
    metrics: {
      sources: urls.length,
      // Screenshot sources are free text ("Amazon"), so only real URLs count.
      platforms: new Set(urls.map(hostOf).filter(Boolean)).size,
      findings: findings.length,
      screenshots: assets.length,
      actions: actions.length,
    },
  };
}
export type WorkflowSnapshot = ReturnType<typeof clientSnapshot>;
export async function workflowGet(request: Request, id: string) {
  if (!uuid.safeParse(id).success) return privateJson({ error: "Invalid audit" }, 400);
  const actor = await auditActor(request, id);
  if (!actor) return privateJson({ error: "Unauthorized" }, 403);
  try {
    const db = clientDb(),
      url = new URL(request.url),
      asset = url.searchParams.get("asset"),
      version = url.searchParams.get("version"),
      original = url.searchParams.get("import");
    if (asset) {
      let path: string | undefined;
      if (version) {
        const { data: v } = await db
          .from("audit_client_versions")
          .select("snapshot")
          .eq("audit_id", id)
          .eq("id", version)
          .single();
        path = (v?.snapshot as WorkflowSnapshot | undefined)?.assets.find(
          (a) => a.id === asset,
        )?.storage_path;
      } else {
        const { data: a } = await db
          .from("audit_evidence_assets")
          .select("storage_path")
          .eq("audit_id", id)
          .eq("id", asset)
          .single();
        path = a?.storage_path;
      }
      if (!path) return privateJson({ error: "Image unavailable" }, 404);
      const file = await db.storage.from("audit-research-evidence").download(path);
      if (file.error || !file.data) return privateJson({ error: "Image unavailable" }, 404);
      return new Response(file.data, {
        headers: {
          "Content-Type": file.data.type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (version) {
      const r = await db
        .from("audit_client_versions")
        .select("snapshot")
        .eq("audit_id", id)
        .eq("id", version)
        .single();
      if (r.error) return privateJson({ error: "Version unavailable" }, 404);
      return privateJson({ snapshot: r.data.snapshot });
    }
    if (original) {
      const r = await db
        .from("audit_research_imports")
        .select("raw_text")
        .eq("audit_id", id)
        .eq("id", original)
        .single();
      if (r.error) return privateJson({ error: "Import unavailable" }, 404);
      return new Response(r.data.raw_text, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="original-research.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    const state = await workflowState(id);
    const experts = actor.admin
      ? await db.from("expert_profiles").select("id,full_name").eq("status", "approved")
      : { data: [] };
    return privateJson({
      ...state,
      permissions: { admin: actor.admin, review: actor.review },
      experts: experts.data ?? [],
      issues: reviewIssues(state),
    });
  } catch (e) {
    return privateJson({ error: (e as Error).message }, 503);
  }
}
export async function workflowPost(request: Request, id: string) {
  if (!uuid.safeParse(id).success) return privateJson({ error: "Invalid audit" }, 400);
  const actor = await auditActor(request, id);
  if (!actor) return privateJson({ error: "Unauthorized" }, 403);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return privateJson({ error: "Invalid origin" }, 403);
  try {
    const db = clientDb();
    const state = await workflowState(id);
    if (state.audit.workflow_version !== 1)
      return privateJson({ error: "Use the existing workspace for legacy audits" }, 409);
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await request.formData(),
        file = form.get("file");
      if (!(file instanceof File) || file.size > 8388608 || file.size < 12)
        throw new Error("Upload a PNG, JPEG or WebP image up to 8 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind =
        bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
          ? "image/png"
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            ? "image/jpeg"
            : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
                new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
              ? "image/webp"
              : null;
      if (!kind || kind !== file.type)
        throw new Error("File contents do not match an allowed image type");
      const taskId = String(form.get("taskId") ?? "") || null,
        findingId = String(form.get("findingId") ?? "") || null;
      if (taskId && !state.tasks.some((t) => t.id === taskId))
        throw new Error("Invalid screenshot request");
      if (findingId && !state.findings.some((f) => f.id === findingId))
        throw new Error("Invalid finding");
      const path = `${id}/${randomUUID()}.${kind.split("/")[1]}`;
      const upload = await db.storage
        .from("audit-research-evidence")
        .upload(path, bytes, { contentType: kind });
      assertOk(upload);
      const added = await db
        .from("audit_evidence_assets")
        .insert({
          audit_id: id,
          storage_url: "",
          storage_path: path,
          original_filename: file.name.slice(0, 200),
          uploaded_by: actor.id,
          category:
            state.tasks.find((t) => t.id === taskId)?.category ??
            state.findings.find((f) => f.id === findingId)?.category ??
            "general",
          task_id: taskId,
          finding_id: findingId,
          review_status: "pending",
          client_visible: false,
        })
        .select("id")
        .single();
      if (added.error) {
        await db.storage.from("audit-research-evidence").remove([path]);
        throw new Error("Could not attach screenshot");
      }
      if (taskId)
        assertOk(
          await db
            .from("audit_review_tasks")
            .update({ status: "uploaded" })
            .eq("id", taskId)
            .eq("audit_id", id),
        );
      await activity(id, actor.id, "screenshot_uploaded", added.data.id);
      return privateJson({ ok: true });
    }
    const body = await request.json();
    const action = z.string().parse(body.action);
    if (action === "ai_search") {
      const focus = z
        .string()
        .trim()
        .max(200)
        .parse(body.focus ?? "");
      const { generateWebResearch } = await import("./workflow-ai-search.server");
      const result = await generateWebResearch(state, focus);
      if (!result.validated.valid)
        return privateJson(
          {
            ok: false,
            raw: result.raw,
            sources: result.sources,
            failures: result.failures,
            errors: result.validated.errors,
          },
          422,
        );
      const imported = await db.rpc("audit_import_research", {
        p_audit: id,
        p_actor: actor.id,
        p_source: "Claude",
        p_raw: result.raw,
        p_data: result.validated.data,
      });
      if (imported.error)
        throw new Error("AI research could not be saved. Refresh this audit and retry.");
      const archived = await db.from("audit_sources").insert(
        result.sources.map((source) => ({
          audit_id: id,
          provider: source.provider,
          source_type: "ai_web_research",
          url: source.url,
          retrieved_at: source.retrievedAt,
          status: "retrieved",
          raw_data: { query: source.query, title: source.title, excerpt: source.excerpt },
        })),
      );
      if (archived.error) {
        console.error("Could not archive AI research search sources", archived.error.message);
      }
      await activity(id, actor.id, "ai_web_research_imported");
      const validation = await autoValidate(id, actor.id);
      return privateJson({
        ok: true,
        imported: true,
        validation,
        sources: result.sources,
        failures: result.failures,
        findings: result.validated.data.findings.length,
        droppedFindings: result.droppedFindings,
        skippedDuplicates: result.skippedDuplicates,
      });
    }
    if (action === "prompt" || action === "template") {
      if (action === "template") {
        if (!actor.admin) return privateJson({ error: "Admin only" }, 403);
        const template = z.string().min(100).max(50000).parse(body.template);
        for (const token of ["audit_id", "author_name", "book_title", "date", "context", "schema"])
          if (!template.includes(`{{${token}}}`))
            throw new Error(`Template must include {{${token}}}`);
        assertOk(
          await db.from("audit_prompt_templates").upsert({
            id: "default",
            template,
            updated_by: actor.id,
            updated_at: new Date().toISOString(),
          }),
        );
        await activity(id, actor.id, "prompt_template_updated");
        return privateJson({ ok: true });
      }
      const source = z.enum(["Claude", "ChatGPT", "Gemini", "Other"]).parse(body.source);
      const prompt = promptFor(state.template, state.audit);
      assertOk(
        await db
          .from("author_audits")
          .update({
            generated_prompt: prompt,
            research_source: source,
            ...(!state.imports.length ? { status: "research_ready" } : {}),
          })
          .eq("id", id),
      );
      await activity(id, actor.id, "research_prompt_generated");
      return privateJson({ ok: true, prompt });
    }
    if (action === "validate" || action === "import") {
      const raw = z.string().max(2000000).parse(body.raw);
      const result = validateResearch(
        raw,
        { id, author: state.audit.authors.name, book: state.audit.books.title },
        state.findings,
      );
      if (!result.valid || action === "validate")
        return privateJson(result, result.valid ? 200 : 422);
      const source = z.enum(["Claude", "ChatGPT", "Gemini", "Other"]).parse(body.source);
      const r = await db.rpc("audit_import_research", {
        p_audit: id,
        p_actor: actor.id,
        p_source: source,
        p_raw: raw,
        p_data: result.data,
      });
      if (r.error) throw new Error("Import could not be saved. It may already have been imported.");
      return privateJson({ ok: true, validation: await autoValidate(id, actor.id) });
    }
    if (action === "save" || action === "delete" || action === "duplicate") {
      const entity = z
        .enum(["finding", "section", "listopia", "task", "action", "asset"])
        .parse(body.entity);
      const target = body.id ? uuid.parse(body.id) : undefined;
      if (
        entity === "task" &&
        !actor.review &&
        (action === "delete" || body.values?.required === false)
      )
        return privateJson({ error: "A reviewer must remove or waive review tasks" }, 403);
      if (action === "delete") {
        if (!target) throw new Error("Choose a record");
        assertOk(await db.from(tables[entity]).delete().eq("audit_id", id).eq("id", target));
        await activity(id, actor.id, `${entity}_deleted`, target);
        return privateJson({ ok: true });
      }
      if (action === "duplicate") {
        if (entity !== "finding" || !target) throw new Error("Choose a finding");
        const f = state.findings.find((f) => f.id === target);
        if (!f) throw new Error("Finding unavailable");
        body.values = {
          ...f,
          title: `${f.title} (copy)`,
          review_status: "ai_research",
          manual_status: "pending",
        };
        body.id = undefined;
      }
      const patch = schemas[entity].strip().parse(body.values) as Record<string, unknown>;
      if (
        entity === "section" &&
        body.id &&
        state.sections.find((s) => s.id === body.id)?.key !== patch.key
      )
        throw new Error("Section keys are fixed; edit the section name instead");
      if (
        !actor.review &&
        (["approved", "rejected"].includes(String(patch.review_status)) ||
          ["verified", "not_applicable"].includes(String(patch.manual_status)) ||
          ["approved", "not_applicable"].includes(String(patch.status)))
      )
        return privateJson({ error: "A reviewer must approve and verify this item" }, 403);
      if (
        entity === "action" &&
        (patch.finding_ids as string[]).some((ref) => !state.findings.some((f) => f.id === ref))
      )
        throw new Error("Action references a finding outside this audit");
      if (entity === "listopia" || entity === "action") {
        const key = entity === "listopia" ? "goodreads_listopia_audit" : "priority_action_plan";
        if (!state.sections.some((s) => s.key === key))
          assertOk(
            await db
              .from("audit_sections")
              .insert({ audit_id: id, key, title: label(key), sort_order: state.sections.length }),
          );
      }
      if (entity === "task" && patch.status === "not_applicable" && !String(patch.notes).trim())
        throw new Error("Explain why this check is not applicable in reviewer notes");
      if (entity === "asset") {
        if (patch.listopia_id && !state.listopia.some((l) => l.id === patch.listopia_id))
          throw new Error("Invalid Listopia list");
        if (patch.finding_id && !state.findings.some((f) => f.id === patch.finding_id))
          throw new Error("Invalid finding");
        if (patch.task_id && !state.tasks.some((t) => t.id === patch.task_id))
          throw new Error("Invalid screenshot request");
        patch.asset_date = patch.asset_date || null;
        patch.client_visible = patch.review_status === "approved";
      }
      if (entity === "finding") {
        patch.section = patch.category;
        patch.observation = patch.what_we_found;
        patch.evidence_text = patch.evidence;
        patch.capability_slug = patch.service_match || null;
        patch.client_visible = patch.review_status === "approved" && !patch.hidden;
        delete patch.what_we_found;
        delete patch.evidence;
        delete patch.service_match;
        if (!state.sections.some((s) => s.key === patch.category))
          assertOk(
            await db.from("audit_sections").insert({
              audit_id: id,
              key: patch.category,
              title: label(String(patch.category)),
              sort_order: state.sections.length,
            }),
          );
        if (!body.id) {
          patch.origin = "manual";
          patch.status = "opportunity_identified";
        }
      }
      if (patch.review_status === "approved" && body.approve !== true)
        throw new Error("Use the Approve action after reviewing this item");
      const result = body.id
        ? await db
            .from(tables[entity])
            .update(patch)
            .eq("audit_id", id)
            .eq("id", body.id)
            .select("id")
            .single()
        : await db
            .from(tables[entity])
            .insert({ ...patch, audit_id: id })
            .select("id")
            .single();
      assertOk(result);
      if (entity === "asset" && patch.task_id && patch.review_status === "approved")
        assertOk(
          await db
            .from("audit_review_tasks")
            .update({ status: "approved" })
            .eq("audit_id", id)
            .eq("id", patch.task_id),
        );
      await activity(
        id,
        actor.id,
        `${entity}_${patch.review_status === "approved" ? "approved" : "edited"}`,
        result.data?.id,
      );
      return privateJson({ ok: true });
    }
    if (action === "reorder") {
      const ids = z.array(uuid).max(500).parse(body.ids);
      assertOk(await db.rpc("audit_reorder_sections", { p_audit: id, p_ids: ids }));
      await activity(id, actor.id, "sections_reordered");
      return privateJson({ ok: true });
    }
    if (action === "assign") {
      if (!actor.admin) return privateJson({ error: "Admin only" }, 403);
      const expertId = uuid.parse(body.expertId);
      if (body.remove)
        assertOk(
          await db.from("audit_assignments").delete().eq("audit_id", id).eq("expert_id", expertId),
        );
      else
        assertOk(
          await db.from("audit_assignments").upsert({
            audit_id: id,
            expert_id: expertId,
            role: z.enum(["expert", "reviewer"]).parse(body.role),
          }),
        );
      await activity(id, actor.id, "assignment_updated", expertId);
      return privateJson({ ok: true });
    }
    if (action === "approve_all") {
      if (!actor.review) return privateJson({ error: "Reviewer required" }, 403);
      return privateJson({ ok: true, ...(await autoValidate(id, actor.id)) });
    }
    if (action === "approve") {
      if (!actor.review) return privateJson({ error: "Reviewer required" }, 403);
      const issues = reviewIssues(state);
      if (issues.length) return privateJson({ error: "Complete review first", issues }, 409);
      assertOk(
        await db
          .from("author_audits")
          .update({ status: "approved", review_status: "complete" })
          .eq("id", id),
      );
      await activity(id, actor.id, "audit_approved");
      return privateJson({ ok: true });
    }
    if (action === "generate") {
      if (!actor.review) return privateJson({ error: "Reviewer required" }, 403);
      const snapshot = clientSnapshot(state);
      const r = await db.rpc("audit_create_reviewed_version", {
        p_audit: id,
        p_revision: state.audit.workflow_revision,
        p_snapshot: snapshot,
        p_actor: actor.id,
        p_notes: z
          .string()
          .max(3000)
          .parse(body.notes ?? ""),
      });
      if (r.error) {
        console.error("[audit] generate", r.error.message);
        throw new Error(
          /Audit changed/.test(r.error.message)
            ? "Audit changed while generating. Refresh and try again."
            : `Could not generate the client site: ${r.error.message}`,
        );
      }
      return privateJson({ ok: true, versionId: r.data });
    }
    if (action === "qa") {
      if (!actor.review) return privateJson({ error: "Reviewer required" }, 403);
      const versionId = uuid.parse(body.versionId);
      const r = await db
        .from("audit_client_versions")
        .update({ qa_confirmed: true })
        .eq("id", versionId)
        .eq("audit_id", id)
        .is("published_at", null)
        .select("id")
        .single();
      assertOk(r);
      assertOk(await db.from("author_audits").update({ status: "qa_review" }).eq("id", id));
      await activity(id, actor.id, "final_qa_completed", versionId);
      return privateJson({ ok: true });
    }
    async function publishVersion(versionId: string, override: string) {
      const issues = reviewIssues(await workflowState(id));
      if (issues.length && override.trim().length < 10)
        return privateJson({ error: "Required review items remain incomplete", issues }, 409);
      const existing = await db
        .from("audit_client_access")
        .select("public_slug,code_hash")
        .eq("audit_id", id)
        .maybeSingle();
      assertOk(existing);
      const code = existing.data?.code_hash ? null : makeCode(state.audit.authors.name);
      const slug = (v: string) =>
        v
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "audit";
      const publicSlug =
        existing.data?.public_slug ??
        `${slug(state.audit.authors.name)}/${slug(state.audit.books.title)}-${randomBytes(4).toString("hex")}`;
      const r = await db.rpc("audit_publish_reviewed", {
        p_audit: id,
        p_version: versionId,
        p_slug: publicSlug,
        p_hash: code ? digest(normalizeCode(code)) : null,
        p_actor: actor!.id,
        p_override: override,
      });
      if (r.error)
        throw new Error(
          /Generate current draft/.test(r.error.message)
            ? "This version is out of date or hasn't passed final QA. Use “Publish audit website” to publish the latest version in one step."
            : `Could not publish: ${r.error.message}`,
        );
      return privateJson({ ok: true, code, path: `/author-audit/${publicSlug}` });
    }
    // Admins and any expert on the audit can publish and manage client access.
    if (!actor.review)
      return privateJson({ error: "Only people on this audit can publish it" }, 403);
    if (action === "publish_now") {
      // One click: validate, generate a fresh version, confirm QA and publish.
      let current = state;
      if (reviewIssues(current).length) {
        await autoValidate(id, actor.id);
        current = await workflowState(id);
      }
      const remaining = reviewIssues(current);
      if (remaining.length)
        return privateJson(
          { error: "Some items still need attention before publishing", issues: remaining },
          409,
        );
      const created = await db.rpc("audit_create_reviewed_version", {
        p_audit: id,
        p_revision: current.audit.workflow_revision,
        p_snapshot: clientSnapshot(current),
        p_actor: actor.id,
        p_notes: "Published in one step",
      });
      if (created.error) throw new Error(`Could not generate the site: ${created.error.message}`);
      const versionId = created.data as string;
      assertOk(
        await db
          .from("audit_client_versions")
          .update({ qa_confirmed: true })
          .eq("id", versionId)
          .eq("audit_id", id),
      );
      await activity(id, actor.id, "final_qa_completed", versionId);
      return publishVersion(versionId, "");
    }
    if (action === "publish")
      return publishVersion(
        uuid.parse(body.versionId),
        z
          .string()
          .max(3000)
          .parse(body.override ?? ""),
      );

    if (["regenerate", "revoke", "disable", "expiry"].includes(action)) {
      const patch: Record<string, unknown> = { generation: randomUUID() };
      let code: string | null = null;
      if (action === "regenerate") {
        code = makeCode("AUTHOR");
        patch.code_hash = digest(normalizeCode(code));
      }
      if (action === "revoke" || action === "disable") {
        patch.access_enabled = false;
        if (action === "revoke") {
          patch.revoked_at = new Date().toISOString();
          patch.code_hash = null;
        }
      }
      if (action === "expiry")
        patch.expires_at = z.string().datetime().nullable().parse(body.expiresAt);
      assertOk(
        await db
          .from("audit_client_access")
          .update(patch)
          .eq("audit_id", id)
          .select("audit_id")
          .single(),
      );
      await activity(id, actor.id, `access_${action}`);
      return privateJson({ ok: true, code });
    }
    if (action === "settings") {
      assertOk(
        await db
          .from("author_audits")
          .update({
            cta_enabled: z.boolean().parse(body.ctaEnabled),
            workflow_revision: state.audit.workflow_revision + 1,
            publish_status: "not_ready",
            status: body.archived ? "archived" : "under_review",
          })
          .eq("id", id)
          .eq("workflow_revision", state.audit.workflow_revision)
          .select("id")
          .single(),
      );
      await activity(id, actor.id, "settings_updated");
      return privateJson({ ok: true });
    }
    throw new Error("Unknown audit action");
  } catch (e) {
    return privateJson(
      {
        error:
          e instanceof z.ZodError
            ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")
            : (e as Error).message,
      },
      400,
    );
  }
}

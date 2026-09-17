import { createFileRoute } from "@tanstack/react-router";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { clientDb, privateJson } from "@/lib/author-audit/client-access.server";
import {
  digest,
  makeCode,
  normalizeCode,
  sameOrigin,
  stableJson,
} from "@/lib/author-audit/client-security";
import { buildReportData } from "@/lib/author-audit/report-data";
import { runQualityCheck } from "@/lib/author-audit/quality-check";

const schema = z.object({
  action: z.enum(["draft", "publish", "revoke", "disable", "regenerate", "expiry"]),
  versionId: z.string().uuid().optional(),
  qaConfirmed: z.literal(true).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "author";
export const Route = createFileRoute("/api/admin/author-audits/$id/publishing")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request))) return privateJson({ error: "Unauthorized" }, 401);
        try {
          const db = clientDb();
          const url = new URL(request.url);
          const versionId = url.searchParams.get("version");
          if (versionId) {
            const { data: version, error } = await db
              .from("audit_client_versions")
              .select("snapshot")
              .eq("id", versionId)
              .eq("audit_id", params.id)
              .single();
            if (error || !version) return privateJson({ error: "Version unavailable" }, 404);
            const image = url.searchParams.get("format") === "image";
            const bytes = image
              ? await (
                  await import("@/lib/author-audit/image-report")
                ).renderAuditImage(version.snapshot)
              : await (
                  await import("@/lib/author-audit/pdf-report")
                ).renderAuditPdf(version.snapshot);
            return new Response(new Uint8Array(bytes), {
              headers: {
                "content-type": image ? "image/png" : "application/pdf",
                "content-disposition": `inline; filename="HQ360-audit.${image ? "png" : "pdf"}"`,
                "cache-control": "private, no-store",
                "x-robots-tag": "noindex, nofollow",
              },
            });
          }
          const [access, versions, interest, events, quality] = await Promise.all([
            db
              .from("audit_client_access")
              .select(
                "audit_id,public_slug,version_id,published_at,expires_at,revoked_at,access_enabled,view_count,first_viewed_at,last_viewed_at",
              )
              .eq("audit_id", params.id)
              .maybeSingle(),
            db
              .from("audit_client_versions")
              .select("id,created_at,published_at,snapshot,qa_confirmed")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: false }),
            db
              .from("audit_client_interest")
              .select("*")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: false }),
            db
              .from("audit_client_events")
              .select("event,target,created_at")
              .eq("audit_id", params.id)
              .order("created_at", { ascending: false })
              .limit(100),
            runQualityCheck(db, params.id),
          ]);
          if ([access, versions, interest, events].some((r) => r.error))
            throw new Error(
              "Private audit storage is unavailable. Apply the private-client-audits migration.",
            );
          return privateJson({
            access: access.data,
            versions: versions.data,
            interest: interest.data,
            events: events.data,
            quality,
          });
        } catch (e) {
          return privateJson({ error: e instanceof Error ? e.message : "Unavailable" }, 503);
        }
      },
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request))) return privateJson({ error: "Unauthorized" }, 401);
        if (!sameOrigin(request)) return privateJson({ error: "Forbidden" }, 403);
        try {
          const body = schema.parse(await request.json());
          const db = clientDb();
          if (body.action === "draft") {
            const snapshot = await buildReportData(db, params.id);
            if ("error" in snapshot) return privateJson(snapshot, 409);
            const { data, error } = await db
              .from("audit_client_versions")
              .insert({ audit_id: params.id, snapshot })
              .select("id")
              .single();
            if (error) throw error;
            return privateJson({ ok: true, versionId: data.id });
          }
          if (body.action === "publish") {
            if (!body.qaConfirmed || !body.versionId)
              return privateJson(
                { error: "Review the version and complete the QA checklist first." },
                409,
              );
            const quality = await runQualityCheck(db, params.id);
            if (!quality.passed)
              return privateJson({ error: "Quality check failed", issues: quality.issues }, 409);
            const { data: version, error: versionError } = await db
              .from("audit_client_versions")
              .select("*")
              .eq("id", body.versionId)
              .eq("audit_id", params.id)
              .is("published_at", null)
              .single();
            if (versionError || !version)
              return privateJson({ error: "Create and review a new version first." }, 409);
            const current = await buildReportData(db, params.id);
            if ("error" in current) return privateJson(current, 409);
            if (
              stableJson({ ...current, preparedDate: "" }) !==
              stableJson({ ...version.snapshot, preparedDate: "" })
            )
              return privateJson(
                { error: "Research changed after this draft. Create a new version and review it." },
                409,
              );
            if (
              current.comparables.length < 3 ||
              current.comparables.length > 5 ||
              current.comparables.some((c) => !c.retrieved_at || !c.source_urls.length) ||
              !current.evidenceAssets.length ||
              !current.strengths.length ||
              current.moves.length !== 3
            )
              return privateJson(
                {
                  error:
                    "Review required: approve at least 3 sourced, dated comparables, visual evidence, strengths and 3 traceable priority moves.",
                },
                409,
              );
            const { data: existing } = await db
              .from("audit_client_access")
              .select("*")
              .eq("audit_id", params.id)
              .maybeSingle();
            const code = existing?.code_hash ? null : makeCode(current.author.name);
            const { error } = await db.rpc("audit_client_publish", {
              p_audit: params.id,
              p_version: version.id,
              p_slug:
                existing?.public_slug ??
                `${slug(current.author.name)}/${slug(current.book.title)}-${randomBytes(4).toString("hex")}`,
              p_code_hash: code ? digest(normalizeCode(code)) : null,
              p_token_hash: code ? digest(randomBytes(32).toString("hex")) : null,
            });
            if (error) throw error;
            return privateJson({ ok: true, code });
          }
          let patch: Record<string, unknown> = {};
          let code: string | null = null;
          if (body.action === "revoke" || body.action === "disable")
            patch = {
              access_enabled: false,
              generation: randomUUID(),
              ...(body.action === "revoke"
                ? { revoked_at: new Date().toISOString(), code_hash: null }
                : {}),
            };
          if (body.action === "expiry") {
            if (body.expiresAt === undefined)
              return privateJson({ error: "Choose an expiration or no expiry." }, 400);
            patch = { expires_at: body.expiresAt, generation: randomUUID() };
          }
          if (body.action === "regenerate") {
            code = makeCode("AUTHOR");
            patch = {
              code_hash: digest(normalizeCode(code)),
              secure_share_token_hash: digest(randomBytes(32).toString("hex")),
              generation: randomUUID(),
            };
          }
          const { data, error } = await db
            .from("audit_client_access")
            .update(patch)
            .eq("audit_id", params.id)
            .select("audit_id")
            .single();
          if (error || !data) throw new Error("Publish a client audit before changing access.");
          return privateJson({ ok: true, code });
        } catch (e) {
          return privateJson(
            { error: e instanceof Error ? e.message : "Could not update client access." },
            400,
          );
        }
      },
    },
  },
});

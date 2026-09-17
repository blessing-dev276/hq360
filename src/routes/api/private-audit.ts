import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  accessActive,
  digest,
  normalizeCode,
  sameOrigin,
} from "@/lib/author-audit/client-security";
import {
  clientDb,
  clientSession,
  issueSession,
  privateJson,
  snapshotFor,
  throttle,
} from "@/lib/author-audit/client-access.server";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), code: z.string().min(1).max(80) }),
  z.object({ action: z.literal("logout") }),
  z.object({
    action: z.literal("interest"),
    versionId: z.string().uuid(),
    ids: z.array(z.string().uuid()).min(1).max(50),
    interest: z.enum(["saved", "help", "question"]),
    question: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("event"),
    event: z.enum(["opened", "section", "finding", "evidence"]),
    target: z.string().max(100).optional(),
  }),
]);
export const Route = createFileRoute("/api/private-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const access = await clientSession(request);
          const url = new URL(request.url);
          if (!access || url.searchParams.get("slug") !== access.public_slug)
            return privateJson({ error: "Please enter your access code." }, 401);
          const snapshot = await snapshotFor(access);
          const format = url.searchParams.get("format");
          if (format) {
            if (!["pdf", "image"].includes(format))
              return privateJson({ error: "Invalid format" }, 400);
            if (!(await throttle(`download:${access.audit_id}`, 20, 900)))
              return privateJson({ error: "Please try again later." }, 429);
            const bytes =
              format === "pdf"
                ? await (await import("@/lib/author-audit/pdf-report")).renderAuditPdf(snapshot)
                : await (
                    await import("@/lib/author-audit/image-report")
                  ).renderAuditImage(snapshot);
            return new Response(new Uint8Array(bytes), {
              headers: {
                "content-type": format === "pdf" ? "application/pdf" : "image/png",
                "content-disposition": `attachment; filename="HQ360-audit.${format === "pdf" ? "pdf" : "png"}"`,
                "cache-control": "private, no-store",
                "x-robots-tag": "noindex, nofollow",
              },
            });
          }
          const { data: interests, error } = await clientDb()
            .from("audit_client_interest")
            .select("finding_id,author_interest,question")
            .eq("audit_id", access.audit_id)
            .eq("version_id", access.version_id);
          if (error) throw error;
          // Exclude internal service mapping and database ownership fields from web responses.
          const clean = JSON.parse(
            JSON.stringify(snapshot, (key, value) =>
              [
                "capability_slug",
                "audit_id",
                "author_id",
                "added_by",
                "normalized_name",
                "normalized_title",
              ].includes(key)
                ? undefined
                : value,
            ),
          );
          return privateJson({ report: clean, versionId: access.version_id, interests });
        } catch {
          return privateJson({ error: "Report temporarily unavailable. Please try again." }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return privateJson({ error: "Request not allowed." }, 403);
        try {
          const parsed = actionSchema.safeParse(await request.json());
          if (!parsed.success)
            return privateJson({ error: "Check your request and try again." }, 400);
          const body = parsed.data;
          const db = clientDb();
          if (body.action === "login") {
            const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? "local";
            const codeHash = digest(normalizeCode(body.code));
            if (
              !(await throttle(`ip:${digest(ip + (process.env.ADMIN_PASSWORD ?? "hq360"))}`)) ||
              !(await throttle(`code:${codeHash}`))
            )
              return privateJson(
                { error: "Too many attempts. Please wait 15 minutes and try again." },
                429,
                { "retry-after": "900" },
              );
            const { data: access } = await db
              .from("audit_client_access")
              .select("*")
              .eq("code_hash", codeHash)
              .maybeSingle();
            if (!access || !accessActive(access))
              return privateJson(
                { error: "We could not unlock this report. Check your code or contact HQ360." },
                401,
              );
            return privateJson({ path: `/author-audit/${access.public_slug}` }, 200, {
              "set-cookie": await issueSession(access),
            });
          }
          const access = await clientSession(request);
          if (!access) return privateJson({ error: "Please enter your access code." }, 401);
          if (body.action === "logout") {
            const token = request.headers
              .get("cookie")
              ?.split(";")
              .map((s) => s.trim())
              .find((s) => s.startsWith("hq360_audit="))
              ?.slice(12);
            if (token)
              await db.from("audit_client_sessions").delete().eq("token_hash", digest(token));
            return privateJson({ ok: true }, 200, {
              "set-cookie": "hq360_audit=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
            });
          }
          if (!(await throttle(`activity:${access.audit_id}`, 180, 60)))
            return privateJson({ error: "Please try again shortly." }, 429);
          const report = await snapshotFor(access);
          if (body.action === "event") {
            const targets = [...report.findings, ...report.evidenceAssets].map((x) => x.id);
            if (
              ["finding", "evidence"].includes(body.event) &&
              !targets.includes(body.target ?? "")
            )
              return privateJson({ error: "Invalid item" }, 400);
            const { error } = await db.from("audit_client_events").insert({
              audit_id: access.audit_id,
              version_id: access.version_id,
              event: body.event,
              target: body.target,
            });
            if (error) throw error;
            if (body.event === "opened")
              await db.rpc("audit_client_record_view", { target_audit: access.audit_id });
            return privateJson({ ok: true });
          }
          if (body.versionId !== access.version_id)
            return privateJson(
              { error: "An updated audit is available. Refresh before sending." },
              409,
            );
          if (body.ids.some((id) => !report.findings.some((f) => f.id === id)))
            return privateJson({ error: "Invalid recommendation" }, 400);
          if (body.interest === "question" && !body.question)
            return privateJson({ error: "Please write your question." }, 400);
          const { error } = await db.from("audit_client_interest").upsert(
            body.ids.map((id) => ({
              audit_id: access.audit_id,
              version_id: access.version_id,
              finding_id: id,
              recommendation_id: id,
              author_interest: body.interest,
              question: body.question ?? null,
            })),
            { onConflict: "version_id,finding_id,author_interest" },
          );
          if (error) throw error;
          return privateJson({ ok: true });
        } catch {
          return privateJson({ error: "Service temporarily unavailable. Please try again." }, 503);
        }
      },
    },
  },
});

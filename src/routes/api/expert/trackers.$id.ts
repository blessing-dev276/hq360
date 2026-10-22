import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { blocksSchema, fileKind, ITEM_STATUSES, TRACKER_FILE_MAX_BYTES } from "@/lib/trackers/core";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const id = z.string().uuid();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview") }),
  z.object({
    action: z.literal("addItem"),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
    is_free_bonus: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("updateItem"),
    itemId: id,
    patch: z
      .object({
        title: z.string().trim().min(1).max(200),
        status: z.enum(ITEM_STATUSES),
        progress: z.number().int().min(0).max(100),
        description: z.string().trim().max(4000),
        is_free_bonus: z.boolean(),
        portfolio_ready: z.boolean(),
        portfolio_blurb: z.string().trim().max(900),
        blocks: blocksSchema,
      })
      .partial()
      .strict(),
  }),
  z.object({ action: z.literal("deleteItem"), itemId: id }),
  z.object({ action: z.literal("reorder"), itemIds: z.array(id).max(200) }),
  z.object({
    action: z.literal("addLog"),
    text: z.string().trim().min(1).max(2000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ action: z.literal("deleteLog"), entryId: id }),
  z.object({ action: z.literal("resetPasscode"), passcode: z.string().trim().max(64).optional() }),
  z.object({ action: z.literal("publish"), notify: z.boolean().default(false) }),
  z.object({
    action: z.literal("uploadUrl"),
    itemId: id,
    filename: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(3).max(120),
    size: z.number().int().positive().max(TRACKER_FILE_MAX_BYTES),
  }),
  z.object({ action: z.literal("deleteFile"), fileId: id }),
  z.object({ action: z.literal("saveTemplate"), name: z.string().trim().min(1).max(120) }),
  // Phase 2: AI drafts with the expert's own key.
  z.object({
    action: z.literal("aiDraft"),
    kind: z.enum(["draft_update", "friendly_rewrite", "progress_summary", "portfolio_blurb"]),
    itemId: id.optional(),
    notes: z.string().trim().max(4000).optional(),
    text: z.string().trim().max(4000).optional(),
  }),
  z.object({
    action: z.literal("approveDraft"),
    draftId: id,
    edited: z.record(z.string().trim().min(1).max(1500)).optional(),
  }),
  z.object({ action: z.literal("discardDraft"), draftId: id }),
  // Phase 3: client consent for portfolio use.
  z.object({
    action: z.literal("consent"),
    consent: z.boolean(),
    method: z.string().trim().max(300).optional(),
    allowsNaming: z.boolean().optional(),
  }),
]);

const patchSchema = z
  .object({
    client_name: z.string().trim().min(1).max(120),
    client_email: z.string().trim().email().max(254).or(z.literal("")),
    project_title: z.string().trim().max(200),
    package_name: z.string().trim().max(120),
    status: z.enum(["draft", "archived"]),
  })
  .partial()
  .strict();

async function gate(request: Request, write: boolean): Promise<string | Response> {
  const { isExpertRequest } = await import("@/lib/expert-auth.server");
  const expertId = await isExpertRequest(request, { profileWrite: true });
  if (!expertId) return json({ error: "Unauthorized" }, 401);
  if (write && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  return expertId;
}

async function fail(error: unknown) {
  const { TrackerError } = await import("@/lib/trackers/service.server");
  if (error instanceof TrackerError) return json({ error: error.message }, error.status);
  return json({ error: "Something went wrong. Please try again." }, 503);
}

export const Route = createFileRoute("/api/expert/trackers/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const expertId = await gate(request, false);
        if (expertId instanceof Response) return expertId;
        if (!id.safeParse(params.id).success) return json({ error: "Not found" }, 404);
        try {
          const s = await import("@/lib/trackers/service.server");
          return json(await s.trackerDetail(expertId, params.id));
        } catch (e) {
          return fail(e);
        }
      },
      PATCH: async ({ request, params }) => {
        const expertId = await gate(request, true);
        if (expertId instanceof Response) return expertId;
        const parsed = patchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || !id.safeParse(params.id).success)
          return json({ error: "Check the tracker details." }, 400);
        try {
          const s = await import("@/lib/trackers/service.server");
          const patch = { ...parsed.data, ...(parsed.data.client_email === "" ? { client_email: null } : {}) };
          await s.updateTracker(expertId, params.id, patch as Parameters<typeof s.updateTracker>[2]);
          if (parsed.data.status === "archived") {
            const p = await import("@/lib/trackers/portfolio.server");
            await p.syncTrackerPortfolio(expertId, params.id);
          }
          return json({ ok: true });
        } catch (e) {
          return fail(e);
        }
      },
      DELETE: async ({ request, params }) => {
        const expertId = await gate(request, true);
        if (expertId instanceof Response) return expertId;
        try {
          const s = await import("@/lib/trackers/service.server");
          await s.deleteTracker(expertId, params.id);
          return json({ ok: true });
        } catch (e) {
          return fail(e);
        }
      },
      POST: async ({ request, params }) => {
        const expertId = await gate(request, true);
        if (expertId instanceof Response) return expertId;
        const parsed = actionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success || !id.safeParse(params.id).success)
          return json({ error: parsed.success ? "Not found" : (parsed.error.issues[0]?.message ?? "Check your details.") }, 400);
        const body = parsed.data;
        const trackerId = params.id;
        try {
          const s = await import("@/lib/trackers/service.server");
          switch (body.action) {
            case "preview":
              return json({ page: await s.workingSnapshot(expertId, trackerId) });
            case "addItem":
              return json({ item: await s.addItem(expertId, trackerId, body) });
            case "updateItem": {
              const item = await s.updateItem(expertId, trackerId, body.itemId, body.patch);
              const touchesPortfolio = ["status", "portfolio_ready", "portfolio_blurb", "title"].some(
                (key) => key in body.patch,
              );
              if (touchesPortfolio) {
                const p = await import("@/lib/trackers/portfolio.server");
                await p.syncTrackerPortfolio(expertId, trackerId);
              }
              return json({ item });
            }
            case "deleteItem":
              await s.deleteItem(expertId, trackerId, body.itemId);
              return json({ ok: true });
            case "reorder":
              await s.reorderItems(expertId, trackerId, body.itemIds);
              return json({ ok: true });
            case "addLog":
              return json({ entry: await s.addLogEntry(expertId, trackerId, body) });
            case "deleteLog":
              await s.deleteLogEntry(expertId, trackerId, body.entryId);
              return json({ ok: true });
            case "resetPasscode": {
              const { validPasscode } = await import("@/lib/trackers/security.server");
              if (body.passcode && !validPasscode(body.passcode))
                return json({ error: "A passcode needs 6 to 64 letters and numbers." }, 400);
              // Shown once. It cannot be read back later, only reset again.
              return json({ passcode: await s.resetPasscode(expertId, trackerId, body.passcode) });
            }
            case "publish":
              return json(await s.publishTracker(expertId, trackerId, body.notify));
            case "uploadUrl":
              return json(
                await s.createFileUpload(expertId, trackerId, {
                  ...body,
                  kind: fileKind(body.contentType, body.filename),
                }),
              );
            case "deleteFile":
              await s.deleteFile(expertId, trackerId, body.fileId);
              return json({ ok: true });
            case "saveTemplate":
              return json({ template: await s.saveTemplate(expertId, trackerId, body.name) });
            case "aiDraft": {
              const ai = await import("@/lib/trackers/ai.server");
              const keys = await import("@/lib/trackers/ai-keys.server");
              const draft = await ai.runAiAction(
                expertId,
                trackerId,
                body.kind,
                { notes: body.notes, text: body.text, itemId: body.itemId },
                { loadKey: keys.loadAiKey, call: (call) => ai.callProvider(call) },
              );
              return json({ draft });
            }
            case "approveDraft": {
              const ai = await import("@/lib/trackers/ai.server");
              const output = await ai.approveDraft(expertId, trackerId, body.draftId, body.edited);
              const p = await import("@/lib/trackers/portfolio.server");
              await p.syncTrackerPortfolio(expertId, trackerId);
              return json({ output });
            }
            case "discardDraft": {
              const ai = await import("@/lib/trackers/ai.server");
              await ai.discardDraft(expertId, trackerId, body.draftId);
              return json({ ok: true });
            }
            case "consent": {
              const p = await import("@/lib/trackers/portfolio.server");
              await p.setConsent(expertId, trackerId, body);
              return json({ ok: true });
            }
          }
          return json({ error: "Unknown action." }, 400);
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});

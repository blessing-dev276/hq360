import { z } from "zod";
import { snapshotFileIds, type ClientSnapshot } from "./core";
import {
  dailyVisitorHash,
  isUnlocked,
  lockoutKey,
  unlockCookieHeader,
  unlockCookieValue,
  userAgentFamily,
  verifyPasscode,
  visitorCountry,
} from "./security.server";
import { db, signedFileUrl } from "./service.server";

// The client side of a tracking page: unlock with the passcode, read the
// published snapshot, open files through short lived signed links. Every
// response is no-store and noindex.

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};
export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...HEADERS, ...extra } });

type LiveTracker = {
  id: string;
  expert_id: string;
  client_name: string;
  passcode_hash: string | null;
  passcode_version: number;
  published_snapshot: ClientSnapshot | null;
  published_at: string | null;
};

async function liveTracker(slug: string): Promise<LiveTracker | null> {
  if (!/^[a-z0-9-]{6,80}$/.test(slug)) return null;
  const { data } = await db()
    .from("client_trackers")
    .select("id, expert_id, client_name, passcode_hash, passcode_version, published_snapshot, published_at")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (data as LiveTracker | null) ?? null;
}

async function record(
  request: Request,
  tracker: { id: string },
  event: "open" | "unlock" | "fail" | "play" | "download",
  itemId: string | null = null,
) {
  await db()
    .from("tracker_view_events")
    .insert({
      tracker_id: tracker.id,
      event,
      item_id: itemId,
      visitor_hash: dailyVisitorHash(request, tracker.id),
      user_agent_family: userAgentFamily(request.headers.get("user-agent")),
      country: visitorCountry(request),
    });
}

/** First time the client opens a newly published update: tell the expert. */
async function notifyFirstOpen(tracker: LiveTracker) {
  if (!tracker.published_at) return;
  const { count } = await db()
    .from("tracker_view_events")
    .select("id", { count: "exact", head: true })
    .eq("tracker_id", tracker.id)
    .eq("event", "open")
    .gte("created_at", tracker.published_at);
  if ((count ?? 0) > 1) return;
  const { notifyExpert } = await import("@/lib/notifications.server");
  await notifyExpert(
    tracker.expert_id,
    "tracker_viewed",
    `${tracker.client_name} opened your latest update`,
    "Their progress page was opened for the first time since you last published.",
    "trackers",
  ).catch(() => {});
}

const NOT_FOUND = { error: "This page is not available." };

/** GET /api/track/:slug. Locked pages say only that they are locked. */
export async function trackerPage(request: Request, slug: string) {
  const tracker = await liveTracker(slug);
  if (!tracker?.published_snapshot) return json(NOT_FOUND, 404);
  const unlocked = isUnlocked(request.headers.get("cookie") ?? "", tracker.id, tracker.passcode_version);
  if (!unlocked) {
    const until = await lockedUntil(request, tracker.id);
    return json({ locked: true, lockedUntil: until }, 200);
  }
  await record(request, tracker, "open");
  await notifyFirstOpen(tracker);
  return json({ locked: false, page: tracker.published_snapshot });
}

async function lockedUntil(request: Request, trackerId: string) {
  const { data } = await db().rpc("tracker_lock_until", {
    p_tracker: trackerId,
    p_visitor: lockoutKey(request, trackerId),
  });
  return (data as string | null) ?? null;
}

const unlockSchema = z.object({ passcode: z.string().trim().min(1).max(100) }).strict();

/** POST /api/track/:slug/unlock. Five wrong tries lock this visitor out for 15 minutes. */
export async function unlockTracker(request: Request, slug: string) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  const tracker = await liveTracker(slug);
  if (!tracker?.published_snapshot) return json(NOT_FOUND, 404);
  const visitor = lockoutKey(request, tracker.id);
  const locked = await lockedUntil(request, tracker.id);
  if (locked)
    return json(
      { error: "Too many wrong tries. Please wait 15 minutes and try again.", lockedUntil: locked },
      429,
    );
  const parsed = unlockSchema.safeParse(await request.json().catch(() => null));
  const ok = parsed.success && (await verifyPasscode(parsed.data.passcode, tracker.passcode_hash));
  const { data: nowLocked } = await db().rpc("tracker_record_attempt", {
    p_tracker: tracker.id,
    p_visitor: visitor,
    p_success: ok,
  });
  await record(request, tracker, ok ? "unlock" : "fail");
  if (!ok) {
    if (nowLocked)
      return json(
        { error: "Too many wrong tries. Please wait 15 minutes and try again.", lockedUntil: nowLocked },
        429,
      );
    return json({ error: "That passcode is not right. Please check our email and try again." }, 401);
  }
  return json({ ok: true }, 200, {
    "Set-Cookie": unlockCookieHeader(tracker.id, unlockCookieValue(tracker.id, tracker.passcode_version)),
  });
}

/** GET /api/track/:slug/file/:fileId?mode=view|download|play. Redirects to a 10 minute signed link. */
export async function trackerFile(request: Request, slug: string, fileId: string) {
  const tracker = await liveTracker(slug);
  if (!tracker?.published_snapshot) return json(NOT_FOUND, 404);
  if (!isUnlocked(request.headers.get("cookie") ?? "", tracker.id, tracker.passcode_version))
    return json({ error: "Enter your passcode first." }, 401);
  // Only files that are on the published page, never unpublished uploads.
  if (!snapshotFileIds(tracker.published_snapshot).has(fileId)) return json(NOT_FOUND, 404);
  const { data: file } = await db()
    .from("tracker_files")
    .select("id, item_id, storage_key, filename")
    .eq("id", fileId)
    .eq("tracker_id", tracker.id)
    .maybeSingle();
  if (!file) return json(NOT_FOUND, 404);
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode === "download" || mode === "play")
    await record(request, tracker, mode, file.item_id as string);
  const url = await signedFileUrl(file.storage_key as string, file.filename as string, mode === "download");
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: url } });
}

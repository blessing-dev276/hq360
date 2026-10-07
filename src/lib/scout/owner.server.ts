import { resolveStaffAccess, type StaffAccess } from "@/lib/expert-auth.server";
import type { asScoutDb } from "@/lib/scout/db";

// Scouting is partitioned per workspace: every batch, audience batch, saved
// prospect and shortlist entry carries an `owner` -- "hq360" for the admin
// team, or the expert's profile id. The author/book catalogue underneath stays
// shared (one record per real person or book), but a workspace only ever sees
// records reachable from its own batches and prospects.
export const TEAM_OWNER = "hq360";

export type ScoutAccess = StaffAccess & { owner: string };

export async function resolveScoutAccess(request: Request): Promise<ScoutAccess | null> {
  const access = await resolveStaffAccess(request);
  if (!access) return null;
  return { ...access, owner: access.role === "admin" ? TEAM_OWNER : access.expertId };
}

/** Admins, plus experts the admin granted "Find Author Contact" (`contacts`). */
export async function canFindContacts(access: ScoutAccess) {
  if (access.role === "admin") return true;
  const { expertHasFeature } = await import("@/lib/expert-auth.server");
  return expertHasFeature(access.expertId, "contacts");
}

type Db = ReturnType<typeof asScoutDb>;

export async function ownsBatch(db: Db, owner: string, batchId: string) {
  const { data, error } = await db
    .from("scout_batches")
    .select("id")
    .eq("id", batchId)
    .eq("owner", owner)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function ownsAudienceBatch(db: Db, owner: string, batchId: string) {
  const { data, error } = await db
    .from("scout_audience_batches")
    .select("id")
    .eq("id", batchId)
    .eq("owner", owner)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** A workspace may read or enrich an author only if the author appears in one
 *  of its own batches or saved prospects. */
export async function canSeeAuthor(db: Db, owner: string, authorId: string) {
  const [prospect, book] = await Promise.all([
    db
      .from("scout_prospects")
      .select("id")
      .eq("owner", owner)
      .eq("scout_author_id", authorId)
      .limit(1),
    db
      .from("scout_discovered_books")
      .select("id, scout_batch_books!inner(scout_batches!inner(owner))")
      .eq("scout_author_id", authorId)
      .eq("scout_batch_books.scout_batches.owner", owner)
      .limit(1),
  ]);
  if (prospect.error) throw prospect.error;
  if (book.error) throw book.error;
  return Boolean(prospect.data?.length || book.data?.length);
}

/** True when the book sits in one of the workspace's batches. */
export async function canSeeBook(db: Db, owner: string, bookId: string) {
  const { data, error } = await db
    .from("scout_batch_books")
    .select("book_id, scout_batches!inner(owner)")
    .eq("book_id", bookId)
    .eq("scout_batches.owner", owner)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function canSeeAudienceLead(db: Db, owner: string, leadId: string) {
  const { data, error } = await db
    .from("scout_audience_batch_leads")
    .select("lead_id, scout_audience_batches!inner(owner)")
    .eq("lead_id", leadId)
    .eq("scout_audience_batches.owner", owner)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/** Who else has an author: workspaces that scouted them (saved a prospect)
 *  and workspaces whose batches generated them. Names are display-ready
 *  ("HQ360 team" or the expert's name); `self` is excluded per author by the
 *  caller since one response may cover leads from several owners. */
export type AuthorPresence = { scouted: string[]; generated: string[] };

export async function authorPresence(db: Db, authorIds: string[]) {
  const unique = [...new Set(authorIds.filter(Boolean))];
  const scouted = new Map<string, Set<string>>();
  const generated = new Map<string, Set<string>>();
  if (!unique.length) return { scouted, generated, names: new Map<string, string>() };
  const [prospects, books] = await Promise.all([
    db
      .from("scout_prospects")
      .select("scout_author_id, owner, status, do_not_contact")
      .in("scout_author_id", unique),
    db
      .from("scout_discovered_books")
      .select("scout_author_id, scout_batch_books!inner(scout_batches!inner(owner))")
      .in("scout_author_id", unique),
  ]);
  for (const p of (prospects.data ?? []) as {
    scout_author_id: string;
    owner: string;
    status: string;
    do_not_contact: boolean;
  }[]) {
    if (p.status === "excluded" || p.do_not_contact) continue;
    (
      scouted.get(p.scout_author_id) ??
      scouted.set(p.scout_author_id, new Set()).get(p.scout_author_id)!
    ).add(p.owner);
  }
  type Link = { scout_batches: { owner: string } | { owner: string }[] | null };
  for (const b of (books.data ?? []) as unknown as {
    scout_author_id: string;
    scout_batch_books: Link[] | Link | null;
  }[]) {
    const links = Array.isArray(b.scout_batch_books)
      ? b.scout_batch_books
      : b.scout_batch_books
        ? [b.scout_batch_books]
        : [];
    for (const link of links) {
      const batches = Array.isArray(link.scout_batches)
        ? link.scout_batches
        : link.scout_batches
          ? [link.scout_batches]
          : [];
      for (const batch of batches)
        (
          generated.get(b.scout_author_id) ??
          generated.set(b.scout_author_id, new Set()).get(b.scout_author_id)!
        ).add(batch.owner);
    }
  }
  const owners = [
    ...new Set([...scouted.values(), ...generated.values()].flatMap((s) => [...s])),
  ].filter((o) => o !== TEAM_OWNER);
  const names = new Map<string, string>([[TEAM_OWNER, "HQ360 team"]]);
  if (owners.length) {
    const { data } = await (db as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("expert_profiles")
      .select("id, full_name, email")
      .in("id", owners);
    for (const e of (data ?? []) as { id: string; full_name: string | null; email: string }[])
      names.set(e.id, e.full_name || e.email);
  }
  return { scouted, generated, names };
}

/** Presence for one author as seen by `self`: other workspaces only, and a
 *  workspace that scouted the author isn't repeated under "generated". */
export function presenceFor(
  p: Awaited<ReturnType<typeof authorPresence>>,
  authorId: string | null | undefined,
  self: string,
): AuthorPresence {
  if (!authorId) return { scouted: [], generated: [] };
  const scouted = [...(p.scouted.get(authorId) ?? [])].filter((o) => o !== self);
  const generated = [...(p.generated.get(authorId) ?? [])].filter(
    (o) => o !== self && !scouted.includes(o),
  );
  const name = (o: string) => p.names.get(o) ?? "Another expert";
  return { scouted: scouted.map(name), generated: generated.map(name) };
}

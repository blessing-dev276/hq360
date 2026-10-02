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

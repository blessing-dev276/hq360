import { db, own, ownedTracker, TrackerError, type Actor } from "./service.server";

// Auto portfolio. The database refuses any entry without client consent and
// a Complete, Portfolio ready item, and deletes entries when consent goes.
// Media is never copied to a public bucket: it is served through
// /api/public/portfolio-media/:itemId, which re-checks consent on every request.

/** Rule 3: no email addresses, phone numbers, money amounts or passcodes. */
export function stripPrivate(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
    .replace(/(?:[$€£₦]|\b(?:USD|EUR|GBP|NGN)\s?)\s?\d[\d,.]*/gi, "")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
    .replace(/\bpass\s?code\b[^.]*\.?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

export type PortfolioSource = {
  item: { id: string; title: string; status: string; portfolio_ready: boolean; portfolio_blurb: string };
  tracker: { portfolio_consent: boolean; consent_allows_naming: boolean; client_name: string; project_title: string; status: string };
  media: { kind: "image" | "video" } | null;
};

/** The public entry for one item, or null when it must not be published. */
export function portfolioEntry(source: PortfolioSource) {
  const { item, tracker, media } = source;
  if (!tracker.portfolio_consent || tracker.status === "archived") return null;
  if (item.status !== "done" || !item.portfolio_ready) return null;
  const blurb = stripPrivate(item.portfolio_blurb);
  if (!blurb) return null;
  const credit = tracker.consent_allows_naming
    ? [tracker.project_title, tracker.client_name].filter(Boolean).join(" · ")
    : "";
  const mediaUrl = media ? `/api/public/portfolio-media/${item.id}` : null;
  return {
    title: item.title.slice(0, 150),
    description: (credit ? `${credit}\n\n${blurb}` : blurb).slice(0, 2000),
    image_url: media?.kind === "image" ? mediaUrl : null,
    video_url: media?.kind === "video" ? mediaUrl : null,
  };
}

/** Create or refresh entries for every eligible item; drafts unless auto publish is on. */
export async function syncTrackerPortfolio(actor: Actor, trackerId: string) {
  const tracker = await ownedTracker(actor, trackerId);
  // Entries always go on the tracker owner's profile, also when admin acts.
  const expertId = tracker.expert_id;
  const [{ data: items }, { data: files }, { data: profile }, { data: existing }] = await Promise.all([
    db()
      .from("tracker_items")
      .select("id, title, status, portfolio_ready, portfolio_blurb")
      .eq("tracker_id", trackerId),
    db().from("tracker_files").select("item_id, kind, position").eq("tracker_id", trackerId).in("kind", ["image", "video"]).order("position"),
    db().from("expert_profiles").select("portfolio_auto_publish").eq("id", expertId).maybeSingle(),
    db().from("expert_portfolio_items").select("id, source_tracker_item_id, status").eq("expert_id", expertId).not("source_tracker_item_id", "is", null),
  ]);
  const autoPublish = Boolean(profile?.portfolio_auto_publish);
  let created = 0;
  for (const item of (items ?? []) as PortfolioSource["item"][]) {
    const own = (files ?? []).filter((f) => f.item_id === item.id);
    const media = (own.find((f) => f.kind === "image") ?? own.find((f) => f.kind === "video")) as PortfolioSource["media"] | undefined;
    const entry = portfolioEntry({ item, tracker, media: media ?? null });
    const current = (existing ?? []).find((e) => e.source_tracker_item_id === item.id);
    if (!entry) {
      if (current) await db().from("expert_portfolio_items").delete().eq("id", current.id);
      continue;
    }
    if (current) {
      await db().from("expert_portfolio_items").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", current.id);
    } else {
      const { error } = await db()
        .from("expert_portfolio_items")
        .insert({ ...entry, expert_id: expertId, source_tracker_item_id: item.id, status: autoPublish ? "approved" : "draft" });
      if (error) throw new TrackerError("Could not add the portfolio entry.", error.code === "23514" ? 409 : 503);
      created += 1;
    }
  }
  return { created };
}

export async function setConsent(
  actor: Actor,
  trackerId: string,
  input: { consent: boolean; method?: string; allowsNaming?: boolean },
) {
  await ownedTracker(actor, trackerId);
  if (input.consent && !input.method?.trim())
    throw new TrackerError("Say how the client gave consent, for example 'Email, 20 Oct 2026'.", 400);
  const { error } = await db()
    .from("client_trackers")
    .update(
      input.consent
        ? {
            portfolio_consent: true,
            consent_at: new Date().toISOString(),
            consent_method: input.method!.trim(),
            consent_allows_naming: Boolean(input.allowsNaming),
          }
        : // Withdrawal: the database trigger deletes this tracker's entries immediately.
          { portfolio_consent: false, consent_allows_naming: false },
    )
    .eq("id", trackerId);
  if (error) throw new TrackerError("Could not save consent.", 503);
  if (input.consent) await syncTrackerPortfolio(actor, trackerId);
}

export async function portfolioDrafts(actor: Actor) {
  const [{ data, error }, { data: profile }] = await Promise.all([
    db()
      .from("expert_portfolio_items")
      .select("id, expert_id, title, description, image_url, video_url, status, source_tracker_item_id, created_at")
      .match(own(actor))
      .not("source_tracker_item_id", "is", null)
      .order("created_at", { ascending: false }),
    // Auto publish is each expert's own setting; admin sees all entries instead.
    actor.role === "expert"
      ? db().from("expert_profiles").select("portfolio_auto_publish").eq("id", actor.expertId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new TrackerError("Could not load portfolio entries.", 503);
  const setting = profile as { portfolio_auto_publish?: boolean } | null;
  return { items: data ?? [], autoPublish: Boolean(setting?.portfolio_auto_publish), admin: actor.role === "admin" };
}

/** One click approval. The guard trigger re-checks consent at this moment too. */
export async function approvePortfolioEntry(actor: Actor, entryId: string) {
  const { data, error } = await db()
    .from("expert_portfolio_items")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: actor.role })
    .eq("id", entryId)
    .match(own(actor))
    .eq("status", "draft")
    .not("source_tracker_item_id", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new TrackerError("This entry no longer has client consent.", 409);
  if (!data) throw new TrackerError("Entry not found.", 404);
}

export async function setAutoPublish(expertId: string, value: boolean) {
  const { error } = await db().from("expert_profiles").update({ portfolio_auto_publish: value }).eq("id", expertId);
  if (error) throw new TrackerError("Could not save the setting.", 503);
}

/** Public media for an approved, still consented entry; else 404. */
export async function portfolioMediaUrl(itemId: string) {
  const { data: entry } = await db()
    .from("expert_portfolio_items")
    .select("id")
    .eq("source_tracker_item_id", itemId)
    .eq("status", "approved")
    .maybeSingle();
  if (!entry) return null;
  const { data: allowed } = await db().rpc("tracker_portfolio_allowed", { p_item: itemId });
  if (!allowed) return null;
  const { data: file } = await db()
    .from("tracker_files")
    .select("storage_key, kind")
    .eq("item_id", itemId)
    .in("kind", ["image", "video"])
    .order("kind") // "image" sorts before "video"
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!file) return null;
  const { data } = await db().storage.from("tracker-files").createSignedUrl(file.storage_key as string, 600);
  return data?.signedUrl ?? null;
}

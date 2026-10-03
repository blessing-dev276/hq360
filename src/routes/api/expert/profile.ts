import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fiverrUrl, upworkUrl } from "@/lib/expert-links";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((value) => value.startsWith("https://"), "Use an https:// link");

const schema = z.object({
  full_name: z.string().trim().min(2).max(150),
  headline: z.string().trim().max(160),
  summary: z.string().trim().max(140),
  bio: z.string().trim().max(1200),
  location: z.string().trim().max(120),
  specialties: z.array(z.string().trim().min(1).max(40)).max(12),
  website_url: httpsUrl.or(z.literal("")),
  linkedin_url: httpsUrl
    .refine((value) => {
      try {
        return /(^|\.)linkedin\.com$/i.test(new URL(value).hostname);
      } catch {
        return false;
      }
    }, "Use a LinkedIn link")
    .or(z.literal("")),
  fiverr_url: fiverrUrl.optional(),
  upwork_url: upworkUrl.optional(),
  photo_url: z.string().trim().max(500),
});

const FIELDS =
  "id, email, slug, full_name, headline, summary, bio, photo_url, specialties, location, website_url, linkedin_url, fiverr_url, upwork_url, is_public, status, profile_status, profile_submitted_at, profile_reviewed_at, profile_review_note, claimed_team_member_id, role, permissions, is_founder";

export const Route = createFileRoute("/api/expert/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest, expertProfiles } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertProfiles()
          .select(FIELDS)
          .eq("id", expertId)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not load your profile." }, 503);
        return json({ profile: data });
      },
      PUT: async ({ request }) => {
        const { isExpertRequest, expertProfiles } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const input = parsed.data;
        // Portraits the expert uploads themselves must point at their own
        // folder in our bucket. A photo an admin backfilled from a claimed
        // team_members row (or set some other way) lives elsewhere and is
        // left alone unless the expert actually changes it here.
        const { data: current } = await expertProfiles()
          .select("photo_url")
          .eq("id", expertId)
          .maybeSingle();
        const photoPrefix = `${(process.env.SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/expert-photos/${expertId}/`;
        if (
          input.photo_url &&
          input.photo_url !== (current as { photo_url?: string } | null)?.photo_url &&
          !input.photo_url.startsWith(photoPrefix)
        )
          return json({ error: "Upload your photo using the photo button." }, 400);
        const { data, error } = await expertProfiles()
          .update({
            full_name: input.full_name,
            headline: input.headline || null,
            summary: input.summary || null,
            bio: input.bio || null,
            location: input.location || null,
            specialties: [...new Set(input.specialties)],
            website_url: input.website_url || null,
            linkedin_url: input.linkedin_url || null,
            fiverr_url: input.fiverr_url || null,
            upwork_url: input.upwork_url || null,
            photo_url: input.photo_url || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", expertId)
          .select(FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not save your profile." }, 503);
        return json({ profile: data });
      },
    },
  },
});

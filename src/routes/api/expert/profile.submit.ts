import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const FIELDS =
  "id, email, slug, full_name, headline, bio, photo_url, specialties, location, website_url, linkedin_url, is_public, status, profile_status, profile_submitted_at, profile_reviewed_at, profile_review_note, claimed_team_member_id";

/** Puts the expert's current profile content up for admin review. Doesn't
 *  publish anything itself -- only an admin "publish" action sets is_public. */
export const Route = createFileRoute("/api/expert/profile/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isExpertRequest, expertProfiles } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertProfiles()
          .update({
            profile_status: "submitted",
            profile_submitted_at: new Date().toISOString(),
            profile_review_note: null,
          })
          .eq("id", expertId)
          .select(FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not submit your profile." }, 503);
        return json({ profile: data });
      },
    },
  },
});

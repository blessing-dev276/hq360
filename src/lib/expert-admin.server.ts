import { z } from "zod";
import { expertProfiles, teamMembersUntyped } from "@/lib/expert-auth.server";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((value) => value.startsWith("https://"), "Use an https:// link");

/** Profile fields an admin may edit on any expert (including the founder). */
export const adminProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  headline: z.string().trim().max(160),
  summary: z.string().trim().max(140),
  bio: z.string().trim().max(1200),
  location: z.string().trim().max(120),
  specialties: z.array(z.string().trim().min(1).max(40)).max(12),
  website_url: httpsUrl.or(z.literal("")),
  linkedin_url: httpsUrl.or(z.literal("")),
  photo_url: httpsUrl.or(z.literal("")),
});

/** Link an admin-managed team_members row to an expert and backfill any
 *  profile fields the expert hasn't filled in. Returns an error message. */
export async function claimTeamMember(expertId: string, teamMemberId: string) {
  const { data: teamMember, error } = await teamMembersUntyped()
    .select("id, name, title, image_url, blurb, claimed_by_expert_id")
    .eq("id", teamMemberId)
    .maybeSingle();
  if (error || !teamMember) return "Team profile not found.";
  if (teamMember.claimed_by_expert_id && teamMember.claimed_by_expert_id !== expertId)
    return "That team profile is already claimed.";
  const { data: expert } = await expertProfiles()
    .select("full_name, headline, bio, photo_url")
    .eq("id", expertId)
    .maybeSingle();
  if (!expert) return "Expert not found.";
  const { error: linkError } = await teamMembersUntyped()
    .update({ claimed_by_expert_id: expertId })
    .eq("id", teamMemberId);
  if (linkError) return "Could not link this team profile.";
  const { error: fillError } = await expertProfiles()
    .update({
      claimed_team_member_id: teamMemberId,
      // Everyone on the team is an expert with Associate access.
      role: "associate",
      permissions: ["scout", "audit", "invoices"],
      full_name: expert.full_name || teamMember.name,
      headline: expert.headline || teamMember.title || null,
      bio: expert.bio || teamMember.blurb || null,
      photo_url: expert.photo_url || teamMember.image_url || null,
    })
    .eq("id", expertId);
  return fillError ? "Linked, but could not prefill the profile." : null;
}

/** Portfolio item fields an admin may write for any expert. */
export const adminPortfolioSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(600),
  image_url: httpsUrl.or(z.literal("")),
  external_link: httpsUrl.or(z.literal("")),
  service_slugs: z.array(z.string().trim().min(1).max(60)).max(10),
  audience_slugs: z.array(z.string().trim().min(1).max(60)).max(10),
});
export function portfolioRow(p: z.infer<typeof adminPortfolioSchema>) {
  return {
    title: p.title,
    description: p.description || null,
    image_url: p.image_url || null,
    external_link: p.external_link || null,
    service_slugs: [...new Set(p.service_slugs)],
    audience_slugs: [...new Set(p.audience_slugs)],
  };
}

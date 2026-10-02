import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

const claimSchema = z.object({
  email: z.string().trim().email().max(254),
  team_member_id: z.string().uuid(),
});

/** The founder profile: an expert profile the admin claims and edits, linked
 *  to the founder's team_members row so it keeps its place on the team. */
export const Route = createFileRoute("/api/admin/founder")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertProfiles } = await import("@/lib/expert-auth.server");
        const { data, error } = await expertProfiles()
          .select("id, email, full_name, slug, claimed_team_member_id")
          .eq("is_founder", true)
          .maybeSingle();
        if (error)
          return Response.json({ error: "Could not load the founder profile." }, { status: 503 });
        return Response.json({ founder: data ?? null });
      },
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const parsed = claimSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json(
            { error: "Enter the founder's email and pick their team profile." },
            { status: 400 },
          );
        const { email, team_member_id } = parsed.data;
        const { expertProfiles, teamMembersUntyped } = await import("@/lib/expert-auth.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await expertProfiles()
          .select("id")
          .eq("is_founder", true)
          .maybeSingle();
        if (existing)
          return Response.json(
            { error: "The founder profile is already claimed." },
            { status: 409 },
          );

        const { data: team } = await teamMembersUntyped()
          .select("id, name")
          .eq("id", team_member_id)
          .maybeSingle();
        if (!team) return Response.json({ error: "Team profile not found." }, { status: 404 });

        // Find or create the founder's login account.
        let userId: string | null = null;
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          password: crypto.randomUUID() + crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { account_type: "expert", full_name: team.name },
        });
        if (created.data.user) userId = created.data.user.id;
        else {
          for (let page = 1; page <= 20 && !userId; page++) {
            const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
            const match = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (match) userId = match.id;
            if (!data || data.users.length < 200) break;
          }
        }
        if (!userId)
          return Response.json({ error: "Could not create the founder account." }, { status: 503 });

        // The signup trigger creates the profile for new accounts; an existing
        // non-expert account needs one inserted.
        const { data: profile } = await expertProfiles()
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (!profile) {
          const base = team.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          const { error } = await expertProfiles().insert({
            id: userId,
            email,
            full_name: team.name,
            slug: `${base || "founder"}-${userId.replace(/-/g, "").slice(0, 6)}`,
          });
          if (error)
            return Response.json(
              { error: "Could not create the founder profile." },
              { status: 503 },
            );
        }

        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const { error: setError } = await expertProfiles()
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: configuredUsername(),
            is_founder: true,
            managed_by_admin: true,
            role: "associate",
            permissions: ["scout", "audit", "invoices"],
            profile_status: "approved",
            is_public: true,
          })
          .eq("id", userId);
        if (setError)
          return Response.json({ error: "Could not mark the founder profile." }, { status: 503 });

        const { claimTeamMember } = await import("@/lib/expert-admin.server");
        const claimError = await claimTeamMember(userId, team_member_id);
        if (claimError) return Response.json({ error: claimError }, { status: 409 });
        return Response.json({ ok: true, id: userId });
      },
    },
  },
});

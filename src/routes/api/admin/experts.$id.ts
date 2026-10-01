import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
export const Route = createFileRoute("/api/admin/experts/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.json().catch(() => null);
        const action = body?.action;
        const actions = [
          "approve",
          "reject",
          "delete",
          "publish",
          "unpublish",
          "request_changes",
          "claim",
          "assign_portfolio",
        ];
        if (!actions.includes(action))
          return Response.json({ error: "Invalid action" }, { status: 400 });

        if (action === "delete") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Deletes the auth.users row; expert_profiles cascades (on delete cascade FK).
          const { error } = await supabaseAdmin.auth.admin.deleteUser(params.id);
          if (error) return Response.json({ error: "Could not delete expert." }, { status: 503 });
          return Response.json({ ok: true });
        }

        const { expertProfiles } = await import("@/lib/expert-auth.server");
        const { configuredUsername } = await import("@/lib/admin-auth.server");
        const admin = configuredUsername();

        if (action === "approve" || action === "reject") {
          const { error } = await expertProfiles()
            .update({
              status: action === "approve" ? "approved" : "rejected",
              reviewed_at: new Date().toISOString(),
              reviewed_by: admin,
            })
            .eq("id", params.id);
          if (error) return Response.json({ error: "Could not update expert." }, { status: 503 });
          return Response.json({ ok: true });
        }

        if (action === "publish" || action === "unpublish" || action === "request_changes") {
          const note =
            action === "request_changes" && typeof body?.note === "string"
              ? body.note.trim().slice(0, 1000) || null
              : null;
          const { error } = await expertProfiles()
            .update({
              is_public: action === "publish",
              profile_status:
                action === "publish"
                  ? "approved"
                  : action === "unpublish"
                    ? "approved"
                    : "changes_requested",
              profile_reviewed_at: new Date().toISOString(),
              profile_reviewed_by: admin,
              profile_review_note: note,
            })
            .eq("id", params.id);
          if (error)
            return Response.json({ error: "Could not update this profile." }, { status: 503 });
          return Response.json({ ok: true });
        }

        if (action === "assign_portfolio") {
          // Copy one of the admin's already-uploaded site portfolio_items
          // into this expert's own portfolio, pre-approved since admin is
          // the one attaching it.
          const portfolioItemId =
            typeof body?.portfolio_item_id === "string" ? body.portfolio_item_id : "";
          if (!portfolioItemId)
            return Response.json({ error: "Missing portfolio_item_id" }, { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: source, error: sourceError } = await supabaseAdmin
            .from("portfolio_items")
            .select("title, description, media_url, thumbnail_url, external_link")
            .eq("id", portfolioItemId)
            .maybeSingle();
          if (sourceError || !source)
            return Response.json({ error: "Portfolio item not found." }, { status: 404 });
          const { expertPortfolioItems } = await import("@/lib/expert-auth.server");
          const { error: assignError } = await expertPortfolioItems().insert({
            expert_id: params.id,
            title: source.title,
            description: source.description,
            image_url: source.thumbnail_url || source.media_url,
            external_link: source.external_link,
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: admin,
          });
          if (assignError)
            return Response.json({ error: "Could not assign this item." }, { status: 503 });
          return Response.json({ ok: true });
        }

        // claim: link an admin-managed team_members row to this expert, then
        // backfill any profile fields the expert hasn't filled in themselves.
        const teamMemberId = typeof body?.team_member_id === "string" ? body.team_member_id : "";
        if (!teamMemberId)
          return Response.json({ error: "Missing team_member_id" }, { status: 400 });
        const { teamMembersUntyped } = await import("@/lib/expert-auth.server");
        const { data: teamMember, error: teamError } = await teamMembersUntyped()
          .select("id, name, title, image_url, blurb, claimed_by_expert_id")
          .eq("id", teamMemberId)
          .maybeSingle();
        if (teamError || !teamMember)
          return Response.json({ error: "Team profile not found." }, { status: 404 });
        if (teamMember.claimed_by_expert_id && teamMember.claimed_by_expert_id !== params.id)
          return Response.json({ error: "That team profile is already claimed." }, { status: 409 });
        const { data: expert, error: expertError } = await expertProfiles()
          .select("full_name, headline, bio, photo_url")
          .eq("id", params.id)
          .maybeSingle();
        if (expertError || !expert)
          return Response.json({ error: "Expert not found." }, { status: 404 });
        const { error: linkError } = await teamMembersUntyped()
          .update({ claimed_by_expert_id: params.id })
          .eq("id", teamMemberId);
        if (linkError)
          return Response.json({ error: "Could not link this team profile." }, { status: 503 });
        const { error: fillError } = await expertProfiles()
          .update({
            claimed_team_member_id: teamMemberId,
            full_name: expert.full_name || teamMember.name,
            headline: expert.headline || teamMember.title || null,
            bio: expert.bio || teamMember.blurb || null,
            photo_url: expert.photo_url || teamMember.image_url || null,
          })
          .eq("id", params.id);
        if (fillError)
          return Response.json(
            { error: "Linked, but could not prefill profile." },
            { status: 503 },
          );
        return Response.json({ ok: true });
      },
    },
  },
});

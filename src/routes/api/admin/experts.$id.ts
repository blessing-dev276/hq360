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
          "unlink_team",
          "assign_portfolio",
          "set_access",
          "update_profile",
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
          // Publish / request-changes notify via the database trigger.
          if (action === "unpublish") {
            const { notifyExpert } = await import("@/lib/notifications.server");
            await notifyExpert(
              params.id,
              "profile_unpublished",
              "Your profile is no longer public",
              "HQ360 has taken your public profile offline. Contact HQ360 if you have questions.",
              "profile",
            );
          }
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
          const { expertPortfolioItems: taken } = await import("@/lib/expert-auth.server");
          const { data: owner } = await taken()
            .select("expert_id, expert_profiles(full_name, email)")
            .eq("source_portfolio_item_id", portfolioItemId)
            .limit(1)
            .maybeSingle();
          if (owner) {
            const p = (
              Array.isArray(owner.expert_profiles)
                ? owner.expert_profiles[0]
                : owner.expert_profiles
            ) as { full_name: string | null; email: string } | null;
            return Response.json(
              { error: `Already assigned to ${p?.full_name || p?.email || "another expert"}.` },
              { status: 409 },
            );
          }
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
            source_portfolio_item_id: portfolioItemId,
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
          const { notifyExpert } = await import("@/lib/notifications.server");
          await notifyExpert(
            params.id,
            "portfolio_added",
            "Portfolio item added",
            `HQ360 added "${source.title}" to your portfolio.`,
            "portfolio",
          );
          return Response.json({ ok: true });
        }

        if (action === "set_access") {
          const { EXPERT_FEATURES, EXPERT_ROLES } = await import("@/lib/expert-roles");
          const role = String(body?.role ?? "");
          const allowed = new Set<string>(EXPERT_FEATURES.map((f) => f.key));
          const permissions: string[] = Array.isArray(body?.permissions)
            ? [...new Set<string>(body.permissions.map(String))].filter((p) => allowed.has(p))
            : [];
          if (role !== "custom" && !EXPERT_ROLES.some((r) => r.key === role))
            return Response.json({ error: "Unknown role." }, { status: 400 });
          const { error } = await expertProfiles()
            .update({ role, permissions })
            .eq("id", params.id);
          if (error) return Response.json({ error: "Could not save access." }, { status: 503 });
          const { notifyExpert } = await import("@/lib/notifications.server");
          await notifyExpert(
            params.id,
            "access_updated",
            "Your workspace access changed",
            "HQ360 updated which tools you can use. Open your workspace to see what's available.",
            "dashboard",
          );
          return Response.json({ ok: true });
        }

        if (action === "update_profile") {
          const { adminProfileSchema } = await import("@/lib/expert-admin.server");
          const parsed = adminProfileSchema.safeParse(body?.profile);
          if (!parsed.success)
            return Response.json(
              { error: parsed.error.issues[0]?.message || "Check the profile details." },
              { status: 400 },
            );
          const p = parsed.data;
          const { error } = await expertProfiles()
            .update({
              full_name: p.full_name,
              headline: p.headline || null,
              summary: p.summary || null,
              bio: p.bio || null,
              location: p.location || null,
              specialties: [...new Set(p.specialties)],
              website_url: p.website_url || null,
              linkedin_url: p.linkedin_url || null,
              fiverr_url: p.fiverr_url || null,
              upwork_url: p.upwork_url || null,
              photo_url: p.photo_url || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", params.id);
          if (error)
            return Response.json({ error: "Could not save the profile." }, { status: 503 });
          const { notifyExpert } = await import("@/lib/notifications.server");
          await notifyExpert(
            params.id,
            "profile_updated",
            "Your profile was updated",
            "HQ360 made changes to your profile. Have a look to make sure it reads the way you want.",
            "profile",
          );
          return Response.json({ ok: true });
        }

        const { teamMembersUntyped } = await import("@/lib/expert-auth.server");
        if (action === "unlink_team") {
          await teamMembersUntyped()
            .update({ claimed_by_expert_id: null })
            .eq("claimed_by_expert_id", params.id);
          const { error } = await expertProfiles()
            .update({ claimed_team_member_id: null })
            .eq("id", params.id);
          if (error) return Response.json({ error: "Could not unlink." }, { status: 503 });
          return Response.json({ ok: true });
        }

        // claim: link an admin-managed team_members row to this expert.
        const teamMemberId = typeof body?.team_member_id === "string" ? body.team_member_id : "";
        if (!teamMemberId)
          return Response.json({ error: "Missing team_member_id" }, { status: 400 });
        const { claimTeamMember } = await import("@/lib/expert-admin.server");
        const claimError = await claimTeamMember(params.id, teamMemberId);
        if (claimError) return Response.json({ error: claimError }, { status: 409 });
        return Response.json({ ok: true });
      },
    },
  },
});

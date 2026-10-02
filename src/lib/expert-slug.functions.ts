import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve old URLs only for profiles that are currently public and approved. */
export const resolveExpertSlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as SupabaseClient;
      const { data: alias, error } = await db
        .from("expert_slug_aliases")
        .select("expert_profiles!inner(slug)")
        .eq("slug", data.slug)
        .eq("expert_profiles.is_public", true)
        .eq("expert_profiles.status", "approved")
        .maybeSingle();
      if (error || !alias) return null;
      const profile = alias.expert_profiles as unknown as { slug: string };
      return profile.slug !== data.slug ? profile.slug : null;
    } catch {
      return null;
    }
  });

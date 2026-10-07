import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// expert_reviews isn't in the generated Database type yet.
export const expertReviews = () => (supabaseAdmin as SupabaseClient).from("expert_reviews");

/** Public URL prefix an expert's own uploaded screenshots must start with. */
export function expertPhotoPrefix(expertId: string) {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/expert-photos/${expertId}/`;
}

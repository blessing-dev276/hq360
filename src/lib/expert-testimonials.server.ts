import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// expert_testimonials isn't in the generated Database type yet.
export const expertTestimonials = () =>
  (supabaseAdmin as SupabaseClient).from("expert_testimonials");

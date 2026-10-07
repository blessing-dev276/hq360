import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serializeCaseStudy } from "@/lib/case-study-shape";

/** Read only published rows, shared by SSR, public API and sitemap. */
export async function readPublishedCaseStudies(slug?: string) {
  let query = supabaseAdmin.from("case_studies").select("*").eq("published", true);
  if (slug) query = query.eq("slug", slug);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200)
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error("Published projects are temporarily unavailable");
  return (data ?? []).map(serializeCaseStudy);
}

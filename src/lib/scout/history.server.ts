import type { SupabaseClient } from "@supabase/supabase-js";

/** Paginate: a workspace's exclusion history must never truncate at 1,000 rows. */
export async function generatedAuthorNames(db: SupabaseClient, owner: string) {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("scout_workspace_authors")
      .select("author_key")
      .eq("owner", owner)
      .order("author_key")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) names.add(row.author_key);
    if (!data || data.length < 1000) return names;
  }
}

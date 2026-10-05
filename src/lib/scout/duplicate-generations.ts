export type GenerationMembership = {
  batch_id: string;
  book_id: string;
  scout_batches: { owner: string; created_at: string };
  scout_discovered_books: {
    scout_author_id: string;
    scout_authors: { normalized_name: string };
  };
};

/** Retain the earliest generation of a name within each expert's workspace. */
export function duplicateGenerations(rows: GenerationMembership[]) {
  const seen = new Set<string>();
  const duplicates: GenerationMembership[] = [];
  const sorted = [...rows].sort(
    (a, b) =>
      a.scout_batches.created_at.localeCompare(b.scout_batches.created_at) ||
      a.batch_id.localeCompare(b.batch_id) ||
      a.book_id.localeCompare(b.book_id),
  );
  for (const row of sorted) {
    const owner = row.scout_batches.owner;
    const name = row.scout_discovered_books.scout_authors.normalized_name;
    // Never collapse blank identities or modify the HQ360 team workspace.
    if (!owner || owner === "hq360" || !name?.trim()) continue;
    const key = JSON.stringify([owner, name.trim().replace(/\s+/g, " ").toLowerCase()]);
    if (seen.has(key)) duplicates.push(row);
    else seen.add(key);
  }
  return duplicates;
}

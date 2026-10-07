import { expect, test } from "bun:test";
import {
  duplicateGenerations,
  type GenerationMembership,
} from "../src/lib/scout/duplicate-generations";
function row(
  owner: string,
  name: string,
  batch: string,
  book: string,
  date = "2026-10-01",
): GenerationMembership {
  return {
    batch_id: batch,
    book_id: book,
    scout_batches: { owner, created_at: date },
    scout_discovered_books: { scout_author_id: book, scout_authors: { normalized_name: name } },
  };
}
test("keeps earliest author per expert, including different books and source identities", () => {
  const old = row("expert-a", "Writer", "old", "1");
  const repeated = row("expert-a", " writer ", "new", "2", "2026-10-02");
  expect(duplicateGenerations([repeated, row("expert-b", "writer", "b", "3"), old])).toEqual([
    repeated,
  ]);
});
test("deduplicates within a batch deterministically without changing team history or blank names", () => {
  const repeated = row("expert-a", "one", "batch", "2");
  expect(
    duplicateGenerations([
      repeated,
      row("expert-a", "one", "batch", "1"),
      row("hq360", "one", "team", "1"),
      row("hq360", "one", "team", "2"),
      row("expert-a", "", "batch", "3"),
      row("expert-a", "", "batch", "4"),
    ]),
  ).toEqual([repeated]);
});

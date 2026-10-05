// Tiny validators for public server functions. These run in the browser too,
// and these files are reachable from route loaders in the shared bundle, so
// they avoid pulling the zod library into every public page.

function slugString(value: unknown, max: number) {
  return typeof value === "string" && value.length >= 1 && value.length <= max;
}

/** `{ slug: string }` (1–max chars). */
export function requiredSlug(max: number) {
  return (input: unknown): { slug: string } => {
    const slug = (input as { slug?: unknown } | null)?.slug;
    if (!slugString(slug, max)) throw new Error("Invalid slug");
    return { slug: slug as string };
  };
}

/** `{ slug?: string }` (when present, 1–max chars). */
export function optionalSlug(max: number) {
  return (input: unknown): { slug?: string } => {
    const slug = (input as { slug?: unknown } | null)?.slug;
    if (slug === undefined) return {};
    if (!slugString(slug, max)) throw new Error("Invalid slug");
    return { slug: slug as string };
  };
}

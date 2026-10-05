// Case-study data mappers shared by the public site, admin and server.
// Deliberately free of zod: these are imported by public components, and the
// schemas in case-study-shape.ts are only needed where input is validated.

/** DB row -> the flat shape the public site and admin consume. */
export function serializeCaseStudy(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    slug: row.slug as string,
    status: row.status as "verified" | "sample",
    title: row.title as string,
    client: (row.client as string) ?? "",
    industry: (row.industry as string) ?? "",
    capabilities: (row.capabilities as string[]) ?? [],
    summary: (row.summary as string) ?? "",
    challenge: (row.challenge as string) ?? "",
    approach: (row.approach as string[]) ?? [],
    deliverables: (row.deliverables as string[]) ?? [],
    outcome: (row.outcome as string) ?? "",
    metrics: (row.metrics as { label: string; value: string; note?: string }[]) ?? [],
    testimonial: (row.testimonial as { quote: string; name: string; role: string } | null) ?? null,
    media:
      (row.media as { src: string; alt: string; caption?: string; type?: "image" | "video" }[]) ??
      [],
    published: (row.published as boolean) ?? true,
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export type SerializedCaseStudy = ReturnType<typeof serializeCaseStudy>;

/** Serialized row -> the CaseStudy shape used by the static site components. */
export function toCaseStudyShape(row: SerializedCaseStudy) {
  return {
    slug: row.slug,
    status: /illustrative/i.test(`${row.client} ${row.outcome}`) ? ("sample" as const) : row.status,
    title: row.title,
    client: row.client,
    industry: row.industry,
    capabilities: row.capabilities,
    summary: row.summary,
    challenge: row.challenge,
    approach: row.approach,
    deliverables: row.deliverables,
    outcome: row.outcome,
    metrics: row.metrics,
    testimonial: row.testimonial ?? undefined,
    media: row.media,
  };
}

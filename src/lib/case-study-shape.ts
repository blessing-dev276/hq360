import { z } from "zod";

/** Shared validation + (de)serialization for the case_studies table. */

const metricSchema = z.object({
  label: z.string().max(120),
  value: z.string().max(120),
  note: z.string().max(240).optional().or(z.literal("")),
});

const mediaSchema = z.object({
  src: z.string().min(1).max(2000),
  alt: z.string().max(300).optional().or(z.literal("")),
  caption: z.string().max(300).optional().or(z.literal("")),
  type: z.enum(["image", "video"]).optional(),
});

const testimonialSchema = z.object({
  quote: z.string().max(1000),
  name: z.string().max(160),
  role: z.string().max(160),
});

export const caseStudyFields = {
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by hyphens"),
  status: z.enum(["verified", "sample"]),
  title: z.string().min(1).max(200),
  client: z.string().max(200).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  capabilities: z.array(z.string().min(1).max(120)).max(20),
  summary: z.string().max(600).optional().or(z.literal("")),
  challenge: z.string().max(2000).optional().or(z.literal("")),
  approach: z.array(z.string().min(1).max(600)).max(30),
  deliverables: z.array(z.string().min(1).max(300)).max(30),
  outcome: z.string().max(2000).optional().or(z.literal("")),
  metrics: z.array(metricSchema).max(12),
  testimonial: testimonialSchema.nullable(),
  media: z.array(mediaSchema).max(24),
  published: z.boolean().optional(),
};

export const createCaseStudySchema = z.object(caseStudyFields);
export type CaseStudyInput = z.infer<typeof createCaseStudySchema>;

export function normalizeMedia(media: z.infer<typeof mediaSchema>[]) {
  return media.map((m) => ({
    src: m.src,
    alt: m.alt || "",
    caption: m.caption || "",
    type: m.type ?? (m.src.toLowerCase().endsWith(".mp4") ? "video" : "image"),
  }));
}

// Plain mappers live in case-study-view (no zod) so public pages don't ship
// the validation library; re-exported here for existing imports.
export { serializeCaseStudy, toCaseStudyShape } from "./case-study-view";
export type { SerializedCaseStudy } from "./case-study-view";

export function toInsertRow(body: CaseStudyInput) {
  return {
    slug: body.slug,
    status: body.status,
    title: body.title,
    client: body.client || "",
    industry: body.industry || "",
    capabilities: body.capabilities,
    summary: body.summary || "",
    challenge: body.challenge || "",
    approach: body.approach,
    deliverables: body.deliverables,
    outcome: body.outcome || "",
    metrics: body.metrics,
    testimonial: body.testimonial,
    media: normalizeMedia(body.media),
    published: body.published ?? true,
  };
}

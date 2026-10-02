// Shared shape for expert video testimonials (table: expert_testimonials).
export type ExpertTestimonial = {
  id: string;
  client_name: string;
  client_role: string | null;
  quote: string | null;
  video_url: string;
  service_slug: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export const TESTIMONIAL_FIELDS =
  "id, client_name, client_role, quote, video_url, service_slug, status, created_at";

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** Public URL prefix an expert's own uploaded videos must start with. */
export function expertVideoPrefix(expertId: string) {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/expert-videos/${expertId}/`;
}

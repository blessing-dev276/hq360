import { z } from "zod";

/** Every v2 reviewable entity (strengths, reader-journey steps, comparables,
 * priority moves, roadmap items) shares this review vocabulary with
 * audit_findings — APPROVE / EDIT (via the entity's own fields) / REJECT /
 * NEEDS VERIFICATION, plus the client_visible gate PDF/image generation
 * reads from. */
export const reviewSchema = z.object({
  reviewStatus: z.enum(["ai_research", "needs_verification", "approved", "rejected"]).optional(),
  clientVisible: z.boolean().optional(),
});

export function reviewUpdate(body: z.infer<typeof reviewSchema>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (body.reviewStatus !== undefined) update.review_status = body.reviewStatus;
  if (body.clientVisible !== undefined) update.client_visible = body.clientVisible;
  return update;
}

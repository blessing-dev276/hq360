import { z } from "zod";
export const SALES_STAGES = [
  "needs_review",
  "qualified",
  "introduced",
  "discussion",
  "proposal",
  "invoiced",
  "won",
  "lost",
] as const;
export const PROJECT_STATUSES = [
  "not_started",
  "scoping",
  "in_progress",
  "client_review",
  "delivered",
  "ongoing",
  "on_hold",
] as const;
const safeLink = z
  .string()
  .max(2000)
  .refine(
    (value) => !value || (/^https?:\/\//i.test(value) && URL.canParse(value)),
    "Use an http or https URL",
  );
const date = z.string().date().nullable();
export const leadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email().or(z.literal("")),
  assigned_to: z.string().max(160),
  stage: z.enum(SALES_STAGES),
  check_completed_at: date,
  last_contact: date,
  next_follow_up: date,
  report_url: safeLink,
  proposal_url: safeLink,
  invoice_id: z.string().uuid().nullable(),
  agreed_service: z.string().max(500),
  project_status: z.enum(PROJECT_STATUSES),
  notes: z.string().max(10000),
});
export type SalesLead = z.infer<typeof leadSchema> & {
  id: string;
  created_at: string;
  source_kind: string;
  source_id: string | null;
  updated_at: string;
};
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

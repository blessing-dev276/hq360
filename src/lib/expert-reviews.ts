// Shared shape for screenshot-backed client reviews (table: expert_reviews).
export const REVIEW_PLATFORMS = [
  { key: "fiverr", label: "Fiverr" },
  { key: "upwork", label: "Upwork" },
  { key: "direct", label: "Direct client" },
  { key: "other", label: "Other" },
] as const;
export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number]["key"];

export type ExpertReview = {
  id: string;
  client_name: string;
  platform: ReviewPlatform;
  rating: number | null;
  review_text: string;
  review_date: string | null;
  screenshot_url: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export const REVIEW_FIELDS =
  "id, client_name, platform, rating, review_text, review_date, screenshot_url, status, created_at";

export const platformLabel = (key: string) =>
  REVIEW_PLATFORMS.find((p) => p.key === key)?.label ?? "Client";

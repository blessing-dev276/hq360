/**
 * Canonical fields staff fill in by hand for sources with no usable public
 * API (Amazon's requires an active seller account; Goodreads' was shut down
 * years ago). Each becomes one row in audit_manual_verifications, keyed by
 * `key`. Grouped to match the spec's research sections.
 */
export type VerificationField = {
  key: string;
  section: "amazon" | "goodreads" | "social" | "reader_journey" | "marketing_infra";
  label: string;
  hint?: string;
  type: "text" | "number" | "url" | "boolean";
};

export const VERIFICATION_FIELDS: VerificationField[] = [
  // Amazon
  { key: "amazon_rating", section: "amazon", label: "Star rating", type: "number" },
  { key: "amazon_review_count", section: "amazon", label: "Review count", type: "number" },
  {
    key: "amazon_bsr",
    section: "amazon",
    label: "Best Sellers Rank",
    hint: "e.g. #42,318 in Kindle Store",
    type: "text",
  },
  {
    key: "amazon_category_rank",
    section: "amazon",
    label: "Category rank(s)",
    hint: "e.g. #3 in Author Marketing",
    type: "text",
  },
  { key: "amazon_a_plus_content", section: "amazon", label: "A+ Content present", type: "boolean" },
  {
    key: "amazon_editorial_reviews",
    section: "amazon",
    label: "Editorial/other-format reviews present",
    type: "boolean",
  },
  {
    key: "amazon_author_page",
    section: "amazon",
    label: "Amazon Author Page claimed",
    type: "boolean",
  },
  // Goodreads
  { key: "goodreads_rating", section: "goodreads", label: "Average rating", type: "number" },
  { key: "goodreads_review_count", section: "goodreads", label: "Review count", type: "number" },
  { key: "goodreads_shelved_count", section: "goodreads", label: "Times shelved", type: "number" },
  {
    key: "goodreads_listopia_presence",
    section: "goodreads",
    label: "Present on any Listopia list",
    type: "boolean",
  },
  {
    key: "goodreads_listopia_detail",
    section: "goodreads",
    label: "Listopia list name(s) and rank",
    hint: 'e.g. #142 on "Best Books of 2026"',
    type: "text",
  },
  {
    key: "goodreads_author_profile",
    section: "goodreads",
    label: "Goodreads Author Program profile claimed",
    type: "boolean",
  },
  // Social / media presence
  {
    key: "social_platforms_active",
    section: "social",
    label: "Active platforms",
    hint: "e.g. Instagram, TikTok — comma separated",
    type: "text",
  },
  {
    key: "social_follower_scale",
    section: "social",
    label: "Follower scale (rough order of magnitude)",
    hint: "e.g. Instagram ~2,400; TikTok ~180",
    type: "text",
  },
  {
    key: "social_posting_cadence",
    section: "social",
    label: "Posting cadence observed",
    hint: "e.g. 2-3x/week on Instagram, dormant elsewhere",
    type: "text",
  },
  {
    key: "press_or_media_mentions",
    section: "social",
    label: "Press / media mentions found",
    type: "text",
  },
  // Reader journey / marketing infrastructure
  {
    key: "email_list_signup_present",
    section: "reader_journey",
    label: "Email list signup present on site",
    type: "boolean",
  },
  {
    key: "lead_magnet_present",
    section: "reader_journey",
    label: "Lead magnet / reader incentive present",
    type: "boolean",
  },
  {
    key: "purchase_path_clarity",
    section: "marketing_infra",
    label: "Purchase path from site to retailer",
    hint: "Direct link? Buried? Missing?",
    type: "text",
  },
  {
    key: "series_or_backlist_crosslink",
    section: "marketing_infra",
    label: "Series/backlist cross-linking observed",
    type: "boolean",
  },
];

export function fieldsBySection(section: VerificationField["section"]) {
  return VERIFICATION_FIELDS.filter((f) => f.section === section);
}

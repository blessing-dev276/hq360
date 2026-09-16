/**
 * Canonical fields staff fill in by hand for research areas with no
 * reliable free API (Amazon requires an active seller account; Goodreads'
 * was shut down years ago; a real search-visibility check would need a paid
 * Google/Bing API key that isn't configured). Each becomes one row in
 * audit_manual_verifications, keyed by `key`. Sections mirror the audit's
 * research categories 1:1 so the admin UI and the report can both group by
 * the same taxonomy.
 */
export type VerificationSection =
  "book" | "amazon" | "goodreads" | "search" | "website" | "social" | "media" | "owned_audience";

export type VerificationField = {
  key: string;
  section: VerificationSection;
  label: string;
  hint?: string;
  type: "text" | "number" | "url" | "boolean";
};

export const SECTION_LABEL: Record<VerificationSection, string> = {
  book: "Book presence",
  amazon: "Amazon",
  goodreads: "Goodreads",
  search: "Search visibility",
  website: "Author website",
  social: "Social",
  media: "Media & authority",
  owned_audience: "Owned audience",
};

export const VERIFICATION_FIELDS: VerificationField[] = [
  // Book presence — beyond what Google Books / Open Library return automatically.
  { key: "book_publisher_imprint", section: "book", label: "Publisher / imprint", type: "text" },
  {
    key: "book_formats_available",
    section: "book",
    label: "Formats available",
    hint: "e.g. hardcover, paperback, ebook, audiobook",
    type: "text",
  },
  {
    key: "book_retailer_presentation",
    section: "book",
    label: "Retailer presentation notes",
    hint: "How the book is presented where it's actually sold",
    type: "text",
  },

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
    key: "amazon_author_central",
    section: "amazon",
    label: "Author Central profile claimed",
    type: "boolean",
  },
  {
    key: "amazon_series_connection",
    section: "amazon",
    label: "Series connection shown on listing",
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

  // Search visibility — no paid search API is configured; record what a
  // manual search actually showed.
  {
    key: "search_author_name",
    section: "search",
    label: "Author-name search result",
    hint: "What appears for the author's name",
    type: "text",
  },
  { key: "search_book_title", section: "search", label: "Book-title search result", type: "text" },
  {
    key: "search_author_book",
    section: "search",
    label: "Author + book search result",
    type: "text",
  },
  {
    key: "search_topic",
    section: "search",
    label: "Relevant topic search result",
    hint: "A subject the book covers",
    type: "text",
  },

  // Author website
  {
    key: "website_purchase_path",
    section: "website",
    label: "Purchase path from site to retailer",
    hint: "Direct link? Buried? Missing?",
    type: "text",
  },
  {
    key: "website_backlist_crosslink",
    section: "website",
    label: "Series/backlist cross-linking observed",
    type: "boolean",
  },
  {
    key: "website_mobile_experience",
    section: "website",
    label: "Mobile experience notes",
    type: "text",
  },
  { key: "website_broken_links", section: "website", label: "Broken links found", type: "text" },
  {
    key: "website_seo_basics",
    section: "website",
    label: "SEO basics (title/meta/headings) notes",
    type: "text",
  },
  {
    key: "website_structured_data",
    section: "website",
    label: "Structured data (schema.org) present",
    type: "boolean",
  },

  // Social
  {
    key: "social_platforms_active",
    section: "social",
    label: "Active platforms",
    hint: "e.g. Instagram, TikTok — comma separated",
    type: "text",
  },
  {
    key: "social_profile_consistency",
    section: "social",
    label: "Profile consistency across platforms",
    type: "text",
  },
  {
    key: "social_book_visibility",
    section: "social",
    label: "Book visibility in profile/pinned content",
    type: "text",
  },
  {
    key: "social_posting_cadence",
    section: "social",
    label: "Posting cadence observed",
    hint: "e.g. 2-3x/week on Instagram, dormant elsewhere",
    type: "text",
  },

  // Media & authority
  {
    key: "media_press_mentions",
    section: "media",
    label: "Press / media mentions found",
    type: "text",
  },
  {
    key: "media_podcast_interviews",
    section: "media",
    label: "Podcast/interview appearances found",
    type: "text",
  },
  {
    key: "media_speaking_credentials",
    section: "media",
    label: "Speaking engagements / credentials found",
    type: "text",
  },
  { key: "media_awards", section: "media", label: "Awards found (verified only)", type: "text" },

  // Owned audience
  {
    key: "owned_email_signup_present",
    section: "owned_audience",
    label: "Email list signup present on site",
    type: "boolean",
  },
  {
    key: "owned_lead_magnet_present",
    section: "owned_audience",
    label: "Lead magnet / reader incentive present",
    type: "boolean",
  },
  {
    key: "owned_signup_location",
    section: "owned_audience",
    label: "Where the signup sits in the reader journey",
    hint: "e.g. homepage hero, footer only, not found",
    type: "text",
  },
];

export function fieldsBySection(section: VerificationSection) {
  return VERIFICATION_FIELDS.filter((f) => f.section === section);
}

export const VERIFICATION_SECTIONS: VerificationSection[] = [
  "book",
  "amazon",
  "goodreads",
  "search",
  "website",
  "social",
  "media",
  "owned_audience",
];

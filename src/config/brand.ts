/**
 * HQ360 brand configuration.
 *
 * Single source of truth for brand identity, navigation and social links.
 * HQ360 is the only public-facing brand. "House of Synergy" is retained only as
 * company history on the About page.
 */

const ENV_SITE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  (typeof process !== "undefined" && process.env?.SITE_URL) ||
  "";

export const BRAND = {
  name: "HQ360",
  legalName: "HQ360",
  formerlyKnownAs: "House of Synergy",
  /** Public site URL, used for canonical + Open Graph absolute URLs. */
  // Production domain. Override per-environment with SITE_URL / VITE_SITE_URL.
  siteUrl: (ENV_SITE_URL || "https://www.hq360.space")
    .replace(/^https?:\/\/(?:www\.)?hq360\.space(?=\/|$)/, "https://www.hq360.space")
    .replace(/\/$/, ""),
  email: "ceo@hq360.space",
  /** Display format. */
  whatsapp: "+1 (361) 466-0223",
  /** wa.me deep link — digits only, no "+". */
  whatsappHref: "https://wa.me/13614660223",
  tagline: "Everything your brand needs to grow.",
  /** One-paragraph positioning, reused in meta descriptions and the footer. */
  positioning:
    "HQ360 is a multi-industry growth agency. We surround a business with the strategy, creative, technology and marketing it needs to get seen, earn trust and turn attention into customers.",
  /** Short descriptor for schema.org and OG site name. */
  descriptor: "Multi-industry growth agency",
  serviceArea: "Working with ambitious businesses and personal brands worldwide.",
} as const;

export const CTAS = {
  primary: { label: "Start a Project", to: "/contact" },
  work: { label: "Explore Our Work", to: "/work" },
  industries: { label: "Explore Industries", to: "/industries" },
  audit: { label: "Request a Growth Audit", to: "/contact" },
} as const;

/**
 * Industry links shown in the header mega menu. The full list lives in
 * `src/data/industries.ts`; this is the curated shortlist plus a catch-all.
 */
export const INDUSTRY_MENU: { label: string; to: string }[] = [
  { label: "Authors & Publishers", to: "/authors" },
  { label: "Real Estate", to: "/real-estate" },
  { label: "Content Creators", to: "/creators" },
  { label: "Coaches & Consultants", to: "/coaches" },
  { label: "E-commerce & DTC", to: "/ecommerce" },
  { label: "Home Services", to: "/home-services" },
  { label: "Med Spas & Beauty", to: "/med-spas" },
  { label: "Law & Professional Services", to: "/law-firms" },
  { label: "Agencies", to: "/agencies" },
];

export const CAPABILITY_MENU: { label: string; to: string; blurb: string }[] = [
  {
    label: "Brand & Creative",
    to: "/services/brand-creative",
    blurb: "Identity, design and creative direction that make a brand recognisable.",
  },
  {
    label: "Website & Funnel",
    to: "/services/websites-funnels",
    blurb: "Sites and landing pages built to turn attention into action.",
  },
  {
    label: "CRM Automation",
    to: "/services/crm-automation",
    blurb: "Pipelines and follow-up that work without manual chasing.",
  },
  {
    label: "Writing & Translation",
    to: "/services/writing-translation",
    blurb: "Writing, editing and translation that keep every message clear and on-brand.",
  },
  {
    label: "Social Media Marketing",
    to: "/services/lead-generation",
    blurb: "Consistent, qualified demand from advertising and outreach.",
  },
  {
    label: "Ai Video & Video Editing",
    to: "/services/content-social",
    blurb: "Visibility that keeps a brand in front of the right audience.",
  },
  {
    label: "SEO",
    to: "/services/visibility-reputation",
    blurb: "Search presence, reviews and press that build credibility.",
  },
  {
    label: "Mobile App Development",
    to: "/services/mobile-app-development",
    blurb: "Mobile products designed around the journeys your customers use most.",
  },
  {
    label: "Game Development",
    to: "/services/game-development",
    blurb: "Interactive experiences designed to be played, shared and remembered.",
  },
];

export const PRIMARY_NAV: {
  label: string;
  to?: string;
  menu?: "industries" | "capabilities" | "about";
}[] = [
  { label: "Industries", menu: "industries" },
  { label: "Services", menu: "capabilities" },
  { label: "Work", to: "/work" },
  { label: "About", menu: "about" },
  { label: "Insights", to: "/insights" },
];

/** The About nav dropdown: the agency story, and the people behind it. */
export const ABOUT_MENU: { label: string; to: string; blurb: string }[] = [
  {
    label: "Our Agency",
    to: "/about",
    blurb: "Why HQ360 exists and how a single connected team builds growth.",
  },
  {
    label: "Meet the Team",
    to: "/team",
    blurb: "The people on your account, and what each of them owns.",
  },
];

export const FOOTER_NAV: { heading: string; links: { label: string; to: string }[] }[] = [
  {
    heading: "Industries",
    links: [
      { label: "Authors & Publishers", to: "/authors" },
      { label: "Real Estate", to: "/real-estate" },
      { label: "Content Creators", to: "/creators" },
      { label: "Coaches & Consultants", to: "/coaches" },
      { label: "E-commerce & DTC", to: "/ecommerce" },
      { label: "Home Services", to: "/home-services" },
      { label: "All industries", to: "/industries" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Brand & Creative", to: "/services/brand-creative" },
      { label: "Website & Funnel", to: "/services/websites-funnels" },
      { label: "CRM Automation", to: "/services/crm-automation" },
      { label: "Writing & Translation", to: "/services/writing-translation" },
      { label: "Social Media Marketing", to: "/services/lead-generation" },
      { label: "Ai Video & Video Editing", to: "/services/content-social" },
      { label: "SEO", to: "/services/visibility-reputation" },
      { label: "Mobile App Development", to: "/services/mobile-app-development" },
      { label: "Game Development", to: "/services/game-development" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Team", to: "/team" },
      { label: "Work", to: "/work" },
      { label: "Insights", to: "/insights" },
      { label: "FAQs", to: "/faqs" },
      { label: "Glossary", to: "/insights/glossary" },
      { label: "Start a Project", to: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

/** Only real, verified profiles are listed. Add more as they go live. */
export const SOCIALS: { label: string; href: string }[] = [
  { label: "WhatsApp", href: BRAND.whatsappHref },
  { label: "Instagram", href: "https://www.instagram.com/official_hq360/" },
  { label: "Twitter", href: "https://twitter.com/official_hq360" },
  { label: "TikTok", href: "https://www.tiktok.com/@official_hq360" },
];

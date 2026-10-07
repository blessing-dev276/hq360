import { AUDIENCES, CORE_SERVICES } from "@/data/agency";
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
  tagline: "Websites, apps, systems and content.",
  /** One-paragraph positioning, reused in meta descriptions and the footer. */
  positioning:
    "HQ360 builds websites, mobile apps and automation systems, and provides writing, translation and digital marketing for businesses.",
  /** Short descriptor for schema.org and OG site name. */
  descriptor: "Digital services and content agency",
  serviceArea: "Working with businesses, creators, authors and agency teams.",
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
export const INDUSTRY_MENU = AUDIENCES.map((audience) => ({
  label: audience.name,
  to: `/${audience.slug}`,
}));

export const CAPABILITY_MENU = CORE_SERVICES.map((offer) => ({
  label: offer.name,
  to: `/services/${offer.slug}`,
  blurb: offer.description,
}));

export const PRIMARY_NAV: {
  label: string;
  to?: string;
  menu?: "industries" | "capabilities" | "about" | "resources";
}[] = [
  { label: "Services", menu: "capabilities" },
  { label: "Who We Help", menu: "industries" },
  { label: "Our Work", to: "/work" },
  { label: "Pricing", to: "/pricing" },
  { label: "Experts", to: "/experts" },
  { label: "About", to: "/about" },
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
    to: "/about",
    blurb: "The people on your account, and what each of them owns.",
  },
  {
    label: "Our Experts",
    to: "/experts",
    blurb: "The HQ360 team and approved independent experts, with a profile for each.",
  },
  {
    label: "Become an Expert",
    to: "/expert-signup",
    blurb: "Apply to join the expert network and publish your own profile.",
  },
];

export const FOOTER_NAV = [
  { heading: "Services", links: CAPABILITY_MENU },
  { heading: "Who We Help", links: INDUSTRY_MENU },
  {
    heading: "Explore",
    links: [
      { label: "Authors & Publishers", to: "/authors" },
      { label: "Our Work", to: "/work" },
      { label: "Pricing", to: "/pricing" },
      { label: "Resources", to: "/resources" },
      { label: "Tools", to: "/tools" },
      { label: "Free Visibility Check", to: "/tools/author-visibility-audit" },
      { label: "Our Experts", to: "/experts" },
      { label: "Become an Expert", to: "/expert-signup" },
      { label: "About", to: "/about" },
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

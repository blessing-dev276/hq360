/** Public USD starting prices. Every project receives an agreed written scope. */
export type ServicePrice = {
  key: string;
  name: string;
  serviceSlug: string;
  price: string;
  unit: string;
  included: string;
  note: string;
};

export const SERVICE_PRICES: ServicePrice[] = [
  {
    key: "website-development",
    name: "Website Development",
    serviceSlug: "website-development",
    price: "$299",
    unit: "project",
    included: "Up to five responsive pages, a contact form and basic on-page setup.",
    note: "Content, hosting and added integrations are scoped separately.",
  },
  {
    key: "mobile-app-development",
    name: "Mobile App Development",
    serviceSlug: "mobile-app-development",
    price: "$9,999",
    unit: "first release",
    included: "A focused app with one agreed core workflow, design, build and testing.",
    note: "Platforms, accounts, backend work and store submission determine the final quote.",
  },
  {
    key: "automation-crm",
    name: "Automation & CRM",
    serviceSlug: "automation-crm",
    price: "$499",
    unit: "setup",
    included: "One pipeline, inquiry connection and an agreed follow-up workflow.",
    note: "CRM subscriptions, messaging costs and data migration are separate.",
  },
  {
    key: "writing-editing",
    name: "Writing & Editing",
    serviceSlug: "writing-editing",
    price: "$150",
    unit: "short piece",
    included: "One agreed short page or piece of up to 500 words, with one revision round.",
    note: "Book manuscripts, research-heavy work and structural editing require a sample and quote.",
  },
  {
    key: "translation",
    name: "Translation & Localization",
    serviceSlug: "writing-editing",
    price: "$100",
    unit: "short document",
    included:
      "A straightforward document of up to 500 source words, subject to language availability.",
    note: "Language pair, specialist review, formatting and certification are confirmed before quoting.",
  },
  {
    key: "digital-marketing",
    name: "Digital Marketing",
    serviceSlug: "digital-marketing",
    price: "$299",
    unit: "month",
    included: "A focused plan and management of one agreed channel, with monthly reporting.",
    note: "Ad spend, creative volume and platform charges are separate.",
  },
];

export const getServicePrices = (slug: string) =>
  SERVICE_PRICES.filter((item) => item.serviceSlug === slug);

export type AudiencePackage = {
  slug: string;
  audience: string;
  name: string;
  price: string;
  unit: string;
  summary: string;
  items: string[];
  note: string;
};

export const AUDIENCE_PACKAGES: AudiencePackage[] = [
  {
    slug: "authors",
    audience: "Authors & Publishers",
    name: "Author Platform Starter",
    price: "$249",
    unit: "project",
    summary: "A simple home for your book and reader list.",
    items: [
      "Author website with one book page",
      "Retailer links and reader signup",
      "Free visibility check",
    ],
    note: "Manuscript work, publishing files, detailed reports and marketing are scoped separately.",
  },
  {
    slug: "ugc-creators",
    audience: "UGC Creators",
    name: "Creator Portfolio Starter",
    price: "$299",
    unit: "project",
    summary: "Present your work and receive useful brand briefs.",
    items: [
      "Portfolio website of up to five pages",
      "Organised work samples",
      "Brand inquiry form",
    ],
    note: "Video editing, media-kit writing and ongoing outreach are separate scopes.",
  },
  {
    slug: "agencies",
    audience: "Agencies",
    name: "Agency Delivery Sprint",
    price: "$799",
    unit: "project",
    summary: "A defined website and lead workflow for one client brief.",
    items: [
      "Up to ten website pages or a focused funnel",
      "One CRM inquiry pipeline",
      "Consolidated review and handover",
    ],
    note: "Mobile apps, writing, translation and ongoing capacity are quoted for each brief.",
  },
  {
    slug: "cleaning-businesses",
    audience: "Cleaning Businesses",
    name: "Cleaning Inquiry System",
    price: "$799",
    unit: "project",
    summary: "Explain your service area and turn requests into organised estimates.",
    items: [
      "Service website of up to ten pages",
      "Quote or estimate request form",
      "One CRM follow-up workflow",
    ],
    note: "Complex booking, SMS charges and custom estimating rules are scoped separately.",
  },
  {
    slug: "appointment-based-businesses",
    audience: "Appointment-Based Businesses",
    name: "Booking Foundations",
    price: "$799",
    unit: "project",
    summary: "Give customers a clear route from service page to appointment.",
    items: [
      "Booking website of up to ten pages",
      "Connection to a suitable scheduling tool",
      "Confirmation or reminder workflow",
    ],
    note: "Booking subscriptions, deposits and complex calendar rules are scoped separately.",
  },
  {
    slug: "local-businesses",
    audience: "Local Businesses",
    name: "Local Website Starter",
    price: "$299",
    unit: "project",
    summary: "Make your services, coverage and contact route easy to find.",
    items: [
      "Website of up to five pages",
      "Contact or quote request form",
      "Basic local-page content setup",
    ],
    note: "Bookings, CRM workflows and ongoing visibility support are separate scopes.",
  },
];

export const getAudiencePackage = (slug: string) =>
  AUDIENCE_PACKAGES.find((item) => item.slug === slug);

/** Three existing homepage offers remain as compact package highlights. */
export type Plan = {
  name: string;
  price: string;
  cadence: string;
  note: string;
  items: string[];
  tag?: string;
  featured?: boolean;
};
export const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$299",
    cadence: "one-time",
    note: "A clean, professional start online.",
    items: [
      "Up to 5-page mobile-friendly website",
      "Contact form connected to your email",
      "Basic SEO set-up and 2 revision rounds",
    ],
  },
  {
    name: "Growth",
    price: "$799",
    cadence: "one-time",
    tag: "Best value",
    note: "For businesses ready to connect the pieces.",
    items: [
      "Up to 10-page website or sales funnel",
      "CRM set-up with automated follow-ups",
      "30 days of support after launch",
    ],
    featured: true,
  },
  {
    name: "Author",
    price: "$249",
    cadence: "one-time",
    note: "For authors and publishers.",
    items: [
      "Author website with a book page",
      "Retailer links and newsletter sign-up",
      "Free author visibility check included",
    ],
  },
];
/** Stable key for a plan, used by the website checkout ("starter", "growth"…). */
export const planKey = (plan: Plan) => plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
/** "$1,299" -> 129900 (US cents). */
export const planAmountMinor = (plan: Plan) =>
  Math.round(Number(plan.price.replace(/[^\d.]/g, "")) * 100);
export const getPlan = (key: string) => PLANS.find((plan) => planKey(plan) === key);

export const CARE_PLAN = { price: "$49", cadence: "/month" };
export const PRICING_NOTES = [
  "All prices are starting points in USD; a written proposal confirms deliverables and the final amount.",
  "Hosting, software subscriptions, messaging fees and ad spend are outside the package price unless expressly included.",
];

import { z } from "zod";

const words = z
  .string()
  .trim()
  .max(4000)
  .regex(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i, "Use plain text");
export const SIGNALS = [
  "relevant_goodreads_list",
  "category_mismatch",
  "listing_content_gap",
  "author_page_gap",
  "enhanced_content_gap",
  "launch_plan",
  "consented_audience",
  "media_asset",
  "distribution_gap",
  "audio_demand",
  "video_objective",
  "website_journey_gap",
  "backlist_decline",
  "positioning_uncertainty",
  "signup_gap",
  "goodreads_engagement",
  "media_kit_gap",
  "visual_audience",
  "advance_review_plan",
  "discussion_potential",
  "local_campaign",
] as const;
export type Signal = (typeof SIGNALS)[number];
export const PHASES = [
  "Immediate priorities",
  "Foundation and preparation",
  "Audience acquisition",
  "Reader conversion and retention",
  "Longer-term growth",
] as const;
export type Service = {
  id: string;
  name: string;
  description: string;
  problems: string[];
  signals: Signal[];
  eligibility: string[];
  requiredEvidence: string[];
  deliverables: string[];
  prerequisites: string[];
  complexity: "low" | "medium" | "high";
  primaryKpi: string;
  secondaryKpis: string[];
  suitableFor: string[];
  exclusions: string[];
  phase: (typeof PHASES)[number];
  beforePromotion: boolean;
  enabled: boolean;
  landingUrl: string | null;
  pricing: Pricing;
};
export const pricingSchema = z
  .object({
    quoteRequired: z.boolean(),
    amount: z.number().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
  })
  .strict()
  .refine(
    (p) => (p.quoteRequired ? p.amount === null : p.amount !== null && p.currency !== null),
    "Provide an amount and currency, or request a quote without an amount",
  );
export type Pricing = z.infer<typeof pricingSchema>;
const quote: Pricing = { quoteRequired: true, amount: null, currency: null };
function service(
  id: string,
  name: string,
  signal: Signal,
  description: string,
  deliverables: string[],
  eligibility: string[],
  exclusions: string[],
  phase: Service["phase"],
  primaryKpi: string,
  prerequisites: string[] = [],
  complexity: Service["complexity"] = "medium",
): Service {
  return {
    id,
    name,
    signals: [signal],
    description,
    problems: [description],
    deliverables,
    eligibility,
    requiredEvidence: [`Cited evidence of ${signal.replaceAll("_", " ")} for this author and book`],
    exclusions,
    phase,
    primaryKpi,
    secondaryKpis: [
      "Completion of agreed deliverables",
      "Baseline and follow-up observations where access is available",
    ],
    prerequisites: ["Author approval of scope and access", ...prerequisites],
    complexity,
    suitableFor: eligibility,
    beforePromotion: phase === PHASES[0] || phase === PHASES[1],
    enabled: true,
    landingUrl: null,
    pricing: quote,
  };
}
export const SERVICES: Service[] = [
  service(
    "goodreads-listopia",
    "Goodreads Listopia Placement",
    "relevant_goodreads_list",
    "Review book fit for specific reader-maintained lists.",
    [
      "Relevant-list shortlist with eligibility checks",
      "Permitted participation plan and placement monitoring",
    ],
    ["A specific list and book fit are documented", "List rules permit participation"],
    [
      "No guaranteed ranking, votes or third-party placement",
      "A limited search does not prove absence from all lists",
    ],
    PHASES[2],
    "Relevant eligible lists assessed and observed inclusion",
    ["Check each list's rules"],
  ),
  service(
    "amazon-keywords-categories",
    "Amazon Keyword and Category Optimization",
    "category_mismatch",
    "Resolve a documented mismatch between book positioning and metadata.",
    ["Evidence-based category and search-term brief", "Approved metadata change log"],
    ["Actual category or keyword mismatch is documented"],
    ["Low rank alone is not a category problem", "No guaranteed rank or sales"],
    PHASES[1],
    "Relevant metadata corrections accepted",
    ["Publisher or account-owner metadata access"],
  ),
  service(
    "amazon-listing",
    "Amazon Listing Optimization",
    "listing_content_gap",
    "Improve verified gaps in a book's retailer presentation.",
    ["Revised listing copy", "Edition and purchase-path checklist"],
    ["An inspected listing has a specific content or navigation gap"],
    ["Do not rewrite a working listing solely because rank is low"],
    PHASES[0],
    "Documented listing gaps resolved",
    ["Publisher approval and listing access"],
  ),
  service(
    "author-central",
    "Author Central Page Setup",
    "author_page_gap",
    "Connect verified author identity and books on Amazon.",
    ["Author-page setup or correction brief", "Biography and book association checklist"],
    ["A specific author-page gap is observed"],
    ["Search absence alone does not prove no author page exists"],
    PHASES[1],
    "Correct book and author associations",
    ["Author account verification"],
  ),
  service(
    "amazon-a-plus",
    "Amazon A+ Content",
    "enhanced_content_gap",
    "Prepare enhanced book content where account eligibility is confirmed.",
    ["Approved content modules and image brief", "Submission checklist"],
    ["An inspected listing lacks useful enhanced content", "Account eligibility must be confirmed"],
    ["Do not promise Amazon approval"],
    PHASES[1],
    "Approved modules published",
    ["Eligibility, rights to artwork and publisher access"],
  ),
  service(
    "bestseller-campaign",
    "Amazon Bestseller Campaign",
    "launch_plan",
    "Plan a measured launch campaign around a documented release objective.",
    ["Launch positioning and channel plan", "Campaign measurement report"],
    ["A release objective, budget and ethical promotion plan are agreed"],
    ["Never guarantee bestseller status, rank, reviews or sales"],
    PHASES[2],
    "Qualified retailer visits and observed sales where shared",
    ["Listing readiness", "Agreed budget and campaign tracking"],
    "high",
  ),
  service(
    "email-campaign",
    "Email Marketing Campaign",
    "consented_audience",
    "Develop reader communications for a permission-based audience.",
    ["Segment and campaign brief", "Approved email sequence and performance report"],
    ["A consented audience or documented audience-building objective exists"],
    [
      "No bought lists or assumed newsletter absence",
      "No guaranteed open, conversion or sales rates",
    ],
    PHASES[3],
    "Consented subscriber engagement",
    ["Consent records, sender access and unsubscribe handling"],
  ),
  service(
    "podcast-press",
    "Podcast and Press Placement",
    "media_asset",
    "Develop relevant media angles from documented author assets.",
    ["Author-specific pitch angles", "Researched media shortlist and outreach log"],
    ["Verified award, expertise, interview or distinctive story"],
    ["Achievements are assets, not failures", "Editorial coverage and bookings are not guaranteed"],
    PHASES[2],
    "Relevant responses and confirmed interviews",
    ["Approved biography and media materials"],
  ),
  service(
    "distribution",
    "Multi-Channel Distribution",
    "distribution_gap",
    "Investigate documented format or territorial purchase gaps.",
    ["Rights and existing-distributor review", "Retailer/territory availability plan"],
    ["A specific availability gap is verified", "Rights and current agreements must be checked"],
    [
      "Listing is not physical bookstore stocking",
      "No publishing acquisition or overlapping agreements promised",
    ],
    PHASES[1],
    "Verified accessible listings in agreed formats and territories",
    ["Rights, contracts and distributor approval"],
    "high",
  ),
  service(
    "audiobook",
    "Audiobook Production and Promotion",
    "audio_demand",
    "Assess an evidence-backed audio opportunity before production.",
    ["Audio feasibility and rights brief", "Production and promotion scope for approval"],
    ["Audio audience interest is evidenced", "Audio rights and existing editions must be checked"],
    ["No production recommendation from missing search results alone"],
    PHASES[4],
    "Agreed production milestones and listening metrics",
    ["Audio rights, budget and production approval"],
    "high",
  ),
  service(
    "book-trailer",
    "Book Video Trailer",
    "video_objective",
    "Create a video concept for an evidenced campaign use case.",
    ["Storyboard and approved trailer scope", "Channel delivery specifications"],
    ["Documented video audience/channel objective"],
    ["Do not propose video without a distribution use case"],
    PHASES[2],
    "Qualified video engagement and tracked visits",
    ["Artwork/music rights and approved script"],
  ),
  service(
    "author-website",
    "Author Website Design",
    "website_journey_gap",
    "Repair documented barriers in the author's reader journey.",
    ["Purchase and reader-navigation plan", "Approved page designs and implementation scope"],
    ["Inspected pages contain a specific navigation or conversion-path issue"],
    ["Do not infer no website from search absence"],
    PHASES[0],
    "Reader tasks completed on inspected pages",
    ["Domain/content access and approved requirements"],
    "high",
  ),
  service(
    "backlist-revival",
    "Backlist Revival Campaign",
    "backlist_decline",
    "Reintroduce an older title when performance evidence supports intervention.",
    ["Backlist performance diagnosis", "Relaunch scope and measurement plan"],
    ["Publication age and dated performance decline are documented"],
    [
      "Age or one low rank observation alone is insufficient",
      "Do not invent a backlist for a debut",
    ],
    PHASES[4],
    "Agreed readership indicators against a supplied baseline",
    ["Dated performance history and rights review"],
  ),
  service(
    "genre-research",
    "Genre Competitor Research",
    "positioning_uncertainty",
    "Resolve a documented positioning question using comparable books.",
    ["Relevant comparable-title study", "Positioning recommendations with sources"],
    ["A specific genre/audience positioning question exists"],
    ["No copying competitors or inferring category mismatch from rank"],
    PHASES[1],
    "Evidence-backed positioning decisions",
    ["Author objectives and relevant comparables"],
  ),
  service(
    "reader-magnet",
    "Reader Magnet Funnel",
    "signup_gap",
    "Create an opt-in reader path where inspected pages show a gap.",
    ["Reader-offer concept and signup journey", "Welcome-sequence scope and measurement setup"],
    ["A page-scoped signup gap or audience-development objective is documented"],
    ["One page without a signup does not mean no newsletter exists"],
    PHASES[1],
    "Consented signups from the agreed entry point",
    ["Confirm existing newsletter tools", "Offer rights, consent copy and sender setup"],
  ),
  service(
    "goodreads-news",
    "Goodreads News and Interviews",
    "goodreads_engagement",
    "Plan relevant Goodreads author communications.",
    ["Author news and interview brief", "Permitted publishing and engagement calendar"],
    ["Documented Goodreads presence and relevant reader engagement opportunity"],
    [
      "Low review counts do not establish poor conversion",
      "No promised reviews or platform placements",
    ],
    PHASES[2],
    "Permitted author updates and reader engagement",
    ["Author profile access and platform rules"],
  ),
  service(
    "media-kit",
    "Media Kit Creation",
    "media_kit_gap",
    "Organize verified author assets for media use.",
    ["Sourced author biography and book fact sheet", "Approved press assets and interview topics"],
    ["Documented media assets or an inspected media-material gap"],
    ["No invented awards, endorsements or publisher relationships"],
    PHASES[1],
    "Complete and approved media materials",
    ["Verified facts and image permissions"],
  ),
  service(
    "pinterest",
    "Pinterest Book Marketing",
    "visual_audience",
    "Plan discovery for a documented visual audience.",
    ["Audience and board plan", "Approved pin concepts and tracking brief"],
    ["Relevant audience evidence and visual assets are available"],
    ["Do not recommend based only on service availability"],
    PHASES[2],
    "Qualified outbound visits",
    ["Image rights and channel access"],
  ),
  service(
    "netgalley",
    "NetGalley Campaign",
    "advance_review_plan",
    "Prepare a review-copy campaign for an evidenced release plan.",
    ["Review-copy readiness plan", "Campaign scope and review-response tracking"],
    ["A review-copy objective and eligible edition are documented"],
    ["No guaranteed reviews, favorable reviews or partnership claims"],
    PHASES[2],
    "Qualified review-copy requests and voluntary reviews",
    ["Distribution rights, platform eligibility and approved fees"],
  ),
  service(
    "book-clubs",
    "Book Club Outreach",
    "discussion_potential",
    "Build a reader-discussion approach around documented themes.",
    ["Discussion-guide outline", "Relevant club shortlist and outreach plan"],
    ["Documented themes and relevant reader/community fit"],
    ["No promised club selections or bulk purchases"],
    PHASES[2],
    "Relevant club responses and confirmed discussions",
    ["Author availability and review-copy permissions"],
  ),
  service(
    "billboards",
    "Billboards",
    "local_campaign",
    "Assess outdoor promotion for a specific evidenced local objective.",
    ["Local audience and site feasibility brief", "Creative and supplier quote scope"],
    ["Local audience, budget and measurable campaign objective are documented"],
    [
      "No outdoor spend without geographic evidence and budget",
      "No guaranteed exposure-to-sales conversion",
    ],
    PHASES[4],
    "Tracked local campaign responses",
    ["Supplier availability, artwork and approved budget"],
    "high",
  ),
];
export const serviceOverrideSchema = z
  .object({
    enabled: z.boolean(),
    pricing: pricingSchema,
    landingUrl: z
      .string()
      .url()
      .refine((v) => v.startsWith("https://"), "Use HTTPS")
      .nullable(),
  })
  .strict();
export const bundleSchema = z
  .object({
    id: words
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    name: words.min(1).max(160),
    description: words,
    serviceIds: z
      .array(z.string().refine((id) => SERVICES.some((s) => s.id === id), "Unknown service"))
      .min(2)
      .max(21),
    enabled: z.boolean(),
    pricing: pricingSchema,
  })
  .strict();
export const commercialConfigSchema = z
  .object({
    services: z
      .record(serviceOverrideSchema)
      .refine(
        (v) => Object.keys(v).every((id) => SERVICES.some((s) => s.id === id)),
        "Unknown service",
      ),
    bundles: z
      .array(bundleSchema)
      .max(30)
      .refine((v) => new Set(v.map((b) => b.id)).size === v.length, "Duplicate bundle ID"),
  })
  .strict();
export type CommercialConfig = z.infer<typeof commercialConfigSchema>;
export const DEFAULT_COMMERCIAL_CONFIG: CommercialConfig = {
  services: {},
  bundles: [
    {
      id: "amazon-positioning",
      name: "Amazon Positioning Package",
      description: "Coordinate supported Amazon presentation work.",
      serviceIds: [
        "amazon-keywords-categories",
        "amazon-listing",
        "author-central",
        "amazon-a-plus",
      ],
      enabled: true,
      pricing: quote,
    },
    {
      id: "goodreads-engagement",
      name: "Goodreads Reader Engagement Package",
      description: "Coordinate relevant reader engagement.",
      serviceIds: ["goodreads-listopia", "goodreads-news", "book-clubs", "email-campaign"],
      enabled: true,
      pricing: quote,
    },
    {
      id: "international-growth",
      name: "International Reader Growth Package",
      description: "Coordinate evidenced international audience opportunities.",
      serviceIds: [
        "amazon-keywords-categories",
        "email-campaign",
        "podcast-press",
        "goodreads-listopia",
      ],
      enabled: false,
      pricing: quote,
    },
    {
      id: "author-authority",
      name: "Author Authority Package",
      description: "Prepare verified author assets before relevant outreach.",
      serviceIds: ["podcast-press", "media-kit", "author-website", "email-campaign"],
      enabled: true,
      pricing: quote,
    },
  ],
};
export const configuredServices = (config = DEFAULT_COMMERCIAL_CONFIG) =>
  SERVICES.map((s) => ({ ...s, ...config.services[s.id] }));

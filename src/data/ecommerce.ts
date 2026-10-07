/**
 * E-commerce & DTC vertical — bespoke content that sits on top of the shared
 * IndustryPage (see src/data/industries.ts entry "ecommerce"). Rendered by
 * <EcommerceSections /> and injected through IndustryPage's `beforeCta` slot.
 *
 * No fabricated brands, metrics, ROAS or testimonials. No guaranteed rankings
 * or revenue. Platform claims cover Shopify and WooCommerce only.
 */

export type EcommerceServiceGroup = {
  label: string;
  items: string[];
};

export type EcommerceStage = {
  number: string;
  slug: string;
  verb: string;
  category: string;
  headline: string;
  businessOutcome: string;
  serviceGroups: EcommerceServiceGroup[];
  /** One-line note on how this stage hands off to the next. */
  flowTo: string;
};

/** The seven connected stages of the HQ360 e-commerce growth system. */
export const ECOMMERCE_STAGES: EcommerceStage[] = [
  {
    number: "01",
    slug: "position",
    verb: "Position",
    category: "Brand & Creative",
    headline: "Make the product and brand feel worth buying.",
    businessOutcome:
      "Product → professional presentation → trust → desire → purchase confidence. Brand and creative here are commercial, not decoration.",
    serviceGroups: [
      {
        label: "Brand strategy",
        items: [
          "E-commerce and DTC brand positioning",
          "Audience and product positioning",
          "Value proposition and brand messaging",
          "Competitive positioning and product differentiation",
        ],
      },
      {
        label: "Visual identity",
        items: [
          "Logo, wordmark and brand identity",
          "Colour system and typography",
          "E-commerce and social visual system",
          "Campaign art direction",
        ],
      },
      {
        label: "Product & offer creative",
        items: [
          "Product-page and feature graphics",
          "Comparison, bundle and offer graphics",
          "Lifestyle creative and product mockups",
          "Photography and product-video direction",
        ],
      },
      {
        label: "Ad creative",
        items: [
          "Meta and TikTok creative",
          "Static ads and short-form video concepts",
          "UGC creative direction",
          "Promotional campaign creative",
        ],
      },
    ],
    flowTo: "A brand and creative system the storefront can convert with.",
  },
  {
    number: "02",
    slug: "convert",
    verb: "Convert",
    category: "E-commerce Website & CRO",
    headline: "Turn store visits into customers.",
    businessOutcome:
      "Visitor → product discovery → product evaluation → add to cart → checkout → customer. Built on Shopify or WooCommerce.",
    serviceGroups: [
      {
        label: "Storefront",
        items: [
          "Shopify and WooCommerce design and redesign",
          "Homepage, collection and category pages",
          "Navigation, site search and product filtering",
          "Campaign and landing pages",
        ],
      },
      {
        label: "Product pages",
        items: [
          "Product-page structure and layout",
          "Benefit and feature communication",
          "Reviews, social proof and FAQ systems",
          "Cross-sells, upsells and bundles",
        ],
      },
      {
        label: "Conversion journey",
        items: [
          "Cart and checkout-journey optimisation where the platform allows",
          "Trust elements, shipping and returns information architecture",
          "Email and lead capture",
          "Conversion-rate optimisation and analytics implementation",
        ],
      },
      {
        label: "Mobile commerce",
        items: [
          "Mobile navigation and imagery",
          "Variant selection and CTA placement",
          "Sticky add-to-cart where appropriate",
          "Page speed and checkout friction",
        ],
      },
    ],
    flowTo: "A store that converts the traffic the next stages send it.",
  },
  {
    number: "03",
    slug: "get-discovered",
    verb: "Get discovered",
    category: "E-commerce SEO",
    headline: "Get products discovered when customers are already searching.",
    businessOutcome:
      "Search → product discovery → store → product evaluation → purchase. Not local-business SEO — product and collection intent.",
    serviceGroups: [
      {
        label: "Research",
        items: [
          "Product and collection keyword research",
          "Search-intent and competitor analysis",
          "Buying-guide and comparison content strategy",
        ],
      },
      {
        label: "Technical & on-page",
        items: [
          "Product and collection page SEO",
          "Site architecture, internal linking and canonical strategy",
          "Faceted navigation and duplicate-content review",
          "Core Web Vitals, indexation and Search Console",
        ],
      },
      {
        label: "Structured data",
        items: ["Product structured data", "Review structured data where eligible", "Image SEO"],
      },
      {
        label: "Shopping feed",
        items: [
          "Google Merchant Center setup",
          "Product feed optimisation",
          "Google Shopping visibility",
        ],
      },
    ],
    flowTo: "Organic and Shopping discovery feeding the same optimised store.",
  },
  {
    number: "04",
    slug: "acquire",
    verb: "Acquire",
    category: "Digital Marketing",
    headline: "Bring qualified shoppers into the store.",
    businessOutcome:
      "Ad / search / social → product or campaign page → evaluation → add to cart → checkout → purchase — then into follow-up and retention.",
    serviceGroups: [
      {
        label: "Strategy",
        items: [
          "Audience, customer and competitor research",
          "Offer and campaign strategy",
          "Creative strategy and testing plans",
          "Platform and category eligibility check before spend",
        ],
      },
      {
        label: "Channels",
        items: [
          "Meta, Instagram and Facebook ads",
          "Google Ads and Google Shopping",
          "Performance Max and TikTok where appropriate",
          "Retargeting",
        ],
      },
      {
        label: "Execution",
        items: [
          "Ad creative and product campaign pages",
          "Campaign setup and conversion tracking",
          "Creative and audience testing",
          "Campaign optimisation and analytics",
        ],
      },
    ],
    flowTo: "Shoppers arriving with intent — and a system that catches the ones who don't buy yet.",
  },
  {
    number: "05",
    slug: "recover-nurture",
    verb: "Recover & nurture",
    category: "CRM & Automation",
    headline: "Recover revenue that would otherwise disappear.",
    businessOutcome:
      "Browse, cart and checkout drop-off brought back with relevant, non-spammy follow-up. HQ360 doesn't stop when someone visits.",
    serviceGroups: [
      {
        label: "Recovery flows",
        items: [
          "Welcome flow: capture → introduction → product discovery → first purchase",
          "Browse abandonment: product viewed → relevant follow-up → return",
          "Cart abandonment: added → left → benefit reminder → back to checkout",
          "Checkout abandonment: started → not completed → appropriate reminder → return",
        ],
      },
      {
        label: "CRM setup",
        items: [
          "CRM setup and customer database organisation",
          "Store ↔ CRM / email integration",
          "Customer segmentation and behavioural segmentation",
          "Automation logic and lifecycle workflows",
        ],
      },
      {
        label: "Platforms",
        items: [
          "Klaviyo where appropriate",
          "Omnisend where appropriate",
          "SMS automation where legally and operationally appropriate",
        ],
      },
    ],
    flowTo: "Recovered orders and a segmented list ready for retention.",
  },
  {
    number: "06",
    slug: "retain",
    verb: "Retain",
    category: "Email & Customer Marketing",
    headline: "Make the first purchase the beginning of the relationship.",
    businessOutcome:
      "Purchase → confirmation → product education → review request → relevant cross-sell → repeat purchase. Repeat revenue, not one-time orders.",
    serviceGroups: [
      {
        label: "Post-purchase flow",
        items: [
          "Order confirmation and delivery / usage guidance",
          "Product education",
          "Review requests",
          "Relevant cross-sell",
        ],
      },
      {
        label: "Lifecycle campaigns",
        items: [
          "Win-back and customer reactivation",
          "New-product launch campaigns to existing customers",
          "VIP and loyalty communication",
          "Back-in-stock and price-drop alerts where appropriate",
        ],
      },
      {
        label: "Programme",
        items: [
          "Email strategy and campaign design",
          "Newsletter management",
          "Customer segmentation",
          "Replenishment reminders where the product category fits",
        ],
      },
    ],
    flowTo: "A repeat-purchase engine that lowers blended acquisition cost.",
  },
  {
    number: "07",
    slug: "scale",
    verb: "Scale",
    category: "Analytics & Optimisation",
    headline: "Find what's working, fix what's leaking, improve the system.",
    businessOutcome:
      "Data → CRO → creative → acquisition, feeding back into discovery. The part that makes HQ360 more than an agency that launches and disappears.",
    serviceGroups: [
      {
        label: "Measurement",
        items: [
          "Conversion tracking and GA4",
          "Platform analytics and funnel analysis",
          "Checkout funnel and landing-page performance",
          "Traffic-source and acquisition analysis",
        ],
      },
      {
        label: "Customer analysis",
        items: [
          "Product performance analysis",
          "Average order value analysis",
          "Repeat-purchase and retention analysis",
          "Email and creative performance",
        ],
      },
      {
        label: "Testing",
        items: [
          "Product-page and landing-page testing",
          "Offer and bundle testing",
          "Upsell / cross-sell analysis",
          "CRO test roadmap",
        ],
      },
    ],
    flowTo: "Evidence for the next round of positioning, conversion and acquisition work.",
  },
];

/** How HQ360 thinks about a product page — an ordered, honest sequence. */
export const ECOMMERCE_PRODUCT_PAGE: { step: string; note: string }[] = [
  {
    step: "Strong product visual",
    note: "Real photography and product video — how it looks, scale and detail.",
  },
  {
    step: "Clear value proposition",
    note: "What it is and why it's worth buying, above the fold.",
  },
  { step: "Benefits, then features", note: "Outcomes first, specs to back them up." },
  { step: "Proof", note: "Genuine reviews and social proof — never fabricated ratings or counts." },
  {
    step: "FAQ / objection handling",
    note: "Sizing, materials, shipping, returns — answered before they're asked.",
  },
  {
    step: "The offer",
    note: "Price, bundle or quantity value, stated plainly. No fake urgency or stock counts.",
  },
  { step: "Add to cart", note: "Obvious, persistent, frictionless on mobile." },
  { step: "Cross-sell / upsell", note: "Relevant additions after the decision, not before it." },
];

/** The 360 growth flywheel — eight connected phases that loop. */
export const ECOMMERCE_FLYWHEEL: { phase: string; detail: string }[] = [
  { phase: "Discover", detail: "SEO · Social · Ads · Shopping" },
  { phase: "Visit", detail: "Store · Landing page · Product page" },
  { phase: "Shop", detail: "Browse · Compare · Evaluate" },
  { phase: "Convert", detail: "Cart · Checkout · Purchase" },
  { phase: "Recover", detail: "Browse · Cart · Checkout follow-up" },
  { phase: "Retain", detail: "Email · SMS · Post-purchase · Loyalty" },
  { phase: "Purchase again", detail: "Cross-sell · New product · Replenishment · Win-back" },
  { phase: "Optimise", detail: "Data · CRO · Creative · Acquisition" },
];

/** Sub-niches that live under the E-commerce & DTC vertical, not as their own pages. */
export const ECOMMERCE_SUBNICHES: { name: string; outcome: string }[] = [
  {
    name: "Beauty & skincare",
    outcome: "Turn visual product discovery into confident purchases and repeat routines.",
  },
  {
    name: "Fashion & apparel",
    outcome: "A faster path from discovery to size selection, checkout and repeat purchase.",
  },
  {
    name: "Wellness",
    outcome: "Communicate product value clearly, within category advertising rules.",
  },
  {
    name: "Home & lifestyle",
    outcome: "Make product value easier to understand, compare and buy.",
  },
  {
    name: "Pet products",
    outcome: "Build trust fast and turn a first order into a subscription habit.",
  },
  { name: "Food & beverage", outcome: "Sell taste and quality online, then earn the reorder." },
  {
    name: "Jewelry & accessories",
    outcome: "Present craftsmanship and gifting value at the moment of decision.",
  },
  {
    name: "Fitness products",
    outcome: "Connect the outcome to the product and support the routine after.",
  },
  {
    name: "Tech accessories",
    outcome: "Clear compatibility, clear benefit, clean comparison, fast checkout.",
  },
  {
    name: "Specialty & consumer goods",
    outcome: "Explain a less familiar product well enough to buy with confidence.",
  },
];

/** The ten areas a manual Store Growth Audit reviews. */
export const ECOMMERCE_AUDIT_AREAS: string[] = [
  "Brand presentation",
  "Store experience",
  "Product pages",
  "Mobile experience",
  "SEO & discoverability",
  "Conversion journey",
  "Cart & checkout",
  "Email & automation",
  "Customer retention",
  "Analytics & tracking",
];

/** Platforms HQ360 actually supports for this vertical. */
export const ECOMMERCE_PLATFORMS: { name: string; note: string }[] = [
  { name: "Shopify", note: "Design, redesign, CRO, apps and theme work." },
  { name: "WooCommerce", note: "Design, redesign, CRO and WordPress integration." },
];

/** Where the scouting conversation usually starts, by what the store already has. */
export const ECOMMERCE_SERVICE_MAP: { signal: string; start: string }[] = [
  { signal: "Good product, weak brand", start: "Brand & Creative" },
  { signal: "Good product, weak website", start: "E-commerce Website" },
  { signal: "Traffic, weak product pages", start: "CRO" },
  { signal: "Good store, low discoverability", start: "SEO" },
  { signal: "Good store, weak acquisition", start: "Digital Marketing" },
  { signal: "Cart activity, poor recovery", start: "Automation" },
  { signal: "Customers, low repeat purchase", start: "Retention Marketing" },
  { signal: "Active store, unclear performance", start: "Analytics & Optimisation" },
];

/**
 * The HQ360 growth library — the content behind /insights.
 *
 * Four content types share one hub: long-form GUIDES, high-intent ANSWERS
 * (question pages), a GLOSSARY of terms, and downloadable RESOURCES. The
 * original essays live in `insights.ts` as ARTICLES.
 *
 * Everything here is educational / framework-level. No fabricated metrics,
 * client names, benchmarks or guarantees.
 */

export const LIBRARY_TOPICS = [
  "Growth systems",
  "Websites & CRO",
  "SEO & discovery",
  "Advertising",
  "CRM & automation",
  "Retention",
  "Brand & creative",
  "Measurement",
] as const;

export type LibraryTopic = (typeof LIBRARY_TOPICS)[number];

/* ------------------------------------------------------------------ guides */

export type GuideSection = { heading: string; body: string[] };

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  topic: LibraryTopic;
  readTime: string;
  updated: string;
  intro: string;
  sections: GuideSection[];
  /** Plain-language "what to do with this". */
  takeaways: string[];
  /** slugs of related answers. */
  answers?: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "connected-growth-system",
    title: "How to build a connected growth system (instead of buying more tools)",
    summary:
      "The seven stages every growth system needs, how they hand off to each other, and where disconnected setups leak revenue.",
    topic: "Growth systems",
    readTime: "11 min read",
    updated: "September 2026",
    intro:
      "Most businesses don't have a growth problem so much as a connection problem. The ads work, the site is fine, the CRM exists — but nothing is accountable for the whole path from spend to signed customer. This guide walks the seven stages a growth system needs and shows where the seams usually fail.",
    sections: [
      {
        heading: "The seven stages",
        body: [
          "A growth system moves a stranger through: position (why you), attract (be found), engage (earn interest), capture (own the contact), convert (close), retain (earn the next order), and scale (read the data and improve). Each stage exists to feed the next one better inputs.",
          "You do not need all seven built at once. You need to know which one is the current constraint and start there. A business with plenty of traffic and a weak product page has a convert problem, not an attract problem — spending more on ads makes the leak bigger.",
        ],
      },
      {
        heading: "Where disconnected setups leak",
        body: [
          "Handoffs are where money disappears. The ad account optimises for a conversion event the site stopped firing after a redesign. Leads arrive but the follow-up sequence was scoped by someone who never saw the offer. A brand refresh lands three months after the campaign that needed it.",
          "Each vendor did their job. The system still leaks, because no single metric — booked revenue — sits above all of them.",
        ],
      },
      {
        heading: "How to sequence the build",
        body: [
          "Start with measurement so you can see the leak. Then fix the stage with the worst conversion rate relative to effort. Usually that is convert (product/landing pages and checkout) or capture (no lead magnet, no follow-up).",
          "Only widen the top of the funnel — more SEO, more ad spend — once the stages below it hold water. Otherwise you are paying to fill a bucket with holes in it.",
        ],
      },
      {
        heading: "What 'one system' actually means",
        body: [
          "It rarely means one agency for everything. It means one plan, one shared set of metrics, and one point of accountability for the number that matters. Sometimes that is consolidation; sometimes it is keeping specialists but giving one team the mandate to connect them.",
        ],
      },
    ],
    takeaways: [
      "Name the current constraint before spending on anything else.",
      "Fix conversion and capture before widening the top of the funnel.",
      "Put booked revenue above every vendor's individual metric.",
      "Instrument first — you cannot fix a leak you cannot see.",
    ],
    answers: ["how-long-growth-system-take", "do-i-need-every-service"],
  },
  {
    slug: "product-page-that-converts",
    title: "How to structure a product or landing page that actually converts",
    summary:
      "The order information should appear in — visual, value, proof, objections, offer — and the dark patterns to avoid.",
    topic: "Websites & CRO",
    readTime: "9 min read",
    updated: "September 2026",
    intro:
      "A high-converting page is not a design problem first — it is a sequence problem. It moves a visitor from interest to a confident decision by answering questions in the order they are asked. Here is that order, and what breaks it.",
    sections: [
      {
        heading: "The sequence",
        body: [
          "Strong visual → clear value proposition → benefits then features → proof → FAQ / objection handling → the offer → primary action → relevant cross-sell. Each block earns the scroll to the next one.",
          "Most weak pages lead with features, bury the value proposition, and put proof at the bottom where nobody reaches it.",
        ],
      },
      {
        heading: "Mobile is the real page",
        body: [
          "For most stores and services, the majority of traffic is mobile. Design the mobile sequence first: one clear action visible without scrolling, imagery that loads fast, forms that are short, a checkout or booking step with as little friction as the platform allows.",
        ],
      },
      {
        heading: "Proof, done honestly",
        body: [
          "Real reviews, named case studies, recognisable logos you have permission to use. Never fabricated ratings, invented urgency, or fake stock counters. They convert slightly better in the short term and cost you trust and, increasingly, ad-platform approval.",
        ],
      },
      {
        heading: "How to know it is working",
        body: [
          "Instrument the funnel: page view → key action → add to cart / enquiry → completed. Test one block at a time — headline, offer framing, proof placement — and keep changes that hold up over a meaningful sample, not a good afternoon.",
        ],
      },
    ],
    takeaways: [
      "Answer questions in the order visitors ask them.",
      "Build the mobile sequence first, not as an afterthought.",
      "Use only real proof — fabricated urgency and reviews are a false economy.",
      "Test one block at a time and judge on a real sample.",
    ],
    answers: ["improve-conversion-without-rebuild", "shopify-or-woocommerce"],
  },
  {
    slug: "speed-to-lead-playbook",
    title: "The speed-to-lead playbook: answer new leads in minutes, not hours",
    summary:
      "Why response time beats lead volume, and the automation that makes a two-minute first response realistic.",
    topic: "CRM & automation",
    readTime: "7 min read",
    updated: "September 2026",
    intro:
      "If you are about to increase ad spend, measure your median lead response time first. Fixing it is often the higher-return move and you can do it this month.",
    sections: [
      {
        heading: "Why it matters more than volume",
        body: [
          "Someone who just submitted a form is at peak intent. An hour later they have filled in three more forms, spoken to a competitor, or moved on. The lead did not get more expensive — it got colder. The first business to reach a prospect wins a disproportionate share of the deals.",
        ],
      },
      {
        heading: "The minimum viable setup",
        body: [
          "An automated first touch within seconds — an SMS or email that acknowledges the enquiry and sets expectations. A call task raised immediately and routed to whoever is available. A short reminder sequence for the lead if the first contact does not connect.",
          "This does not replace a salesperson. It buys them a live conversation instead of a voicemail.",
        ],
      },
      {
        heading: "After-hours and overflow",
        body: [
          "Define routing rules for evenings and weekends so urgent enquiries still reach someone or, at minimum, get an honest 'we will call you at 8am' message. For emergency-driven trades this is often the single highest-return automation.",
        ],
      },
    ],
    takeaways: [
      "Measure median response time before increasing spend.",
      "Automate the first touch; keep a human for the conversation.",
      "Write explicit after-hours routing rules.",
    ],
    answers: ["what-is-speed-to-lead", "how-long-growth-system-take"],
  },
  {
    slug: "ecommerce-retention-flows",
    title: "The email and SMS flows every online store should have before running more ads",
    summary:
      "Welcome, browse, cart and checkout recovery, post-purchase, win-back — what each one does and a sane build order.",
    topic: "Retention",
    readTime: "10 min read",
    updated: "September 2026",
    intro:
      "Paid acquisition without retention means re-buying every customer at full price. These flows recover revenue that already showed intent and turn a first order into a relationship. Build them roughly in this order.",
    sections: [
      {
        heading: "Recovery flows (build first)",
        body: [
          "Welcome: capture → introduction → product discovery → first purchase. Browse abandonment: product viewed, no purchase, a relevant nudge. Cart and checkout abandonment: added or started checkout, left, a benefit-led reminder back to the same step.",
          "These target existing intent, so they usually have the best return for the least work.",
        ],
      },
      {
        heading: "Lifecycle flows (build next)",
        body: [
          "Post-purchase: confirmation → usage guidance → review request → relevant cross-sell. Win-back for lapsed customers. New-product announcements to people who already bought. Replenishment reminders — only where the product category actually justifies them.",
        ],
      },
      {
        heading: "Keep it non-spammy",
        body: [
          "Relevance and frequency caps matter. A cart reminder is helpful; five are harassment. Segment so people are not pitched what they just bought. Respect unsubscribes and regional messaging rules, especially for SMS.",
        ],
      },
    ],
    takeaways: [
      "Build recovery flows before lifecycle flows.",
      "Don't add replenishment reminders to categories that don't replenish.",
      "Cap frequency and segment — one good reminder beats five.",
    ],
    answers: ["abandoned-cart-help", "customers-dont-repeat"],
  },
  {
    slug: "ecommerce-seo-basics",
    title: "E-commerce SEO: getting products found when customers are already searching",
    summary:
      "Product and collection keywords, technical foundations, structured data, and the product feed — without ranking guarantees.",
    topic: "SEO & discovery",
    readTime: "9 min read",
    updated: "September 2026",
    intro:
      "E-commerce SEO is not local-business SEO. The intent is product and category, the technical surface is larger, and a clean product feed matters as much as on-page work. No one can guarantee rankings; here is the work that gives you the best chance.",
    sections: [
      {
        heading: "Keyword and intent mapping",
        body: [
          "Map collections and products to the terms people actually search — problem terms, category terms, comparison terms. Decide which pages target which intent so you are not competing with yourself.",
        ],
      },
      {
        heading: "Technical foundations",
        body: [
          "Crawlable architecture, sensible internal linking, a canonical strategy for faceted navigation and near-duplicate variants, image optimisation, and Core Web Vitals that do not punish mobile shoppers.",
        ],
      },
      {
        heading: "Structured data and feed",
        body: [
          "Product structured data, review structured data where you are genuinely eligible, and a Merchant Center feed that is complete and accurate so Shopping can surface the right items.",
        ],
      },
      {
        heading: "Supporting content",
        body: [
          "Buying guides and comparison content earn discovery for research-stage queries and give collections something to link from. It is a long game — report leading indicators, not promises.",
        ],
      },
    ],
    takeaways: [
      "Map each page to one search intent.",
      "Fix architecture, canonicals and speed before chasing content volume.",
      "Treat the product feed as part of SEO, not an afterthought.",
      "Anyone guaranteeing rankings is not being straight with you.",
    ],
    answers: ["do-you-guarantee-rankings", "how-long-does-seo-take"],
  },
];

/* ----------------------------------------------------------------- answers */

export type Answer = {
  slug: string;
  question: string;
  topic: LibraryTopic;
  /** One-sentence answer, shown in listings and used for the meta description. */
  short: string;
  body: string[];
  related?: string[];
};

export const ANSWERS: Answer[] = [
  {
    slug: "do-i-need-every-service",
    question: "Do I need every service in a growth system?",
    topic: "Growth systems",
    short:
      "No. Most engagements start with one or two stages — usually conversion and follow-up — after identifying the biggest current bottleneck.",
    body: [
      "A connected growth system has seven stages, but you rarely build them all at once. The useful question is which stage is currently costing you the most: not enough discovery, visitors who do not convert, leads that go cold, customers who do not come back, or no clarity on where the money leaks.",
      "HQ360 identifies that constraint first and starts there. Widening the top of the funnel only helps once the stages below it hold water.",
    ],
    related: ["how-long-growth-system-take", "do-you-work-with-existing-tools"],
  },
  {
    slug: "how-long-growth-system-take",
    question: "How long does it take to build a growth system?",
    topic: "Growth systems",
    short:
      "A first working version of the priority stage is typically live in three to five weeks, then optimised from real data.",
    body: [
      "Timelines depend on scope and what already exists. A single funnel plus campaigns and follow-up is usually live in three to five weeks. A full multi-stage build is phased so something is working at each step rather than everything landing at once.",
      "The first phase almost always targets the constraint that is losing the most revenue now, so there is a return before the whole system is finished.",
    ],
    related: ["do-i-need-every-service", "what-is-speed-to-lead"],
  },
  {
    slug: "do-you-work-with-existing-tools",
    question: "Can you work with the tools and website we already have?",
    topic: "Growth systems",
    short:
      "Usually yes. We assess what is in place and recommend replacing something only when the gain clearly justifies the switch.",
    body: [
      "Most engagements build on the existing stack — website platform, CRM, email tool, ad accounts. We connect and instrument what you have before proposing changes.",
      "We recommend switching a tool only when it is genuinely blocking the outcome, and we explain the trade-off before you decide. Everything is built in your accounts, so it keeps running if we part ways.",
    ],
  },
  {
    slug: "improve-conversion-without-rebuild",
    question: "Can you improve our conversion rate without rebuilding the whole site?",
    topic: "Websites & CRO",
    short:
      "Often, yes. Targeted work on product and landing pages, mobile checkout friction and proof placement can move the number without a full rebuild.",
    body: [
      "A full rebuild is sometimes the right call, but frequently the highest-return work is contained: restructuring key product or landing pages, removing mobile checkout friction, adding real proof where decisions are made, and fixing tracking so you can see what changed.",
      "A short audit tells you whether a rebuild is warranted or whether focused changes will do.",
    ],
    related: ["shopify-or-woocommerce"],
  },
  {
    slug: "shopify-or-woocommerce",
    question: "Do you work with Shopify and WooCommerce?",
    topic: "Websites & CRO",
    short:
      "Yes, both — design, redesign, conversion work and integrations. On other platforms we will say honestly whether we can support it well.",
    body: [
      "HQ360 supports Shopify and WooCommerce for e-commerce design, redesign, conversion optimisation and CRM/email integration.",
      "If you are on another platform, tell us which one and we will give a straight answer on whether we can support it well or would recommend a migration.",
    ],
  },
  {
    slug: "what-is-speed-to-lead",
    question: "What is speed to lead, and why does it matter?",
    topic: "CRM & automation",
    short:
      "It is how fast you make first contact with a new enquiry. Faster contact sharply raises the odds of a real conversation, often more than extra ad spend.",
    body: [
      "A prospect who just submitted a form is at peak intent. Minutes later they have contacted competitors or moved on. The first business to reach them wins a disproportionate share of deals.",
      "An automated first touch within seconds, plus an immediate call task and a short reminder sequence, is inexpensive to run once built and usually moves the number more than increasing volume.",
    ],
    related: ["speed-to-lead-playbook", "abandoned-cart-help"],
  },
  {
    slug: "abandoned-cart-help",
    question: "Can you set up abandoned-cart recovery for our store?",
    topic: "Retention",
    short:
      "Yes. We build browse, cart and checkout recovery flows — plus welcome and post-purchase — usually in Klaviyo or Omnisend, integrated with your store.",
    body: [
      "Recovery flows target shoppers who already showed intent, so they tend to have the best return for the least work. We build browse abandonment, cart abandonment and checkout abandonment, with frequency caps and segmentation so messaging stays helpful rather than spammy.",
    ],
    related: ["customers-dont-repeat", "ecommerce-retention-flows"],
  },
  {
    slug: "customers-dont-repeat",
    question: "Our customers buy once and never come back. What can we do?",
    topic: "Retention",
    short:
      "Add a post-purchase sequence, win-back campaigns and new-product announcements, and segment so people are not re-pitched what they just bought.",
    body: [
      "One-time purchasing usually means there is no lifecycle marketing: no post-purchase education, no review request, no reason to return. Building post-purchase, win-back and new-product flows turns the first order into a relationship and lowers blended acquisition cost.",
      "Replenishment reminders help only where the product category genuinely justifies them.",
    ],
    related: ["abandoned-cart-help"],
  },
  {
    slug: "do-you-guarantee-rankings",
    question: "Do you guarantee search rankings or a sales increase?",
    topic: "SEO & discovery",
    short:
      "No. We set realistic targets from your data, do the work that gives the best chance, and report against leading indicators. Guarantees are a red flag.",
    body: [
      "Rankings, revenue and return on ad spend depend on your market, offer, product and execution as well as ours. We commit to the work — technical foundations, content, structured data, campaigns — and to honest reporting.",
      "Anyone promising a guaranteed ranking, guaranteed ad approval or a guaranteed revenue number is not being straight with you.",
    ],
    related: ["how-long-does-seo-take"],
  },
  {
    slug: "how-long-does-seo-take",
    question: "How long does SEO take to show results?",
    topic: "SEO & discovery",
    short:
      "Technical and on-page fixes can show within weeks; competitive organic rankings usually take months. We report leading indicators throughout.",
    body: [
      "Some changes — fixing indexation, structured data, a cleaned-up product feed, Core Web Vitals — can affect visibility within a few weeks. Ranking for competitive terms is a months-long effort.",
      "We report leading indicators (impressions, crawl health, feed quality, content published) so progress is visible before rankings move.",
    ],
    related: ["do-you-guarantee-rankings", "ecommerce-seo-basics"],
  },
  {
    slug: "can-you-run-our-ads",
    question: "Can you run our Meta and Google ads?",
    topic: "Advertising",
    short:
      "Yes, where the product category and platform policies allow. We check eligibility before recommending a channel or promising spend.",
    body: [
      "HQ360 plans and runs Meta, Google, Google Shopping and TikTok campaigns into pages built to convert the traffic. Some product categories carry advertising restrictions, so we check platform and category eligibility first.",
      "We never promise guaranteed ad approval or a guaranteed return on ad spend.",
    ],
    related: ["do-you-guarantee-rankings"],
  },
  {
    slug: "work-outside-usa",
    question: "Do you work with businesses outside the USA?",
    topic: "Growth systems",
    short:
      "Yes. The team works remotely across time zones. A large share of clients are US-based, but the work is not US-only.",
    body: [
      "Engagements run remotely and asynchronously where needed. Location, language, currency and regional marketing rules are factored into planning.",
    ],
  },
];

/* --------------------------------------------------------------- glossary */

export type GlossaryTerm = { term: string; slug: string; short: string; body: string };

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Growth system",
    slug: "growth-system",
    short:
      "A connected set of stages — position, attract, engage, capture, convert, retain, scale — with one owner accountable for booked revenue.",
    body: "Rather than isolated services, a growth system treats acquisition, conversion and retention as one loop where each stage feeds the next better inputs. The defining feature is a single metric — booked revenue — sitting above every channel and vendor.",
  },
  {
    term: "Speed to lead",
    slug: "speed-to-lead",
    short: "How quickly a business makes first contact with a new enquiry.",
    body: "Contact rates fall sharply as minutes pass after a form submission. Automating the first touch and raising an immediate call task typically improves conversion more than increasing lead volume.",
  },
  {
    term: "Conversion rate optimisation (CRO)",
    slug: "cro",
    short:
      "Improving the share of visitors who take the key action, through structured testing rather than guesswork.",
    body: "CRO works on page sequence, offer framing, proof placement, mobile friction and checkout flow. Changes are tested one at a time and judged on a meaningful sample.",
  },
  {
    term: "Cart abandonment",
    slug: "cart-abandonment",
    short: "When a shopper adds an item to the cart but leaves before completing checkout.",
    body: "A recovery flow sends a relevant, benefit-led reminder back to the same step. Because the shopper already showed intent, it is usually among the highest-return automations for a store.",
  },
  {
    term: "Browse abandonment",
    slug: "browse-abandonment",
    short: "When a visitor views products but leaves without adding anything to the cart.",
    body: "A light follow-up referencing the viewed products can bring the visitor back. It sits earlier in intent than cart abandonment, so messaging is softer.",
  },
  {
    term: "Lifecycle marketing",
    slug: "lifecycle-marketing",
    short: "Email and SMS mapped to where a customer is in their relationship with the brand.",
    body: "Welcome, post-purchase, win-back, replenishment and new-product flows each address a specific moment. Segmentation prevents pitching people what they just bought.",
  },
  {
    term: "Speed-to-lead automation",
    slug: "speed-to-lead-automation",
    short: "The automated first response and routing that reaches a new lead within seconds.",
    body: "It does not replace a salesperson; it buys them a live conversation instead of a voicemail. After-hours routing rules are part of a complete setup.",
  },
  {
    term: "Merchant Center feed",
    slug: "merchant-center-feed",
    short: "The structured product data Google uses to show items in Shopping results.",
    body: "Feed completeness and accuracy affect which products surface for which queries, making it part of e-commerce SEO rather than a separate task.",
  },
  {
    term: "Structured data",
    slug: "structured-data",
    short: "Machine-readable markup that helps search engines understand a page's content.",
    body: "Product, review and FAQ structured data can make listings eligible for richer search results, used only where the page genuinely qualifies.",
  },
  {
    term: "Core Web Vitals",
    slug: "core-web-vitals",
    short:
      "Google's measures of loading, interactivity and visual stability, weighted toward the mobile experience.",
    body: "Poor scores can suppress rankings and, more importantly, cost conversions on mobile-heavy traffic.",
  },
  {
    term: "Application funnel",
    slug: "application-funnel",
    short:
      "A page and form that qualify a prospect on fit, budget and readiness before a call is booked.",
    body: "Common for coaches, consultants and high-ticket services. It trades raw enquiry volume for a calendar of calls worth taking.",
  },
  {
    term: "Database reactivation",
    slug: "database-reactivation",
    short: "Structured campaigns to past leads and customers already sitting in a CRM.",
    body: "Because the contacts are already owned, reactivation often books appointments or orders at a fraction of new-lead cost.",
  },
  {
    term: "Google Business Profile",
    slug: "google-business-profile",
    short: "The free business listing that powers local search results and the map pack.",
    body: "For local and home-service businesses, an optimised profile plus reviews is frequently the highest-return first step.",
  },
  {
    term: "Return on ad spend (ROAS)",
    slug: "roas",
    short: "Revenue attributed to advertising divided by the amount spent.",
    body: "Useful as a directional measure. It is sensitive to attribution windows and should be read alongside blended acquisition cost and repeat-purchase rate — and never guaranteed.",
  },
  {
    term: "Blended acquisition cost",
    slug: "blended-acquisition-cost",
    short: "Total sales and marketing cost divided by new customers, across all channels.",
    body: "It resists the attribution games of channel-level metrics and shows whether retention work is actually lowering what each customer costs.",
  },
  {
    term: "Average order value (AOV)",
    slug: "aov",
    short: "Average revenue per order over a period.",
    body: "Bundles, cross-sells and quantity offers raise AOV without more traffic. It is one of the levers analysed before recommending acquisition spend.",
  },
  {
    term: "Attribution",
    slug: "attribution",
    short: "Assigning credit for a conversion to the touchpoints that led to it.",
    body: "No model is perfect. HQ360 favours instrumented funnels and blended measures over debating last-click versus first-click.",
  },
  {
    term: "Speed-to-lead window",
    slug: "speed-to-lead-window",
    short: "The short period after an enquiry when contact rates are highest.",
    body: "Practically, the first few minutes. Automation exists to make sure a business acts inside that window every time, including outside business hours.",
  },
];

/* -------------------------------------------------------------- resources */

export type ResourceItem = {
  slug: string;
  title: string;
  description: string;
  format: string;
  /** Path under /public. */
  href: string;
};

export const RESOURCES: ResourceItem[] = [
  {
    slug: "positioning-report",
    title: "Positioning report template",
    description:
      "The questions we work through to sharpen a brand's positioning to one audience and one outcome.",
    format: "PDF",
    href: "/resources/hq360-positioning-report.pdf",
  },
  {
    slug: "launch-checklist",
    title: "Launch checklist",
    description:
      "A dated checklist for sequencing a launch backward from the date — preorder, launch team, review timing, promotion stack.",
    format: "PDF",
    href: "/resources/hq360-launch-checklist.pdf",
  },
  {
    slug: "brand-and-book-audit",
    title: "Brand & book audit worksheet",
    description:
      "A self-audit for authors and author-experts covering listing, funnel, reader capture and platform.",
    format: "PDF",
    href: "/resources/hq360-brand-and-book-audit.pdf",
  },
];

/* ----------------------------------------------------------------- lookups */

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const getAnswer = (slug: string) => ANSWERS.find((a) => a.slug === slug);

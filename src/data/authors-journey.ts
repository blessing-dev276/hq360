/**
 * The Authors & Publishers page is a single 8-stage author journey rather
 * than a service list. This is its data: the lifecycle, the "where are you
 * now" selector, and the growth-plan diagnostic. Real proof (Sanman Thapa)
 * stays in `industries.ts` / `launch.ts`; this file is the journey itself.
 *
 * No promised sales, rankings or bestseller status anywhere in this content.
 */

export type AuthorStageId =
  "idea" | "write" | "prepare" | "publish" | "launch" | "sell" | "retain" | "scale";

/** "both" (the default) means the service applies regardless of category —
 * only tag a service fiction/nonfiction when it genuinely only fits one. */
export type ServiceAudience = "fiction" | "nonfiction" | "both";

export type AuthorService = {
  name: string;
  /** One line: what it is / why it matters, shown when the service is opened. */
  blurb: string;
  audience?: ServiceAudience;
};

export type ServiceGroup = { name: string; items: AuthorService[] };

export type AuthorStage = {
  id: AuthorStageId;
  number: string;
  label: string;
  /** Shown on the orbit when this stage is hovered/selected. */
  orbitLine: string;
  /** Section headline. */
  headline: string;
  /** One short paragraph — the stage in plain language. */
  body: string;
  outcome: string;
  serviceGroups: ServiceGroup[];
  /** The connective line leading into the next stage. */
  transition: string;
};

export const AUTHOR_STAGES: AuthorStage[] = [
  {
    id: "idea",
    number: "01",
    label: "Idea",
    orbitLine: "Turn the idea into a commercially positioned concept.",
    headline: "Build the right book before writing the wrong one.",
    body: "A concept that knows its reader, its category and its promise is easier to write, easier to position and easier to sell later. This is where that gets decided.",
    outcome: "A commercially positioned concept with a reader, a category and a promise.",
    serviceGroups: [
      {
        name: "Concept",
        items: [
          {
            name: "Hook architecture",
            blurb: "The single sentence that makes a stranger want to know more.",
          },
          {
            name: "Commercial positioning blueprint",
            blurb: "Where the book sits in the market, and why it wins there.",
          },
          {
            name: "Core promise & reader transformation",
            blurb: "What the reader gets by the last page.",
          },
          {
            name: "Nonfiction monetization strategy",
            blurb: "How the book supports the wider business, not just itself.",
            audience: "nonfiction",
          },
          {
            name: "Fiction series architecture",
            blurb: "How one book sets up the next without giving too much away.",
            audience: "fiction",
          },
        ],
      },
      {
        name: "Research",
        items: [
          {
            name: "Comparative title analysis",
            blurb: "What's already working in the category, and where the gap is.",
          },
          {
            name: "Reader avatar deep dive",
            blurb: "Who actually buys this, specific enough to write for them.",
          },
          {
            name: "Market gap & demand analysis",
            blurb: "Evidence there's an audience before committing months to writing.",
          },
          {
            name: "Keyword & category mapping",
            blurb:
              "The categories and search terms that put the book in front of the right reader.",
          },
          {
            name: "Converting title formulation",
            blurb: "A title and subtitle tested against what similar readers click.",
          },
          {
            name: "Multi-book series modeling",
            blurb: "Mapping the series arc before book one locks in the constraints.",
          },
        ],
      },
      {
        name: "Planning",
        items: [
          {
            name: "Milestone & writing roadmaps",
            blurb: "A dated writing plan you can actually keep.",
          },
          {
            name: "Book proposal preparation",
            blurb: "The proposal document agents and hybrid publishers expect to see.",
            audience: "nonfiction",
          },
          {
            name: "Scene-by-beat sheet",
            blurb: "Every scene mapped to its purpose before you draft it.",
            audience: "fiction",
          },
          {
            name: "Structural outline engineering",
            blurb: "A chapter structure that holds together, not just a list of topics.",
          },
          {
            name: "Fiction narrative & universe blueprinting",
            blurb: "World rules, character arcs and plot logic set before the first draft.",
            audience: "fiction",
          },
          {
            name: "Chapter purpose & reader progression mapping",
            blurb: "What each chapter has to do so the reader keeps turning pages.",
          },
        ],
      },
    ],
    transition: "Your concept is ready. Next: turn it into a manuscript.",
  },
  {
    id: "write",
    number: "02",
    label: "Write",
    orbitLine: "Turn the concept into a strong manuscript.",
    headline: "Turn the concept into a manuscript worth publishing.",
    body: "Writing support HQ360 delivers directly, plus editing coordinated through vetted specialists where a project needs it — never claimed as in-house if it isn't.",
    outcome: "A publication-ready manuscript, structurally sound and edited.",
    serviceGroups: [
      {
        name: "Writing strategy",
        items: [
          {
            name: "Ghostwriting & manuscript architecture",
            blurb: "Full manuscript support from structure through to a finished draft.",
          },
          {
            name: "Chapter pacing & scene optimization",
            blurb: "Fixing chapters that drag or rush before an editor sees them.",
          },
          {
            name: "Author accountability coaching & milestones",
            blurb: "Regular check-ins that keep a manuscript moving to deadline.",
          },
          {
            name: "Voice & tone development",
            blurb: "A consistent voice that sounds like the author on every page.",
          },
          {
            name: "Draft review & developmental feedback",
            blurb: "An honest read on what's working and what needs another pass.",
          },
        ],
      },
      {
        name: "Editing strategy",
        items: [
          {
            name: "Substantive & structural overhauls",
            blurb: "Fixing structure, pacing and argument before line editing is worth doing.",
          },
          {
            name: "Line-by-line polish & stylistic editing",
            blurb: "Sentence-level editing for clarity, rhythm and style.",
          },
          {
            name: "Target-demographic beta testing",
            blurb: "Real readers from the target audience react before the book goes to print.",
          },
          {
            name: "Final galley proofreading & compliance review",
            blurb: "The last pass for typos, formatting and platform compliance.",
          },
          {
            name: "Continuity & consistency review",
            blurb: "Catching timeline, detail and character slips across the manuscript.",
          },
        ],
      },
    ],
    transition: "Your manuscript is taking shape. Next: prepare it for the market.",
  },
  {
    id: "prepare",
    number: "03",
    label: "Prepare",
    orbitLine: "Edit, design and package the book professionally.",
    headline: "Turn the manuscript into a professional publishing product.",
    body: "Production, cover and author brand work happen together so the finished book reads as one professional object, not three separate vendors.",
    outcome: "A professionally packaged book and an author brand to put behind it.",
    serviceGroups: [
      {
        name: "Editorial production",
        items: [
          {
            name: "Interior book design",
            blurb: "Typesetting and layout that reads as a professionally produced book.",
          },
          {
            name: "Digital & print format production",
            blurb: "Ebook, paperback and hardcover files built correctly for each format.",
          },
          {
            name: "Algorithmic metadata & SEO asset preparation",
            blurb: "The metadata retailers and search algorithms use to surface the book.",
          },
          {
            name: "Global print fulfillment & POD architecture",
            blurb: "Print-on-demand set up so copies print and ship worldwide without manual work.",
          },
        ],
      },
      {
        name: "Creative",
        items: [
          {
            name: "Conversion-focused print & digital cover design",
            blurb: "A cover designed to perform as a thumbnail and on a shelf.",
          },
          {
            name: "Multi-volume series brand architecture",
            blurb: "A visual system that reads as one series across every cover.",
          },
          {
            name: "Cinematic launch trailers & social motion assets",
            blurb: "Short video built to promote the book across social and launch channels.",
          },
          {
            name: "Book mockup & campaign creative suite",
            blurb: "Mockups and graphics for the listing, ads and social promotion.",
          },
        ],
      },
      {
        name: "Author brand",
        items: [
          {
            name: "Commercial identity & bio engineering",
            blurb: "An author bio and identity written to build buyer confidence.",
          },
          {
            name: "Author positioning & authority strategy",
            blurb: "How the author is positioned relative to the category and its readers.",
          },
          {
            name: "Digital HQ: author website architecture",
            blurb: "The author's own site — not rented space on someone else's platform.",
          },
          {
            name: "Media & speaker kit development",
            blurb: "The one-sheet, bio and assets press and event organisers ask for.",
          },
        ],
      },
    ],
    transition: "The book looks ready. Next: publish it properly.",
  },
  {
    id: "publish",
    number: "04",
    label: "Publish",
    orbitLine: "Get the book into the market.",
    headline: "Turn the finished manuscript into a book correctly positioned and available to buy.",
    body: "Metadata, categories and pricing decide whether a good book gets found. We set these up correctly rather than leaving them at platform defaults. Registration support is practical guidance, not legal advice — that comes from an actual specialist where a project needs one.",
    outcome: "The book properly positioned and available where readers buy.",
    serviceGroups: [
      {
        name: "Infrastructure",
        items: [
          {
            name: "Retail platform infrastructure deployment",
            blurb: "Getting the book correctly set up on the platforms that sell it.",
          },
          {
            name: "Author Central Page Setup",
            blurb: "Setting up the Amazon author profile with a bio, photo and linked books.",
          },
          {
            name: "Algorithmic indexing & taxonomy optimization",
            blurb: "Categories and keywords set so the book is found, not buried.",
          },
          {
            name: "Global monetization & price modeling",
            blurb: "Pricing set deliberately across formats and territories, not left at default.",
          },
          {
            name: "Imprint setup & publishing registration support",
            blurb: "Practical guidance on imprint and registration steps — not legal advice.",
          },
        ],
      },
      {
        name: "Listing",
        items: [
          {
            name: "Conversion-engineered sales copywriting",
            blurb: "A book description written to turn a browser into a buyer.",
          },
          {
            name: "Premium brand showcasing & A+ visual layouts",
            blurb: "Enhanced visual listing content where the platform supports it.",
          },
          {
            name: "Sequential funnel & series architecture linkage",
            blurb: "Listings linked so one book leads a reader to the next.",
          },
          {
            name: "Retail page conversion optimization",
            blurb: "Ongoing tuning of the listing based on what's actually converting.",
          },
        ],
      },
      {
        name: "Distribution",
        items: [
          {
            name: "Global retail & library syndication networks",
            blurb:
              "Wider distribution into retail and library channels beyond the primary platform.",
          },
          {
            name: "Direct-to-reader (D2C) revenue ecosystems",
            blurb: "A direct-sale channel the author controls, alongside retail.",
          },
          {
            name: "Wholesale & institutional distribution strategy",
            blurb: "A plan for bulk, wholesale and institutional buyers where relevant.",
          },
        ],
      },
    ],
    transition: "The infrastructure is ready. Next: launch with momentum.",
  },
  {
    id: "launch",
    number: "05",
    label: "Launch",
    orbitLine: "Create momentum around release.",
    headline: "Don't just publish. Launch.",
    body: "A dated plan working backward from release — preorders, reviewer outreach, media and paid visibility stacked so week one compounds instead of fading quietly. No launch service here promises a bestseller badge or guaranteed media placement — those depend on the book and the market as much as the campaign.",
    outcome: "A dated launch plan built to create real momentum at release.",
    serviceGroups: [
      {
        name: "Launch strategy",
        items: [
          {
            name: "High-velocity launch strategy & marketing",
            blurb: "A dated plan working backward from release so week one compounds.",
          },
          {
            name: "Category momentum & bestseller positioning strategy",
            blurb:
              "Positioning the launch to build real category momentum — no badge is guaranteed.",
          },
          {
            name: "Advance review copy (ARC) campaign management",
            blurb: "Getting the book into reviewers' hands with enough runway before release.",
          },
          {
            name: "NetGalley Campaigns",
            blurb:
              "Planning and managing NetGalley campaigns to connect advance copies with reviewers and book professionals.",
          },
          {
            name: "High-conversion launch asset suite",
            blurb: "The graphics, copy and pages a launch actually needs, ready in advance.",
          },
        ],
      },
      {
        name: "Media & authority",
        items: [
          {
            name: "Podcast guest placement",
            blurb: "Pitching the author onto relevant podcasts as a guest.",
          },
          {
            name: "Press & literary media outreach",
            blurb: "Direct outreach to press and literary media on the author's behalf.",
          },
          {
            name: "Author interview placement",
            blurb: "Securing interview opportunities that put the author in front of readers.",
          },
          {
            name: "Goodreads News & Interviews",
            blurb:
              "Preparing news pitches and interview materials for relevant Goodreads editorial opportunities.",
          },
          {
            name: "Book review outreach",
            blurb:
              "Compliant outreach to reviewers and book media — never paid or incentivised reviews.",
          },
          {
            name: "Thought-leadership positioning",
            blurb: "Positioning the author as a credible voice in their category.",
          },
          {
            name: "Media kit & press asset development",
            blurb: "The press-ready assets journalists and hosts ask for before booking.",
          },
        ],
      },
      {
        name: "Audience & influencers",
        items: [
          {
            name: "Newsletter swaps & influencer outreach",
            blurb: "Cross-promotion with newsletters and creators who reach the same readers.",
          },
          {
            name: "BookTok / Bookstagram creator outreach",
            blurb: "Outreach to book-content creators for genuine coverage, not paid placement.",
          },
          {
            name: "ARC team mobilization",
            blurb: "Recruiting and coordinating a launch team of early readers.",
          },
          {
            name: "Book Club Outreach",
            blurb:
              "Connecting with relevant book clubs using reading guides, discussion prompts and author event pitches.",
          },
        ],
      },
      {
        name: "Paid visibility",
        items: [
          {
            name: "Paid visibility & ad funnel scaling",
            blurb: "Paid campaigns that scale once the organic launch signal is proven.",
          },
          {
            name: "Billboard Campaigns where commercially appropriate",
            blurb:
              "Planning billboard creative and placements when the audience, location and budget support the campaign.",
          },
        ],
      },
    ],
    transition: "The book is in motion. Next: turn attention into sales.",
  },
  {
    id: "sell",
    number: "06",
    label: "Sell",
    orbitLine: "Turn attention into readers and buyers.",
    headline: "Turn attention into readers and readers into buyers.",
    body: "A repeatable acquisition system — a digital HQ, search and AI discovery, content and paid channels working together — rather than a launch spike that fades.",
    outcome: "A repeatable reader-acquisition system, not a one-week spike.",
    serviceGroups: [
      {
        name: "Digital HQ & funnels",
        items: [
          {
            name: "Digital HQ: conversion-optimized author hubs",
            blurb: "The author's central hub, built to convert visits into readers.",
          },
          {
            name: "Automated reader-acquisition funnels",
            blurb: "A funnel that turns interest into an owned reader contact automatically.",
          },
          {
            name: "Direct-to-reader (D2C) high-margin stores",
            blurb: "A direct-sale storefront with better margin than retail alone.",
          },
          {
            name: "Book launch & campaign landing pages",
            blurb: "Dedicated pages for a launch, a promotion, or a specific campaign.",
          },
        ],
      },
      {
        name: "Discovery",
        items: [
          {
            name: "Omnichannel discovery & authority indexing",
            blurb:
              "Search and retail visibility across every channel a reader might search, Amazon included.",
          },
          {
            name: "Goodreads discovery & Listopia strategy",
            blurb: "Building presence and list placement on Goodreads.",
          },
          {
            name: "AI search & generative discovery optimization",
            blurb: "Positioning so the book surfaces in AI-assisted search and recommendations.",
          },
          {
            name: "A/B testing & conversion rate optimization (CRO)",
            blurb: "Testing what actually improves conversion instead of guessing.",
          },
        ],
      },
      {
        name: "Content & acquisition",
        items: [
          {
            name: "Short-form video traffic engines",
            blurb: "Repeatable short-form video systems driving traffic on BookTok and Reels.",
          },
          {
            name: "Pinterest Book Marketing",
            blurb:
              "Building book-focused pins, boards and content campaigns that lead readers to book pages and author websites.",
          },
          {
            name: "Book trailer & cinematic content distribution",
            blurb: "Getting trailer and video content in front of the right audience.",
          },
          {
            name: "Author thought-leadership content systems",
            blurb: "An ongoing content system that builds authority between releases.",
          },
          {
            name: "Multi-platform paid acquisition campaigns",
            blurb: "Paid campaigns across Meta, Google and Amazon, run as one system.",
          },
          {
            name: "Advanced retargeting & reader retention funnels",
            blurb: "Bringing back visitors who showed interest but didn't buy yet.",
          },
        ],
      },
    ],
    transition: "Readers are arriving. Next: keep them.",
  },
  {
    id: "retain",
    number: "07",
    label: "Retain",
    orbitLine: "Build a reader audience you can reach again.",
    headline: "Don't lose the reader after one purchase.",
    body: "A reader network you own — onboarding, social proof and a superfan layer — so the next release doesn't start from zero.",
    outcome: "A reader audience and reader network you own and can reach again.",
    serviceGroups: [
      {
        name: "Reader network",
        items: [
          {
            name: "First-party reader network architecture",
            blurb: "A reader list and network the author owns outright.",
          },
          {
            name: "Automated reader onboarding & nurture funnels",
            blurb: "A welcome sequence that turns a new reader into a returning one.",
          },
          {
            name: "Reader lifetime value modeling",
            blurb: "Understanding what a reader is worth across a career, not one sale.",
          },
        ],
      },
      {
        name: "Social proof & retention",
        items: [
          {
            name: "Automated social proof engines",
            blurb: "Compliant, automated requests that grow genuine reviews over time.",
          },
          {
            name: "Pre-launch pipeline & priority waitlist systems",
            blurb: "A waitlist that gives the next release a running start.",
          },
          {
            name: "Superfan ecosystem & ARC team mobilization",
            blurb: "A recurring group of engaged readers ready for every release.",
          },
          {
            name: "Reader community & ambassador programs",
            blurb: "A space for the most engaged readers to stay connected and advocate.",
          },
        ],
      },
    ],
    transition: "Your audience is growing. Next: scale the author business.",
  },
  {
    id: "scale",
    number: "08",
    label: "Scale",
    orbitLine: "Grow the catalogue, audience and author business.",
    headline: "Turn one book into a larger author business.",
    body: "Once the loop works for one book, the same system compounds across a catalogue — more titles, formats and revenue lines feeding the same owned audience.",
    outcome: "A catalogue and author business built on what already works.",
    serviceGroups: [
      {
        name: "Catalogue & IP",
        items: [
          {
            name: "IP & series expansion strategy",
            blurb: "A plan for growing the catalogue around what's already working.",
          },
          {
            name: "Multi-format & transmedia localization strategy",
            blurb: "Audiobook, translation and format expansion planned as one strategy.",
          },
        ],
      },
      {
        name: "Business expansion",
        items: [
          {
            name: "High-ticket keynote & corporate speaking funnels",
            blurb: "Turning author authority into paid speaking opportunities.",
          },
          {
            name: "Digital product & masterclass architecture",
            blurb: "Courses and digital products built on the book's expertise.",
            audience: "nonfiction",
          },
          {
            name: "Sub-rights & licensing pitch decks",
            blurb: "Pitch materials for rights and licensing conversations.",
          },
          {
            name: "Film / TV / adaptation pitch materials",
            blurb: "Materials prepared for adaptation conversations, where relevant.",
            audience: "fiction",
          },
          {
            name: "Author partnership & sponsorship strategy",
            blurb: "Brand and partnership opportunities built on an established audience.",
          },
        ],
      },
      {
        name: "Optimization",
        items: [
          {
            name: "Catalogue yield & reader LTV optimization",
            blurb: "Improving what the existing catalogue earns per reader.",
          },
          {
            name: "Performance analytics & growth intelligence",
            blurb: "Real reporting on what's working across the whole system.",
          },
          {
            name: "Omnichannel brand consolidation",
            blurb: "Bringing a multi-book, multi-channel presence under one consistent brand.",
          },
        ],
      },
    ],
    transition: "Now the book becomes an ecosystem.",
  },
];

export const getAuthorStage = (id: AuthorStageId) => AUTHOR_STAGES.find((s) => s.id === id)!;

/* ------------------------------------------------- "where are you now?" */

export type WhereNowOption = {
  id: string;
  label: string;
  stage: AuthorStageId;
  /** The short recommended-path chain shown after selection. */
  path: string[];
};

export const WHERE_NOW_OPTIONS: WhereNowOption[] = [
  {
    id: "idea-only",
    label: "I only have an idea",
    stage: "idea",
    path: ["Idea", "Market research", "Positioning", "Outline", "Writing roadmap"],
  },
  {
    id: "writing",
    label: "I'm currently writing",
    stage: "write",
    path: ["Manuscript development", "Editing", "Beta readers", "Proofreading"],
  },
  {
    id: "manuscript-done",
    label: "My manuscript is finished",
    stage: "prepare",
    path: ["Production & formatting", "Cover design", "Author brand", "Metadata"],
  },
  {
    id: "preparing",
    label: "I'm preparing to publish",
    stage: "publish",
    path: ["Platform setup", "Categories & keywords", "Pricing", "Listing"],
  },
  {
    id: "published",
    label: "My book is already published",
    stage: "launch",
    path: ["Launch plan", "Reviewer outreach", "Launch content", "Email sequence"],
  },
  {
    id: "selling",
    label: "I'm selling but want more readers",
    stage: "sell",
    path: ["Author website", "Book SEO", "Content & ads", "Reader acquisition system"],
  },
  {
    id: "scaling",
    label: "I already have traction and want to scale",
    stage: "scale",
    path: ["Catalogue strategy", "Retention system", "Advanced acquisition", "Author business"],
  },
];

/* ------------------------------------------------------- growth-plan diagnostic */

export type AuthorGoal = {
  id: string;
  label: string;
  recommended: string;
  stack: string[];
};

export const AUTHOR_GOALS: AuthorGoal[] = [
  {
    id: "finish",
    label: "Finish the book",
    recommended: "Write & Prepare",
    stack: ["Manuscript development", "Editing", "Production & cover"],
  },
  {
    id: "publish-well",
    label: "Publish professionally",
    recommended: "Prepare & Publish",
    stack: ["Cover & formatting", "Metadata & categories", "Platform setup"],
  },
  {
    id: "launch-well",
    label: "Launch successfully",
    recommended: "Launch System",
    stack: ["Launch timeline", "Reviewer outreach", "Launch content & email"],
  },
  {
    id: "more-readers",
    label: "Get more readers",
    recommended: "Reader Acquisition System",
    stack: ["Website / funnel", "Book SEO", "Content", "Paid acquisition"],
  },
  {
    id: "email-list",
    label: "Build an email audience",
    recommended: "Reader Capture System",
    stack: ["Reader magnet", "Capture page", "Welcome sequence"],
  },
  {
    id: "more-sales",
    label: "Increase book sales",
    recommended: "Sell & Retain System",
    stack: ["Listing rebuild", "Ads & content", "Retention flows"],
  },
  {
    id: "series",
    label: "Grow a series / catalogue",
    recommended: "Catalogue Growth",
    stack: ["Series strategy", "Cross-title retention", "Wider distribution"],
  },
  {
    id: "scale-business",
    label: "Scale an existing author business",
    recommended: "Author Business System",
    stack: ["Advanced acquisition", "Analytics & CRO", "Business diversification"],
  },
];

export const AUTHOR_ASSETS = [
  "Manuscript",
  "Cover",
  "Website",
  "Email list",
  "Social audience",
  "Published book",
  "None yet",
];

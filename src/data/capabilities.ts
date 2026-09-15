/**
 * WHAT HQ360 does. Service groups.
 *
 * Industries (who we help) live in `industries.ts` and reference these by slug.
 */

export type CapabilitySlug =
  | "brand-creative"
  | "websites-funnels"
  | "crm-automation"
  | "lead-generation"
  | "content-social"
  | "visibility-reputation"
  | "social-media-marketing"
  | "mobile-app-development"
  | "game-development";

export type Capability = {
  slug: CapabilitySlug;
  path: string;
  /** One or two words for compact UI. */
  label: string;
  name: string;
  tagline: string;
  summary: string;
  /** Outcome statements — what the client gets, not the tools we use. */
  outcomes: string[];
  /** The concrete work inside this capability. */
  services: { title: string; body: string }[];
  deliverables: string[];
  faqs: { q: string; a: string }[];
  seo: { title: string; description: string };
};

export const CAPABILITIES: Capability[] = [
  {
    slug: "brand-creative",
    path: "/capabilities/brand-creative",
    label: "Brand & Creative",
    name: "Brand & Creative",
    tagline: "Look like the business you are trying to become.",
    summary:
      "Brand identity, design and creative direction for businesses, founders and experts. We connect positioning, logos, visual guidelines and campaign assets so the brand stays consistent across its website, social channels and sales material.",
    outcomes: [
      "A brand people recognise before they read the name",
      "Every touchpoint pulling in the same direction",
      "Sales conversations that start from a position of credibility",
      "Design assets your team can actually reuse",
    ],
    services: [
      {
        title: "Brand identity",
        body: "Positioning, naming support, logo and a visual system with the rules that keep it consistent.",
      },
      {
        title: "Visual identity & design systems",
        body: "Colour, type, layout and component libraries so new material stays on brand without a designer in the loop.",
      },
      {
        title: "Graphic & social design",
        body: "Templates and campaign graphics for the formats each platform actually rewards.",
      },
      {
        title: "Media kits & sales collateral",
        body: "One-sheets, decks and press kits that make a producer's or a buyer's decision easy.",
      },
      {
        title: "Personal branding",
        body: "A coherent identity for founders and experts whose name is the asset.",
      },
      {
        title: "Creative direction",
        body: "A single point of view across campaigns, photo and video so the work feels deliberate.",
      },
    ],
    deliverables: [
      "Brand guidelines document",
      "Logo suite and export pack",
      "Colour and type system",
      "Social and campaign templates",
      "Media kit or sales deck",
    ],
    faqs: [
      {
        q: "Do we need a full rebrand or just cleanup?",
        a: "Often cleanup. We start with an audit and tell you whether the identity needs replacing or just a system and rules around what already exists.",
      },
      {
        q: "Can you work with our existing designer?",
        a: "Yes. We can set direction and hand off a system your team runs with, or take the production work off their plate.",
      },
    ],
    seo: {
      title: "Brand & Creative | HQ360",
      description:
        "Brand identity, visual systems, design and creative direction that make a business recognisable and consistent everywhere it appears.",
    },
  },
  {
    slug: "websites-funnels",
    path: "/capabilities/websites-funnels",
    label: "Website & Funnel",
    name: "Website & Funnel",
    tagline: "Turn your online presence into a sales asset built to convert attention into action.",
    summary:
      "Business websites, landing pages and funnels designed around one job: move the right visitor to the next step.",
    outcomes: [
      "A site that earns enquiries instead of just describing you",
      "Landing pages matched to each campaign and audience",
      "A clear path from first click to booked call or purchase",
      "Pages your team can update without a developer",
    ],
    services: [
      {
        title: "Business websites",
        body: "Fast, structured sites that make the offer obvious and the next step unavoidable.",
      },
      {
        title: "Landing pages",
        body: "Campaign-specific pages built to a single conversion goal and tested against it.",
      },
      {
        title: "Sales funnels",
        body: "Multi-step flows — lead magnet, booking, checkout — sequenced so each step feeds the next.",
      },
      {
        title: "Portfolio & personal sites",
        body: "Presence for creators, authors and experts that captures contact details and makes the pitch easy.",
      },
      {
        title: "E-commerce",
        body: "Storefronts and product pages focused on the path to purchase, not decoration.",
      },
      {
        title: "Conversion optimisation",
        body: "Structured review of an existing site or funnel with a prioritised list of changes and the reasoning behind each.",
      },
    ],
    deliverables: [
      "Designed and built site or funnel",
      "Lead capture and booking integration",
      "Analytics and conversion tracking",
      "Editable content structure",
      "Handover and training session",
    ],
    faqs: [
      {
        q: "What do you build on?",
        a: "We choose the platform to fit the project — from a marketing site to a full funnel stack — and we tell you why. You own everything at the end.",
      },
      {
        q: "Can you improve our current site instead of replacing it?",
        a: "Yes. A conversion review often finds enough structural wins that a rebuild can wait.",
      },
    ],
    seo: {
      title: "Websites & Funnels | HQ360",
      description:
        "Websites, landing pages and sales funnels built to convert attention into booked calls and customers, with a clear path from first click to action.",
    },
  },
  {
    slug: "crm-automation",
    path: "/capabilities/crm-automation",
    label: "Digital marketing",
    name: "Digital marketing",
    tagline: "Turn new leads into booked conversations without manually chasing every enquiry.",
    summary:
      "Digital marketing operations for teams handling enquiries and sales. We set up CRM systems, sales pipelines and email or SMS follow-up to connect new leads with booking, nurture and reactivation workflows.",
    outcomes: [
      "Every lead answered fast, day or night",
      "One place to see where each deal stands",
      "Follow-up that continues until someone books or opts out",
      "Old enquiries reactivated instead of forgotten",
    ],
    services: [
      {
        title: "CRM setup & migration",
        body: "GoHighLevel or HubSpot configured around how you actually sell, with your data moved in cleanly.",
      },
      {
        title: "Pipelines & lead management",
        body: "Stages, owners and rules so nothing sits untouched and reporting reflects reality.",
      },
      {
        title: "SMS & email automation",
        body: "Speed-to-lead replies, nurture sequences and reminders that run on their own.",
      },
      {
        title: "Appointment systems",
        body: "Booking, confirmations and no-show follow-up wired end to end.",
      },
      {
        title: "AI & chat automation",
        body: "Assisted replies and qualification that hand a warm, informed lead to a person.",
      },
      {
        title: "Integrations",
        body: "Zapier and Make connections between your site, ads, calendar and CRM so data moves without copy-paste.",
      },
      {
        title: "Database reactivation",
        body: "Structured outreach to past enquiries and customers to pull booked conversations out of a list you already own.",
      },
    ],
    deliverables: [
      "Configured CRM and pipelines",
      "Speed-to-lead and nurture automations",
      "Booking and reminder flows",
      "Integration map and documentation",
      "Team training and a run book",
    ],
    faqs: [
      {
        q: "Do you only work in GoHighLevel?",
        a: "No. GoHighLevel and HubSpot are the two we set up most often. We recommend one based on your team, budget and what you already use.",
      },
      {
        q: "Can leads from our industry pages route automatically?",
        a: "Yes. Enquiries carry the page they came from, so routing and follow-up can differ by industry from day one.",
      },
    ],
    seo: {
      title: "Digital Marketing, CRM & Automation | HQ360",
      description:
        "CRM setup, pipelines and SMS and email automation that answer every lead fast and follow up until they book, without manual chasing.",
    },
  },
  {
    slug: "lead-generation",
    path: "/capabilities/lead-generation",
    label: "Social Media Marketing",
    name: "Social Media Marketing",
    tagline: "Build a predictable flow of qualified conversations with people ready to buy.",
    summary:
      "Social media marketing and lead generation for businesses seeking new enquiries. We connect paid advertising, audience and offer strategy, outreach and nurture with the landing pages and follow-up needed to handle responses.",
    outcomes: [
      "A steady pipeline instead of feast and famine",
      "Enquiries that match who you actually want to work with",
      "Spend you can see the return on, reported weekly",
      "Interest that keeps warming until the timing is right",
    ],
    services: [
      {
        title: "Paid advertising",
        body: "Meta, Google and YouTube campaigns built to a cost-per-booked-call target, not a vanity metric.",
      },
      {
        title: "Lead capture experiences",
        body: "Offers, forms and quizzes that qualify as they collect, so your team talks to the right people.",
      },
      {
        title: "Cold outreach systems",
        body: "Compliant, well-targeted email and social outreach with the infrastructure to keep it deliverable.",
      },
      {
        title: "Email marketing & nurture",
        body: "Sequences and broadcasts that keep a list engaged between purchases.",
      },
      {
        title: "Retargeting",
        body: "Structured follow-up ads for people who visited, watched or enquired and did not act.",
      },
      {
        title: "Appointment generation",
        body: "The full path from ad to booked, confirmed appointment, measured at every step.",
      },
    ],
    deliverables: [
      "Campaign strategy and targeting plan",
      "Ad creative and copy",
      "Tracking and attribution setup",
      "Nurture and retargeting sequences",
      "Weekly performance reporting",
    ],
    faqs: [
      {
        q: "Is ad spend included in your fee?",
        a: "No. You pay the platforms directly so you keep full ownership and visibility of the account and the data.",
      },
      {
        q: "Do you guarantee a number of leads?",
        a: "No. We set targets from research and comparable campaigns, report against them weekly, and move budget toward what works.",
      },
    ],
    seo: {
      title: "Social Media Marketing & Lead Generation | HQ360",
      description:
        "Paid advertising, outreach and nurture systems that build a predictable flow of qualified enquiries and booked appointments.",
    },
  },
  {
    slug: "content-social",
    path: "/capabilities/content-social",
    label: "Ai Video & Video Editing",
    name: "Ai Video & Video Editing",
    tagline:
      "Build consistent visibility that keeps your brand in front of the people most likely to buy.",
    summary:
      "Content strategy, short-form video and editing for businesses and personal brands. We plan themes and publishing calendars, produce social content and repurpose material into formats that support the brand and its campaigns.",
    outcomes: [
      "A publishing rhythm you can actually sustain",
      "Content built for how each platform distributes it",
      "A back catalogue working for you, not one-off posts",
      "Creator partnerships that reach an audience you do not own yet",
    ],
    services: [
      {
        title: "Content strategy",
        body: "Themes, formats and a calendar tied to what the business needs to sell, not what is trending.",
      },
      {
        title: "Short-form video",
        body: "Scripting, direction and editing for the vertical formats that drive reach.",
      },
      {
        title: "UGC & creator campaigns",
        body: "Sourced creators, briefs and usage rights, managed end to end.",
      },
      {
        title: "Social media management",
        body: "Production, scheduling and community response with a consistent voice.",
      },
      {
        title: "Video editing",
        body: "Turnaround editing for founders and teams already filming but not shipping.",
      },
      {
        title: "Content repurposing",
        body: "One recording turned into a month of posts across formats and platforms.",
      },
    ],
    deliverables: [
      "Content strategy and calendar",
      "Monthly batch of edited video and graphics",
      "Creator sourcing and briefs",
      "Publishing and community workflow",
      "Monthly performance review",
    ],
    faqs: [
      {
        q: "Do we need to be on camera?",
        a: "It helps for founder-led brands, but not always. We build the approach around what you can realistically keep doing.",
      },
      {
        q: "Can you work from footage we already have?",
        a: "Yes. Repurposing an existing library is often the fastest way to get consistent output.",
      },
    ],
    seo: {
      title: "AI Video, Video Editing & Content | HQ360",
      description:
        "Content strategy, short-form video, creator campaigns and social production that build consistent visibility with the right audience.",
    },
  },
  {
    slug: "visibility-reputation",
    path: "/capabilities/visibility-reputation",
    label: "SEO",
    name: "SEO",
    tagline: "Be easy to find and easy to trust the moment someone checks.",
    summary:
      "SEO and reputation support for businesses that need to be found in search. The work covers website search optimisation, Google Business Profile, review workflows and press outreach, based on the business and the audience it serves.",
    outcomes: [
      "Showing up when your customers are searching",
      "A review profile that supports the sale instead of undermining it",
      "A local presence that competes in the map pack",
      "Credible third-party coverage you can point to",
    ],
    services: [
      {
        title: "SEO",
        body: "Technical fixes, content structure and internal linking aimed at the searches that lead to revenue.",
      },
      {
        title: "Local SEO & Google Business Profile",
        body: "Profile optimisation, citations and review velocity to compete in local results.",
      },
      {
        title: "Review generation",
        body: "Compliant, systematic requests that ask real customers at the right moment.",
      },
      {
        title: "Reputation management",
        body: "Monitoring, response templates and a plan for handling negative feedback in public.",
      },
      {
        title: "PR & media placement",
        body: "Targeted pitching to podcasts, publications and trade press that already cover your subject.",
      },
      {
        title: "Author & book visibility",
        body: "Retail listing optimisation, reader-list placement and review campaigns for published work.",
      },
    ],
    deliverables: [
      "SEO audit and roadmap",
      "Google Business Profile optimisation",
      "Review request system",
      "Reputation monitoring and response playbook",
      "Press target list and pitches",
    ],
    faqs: [
      {
        q: "How long does SEO take?",
        a: "Technical and local wins can show in weeks. Competitive organic rankings usually take several months, and we report leading indicators the whole way.",
      },
      {
        q: "Do you buy reviews?",
        a: "Never. Reviews come from real customers through compliant requests. Anything else risks the profile and the business.",
      },
    ],
    seo: {
      title: "SEO, Local Search & Reputation | HQ360",
      description:
        "SEO, local search, Google Business Profile, review generation and PR so a business is easy to find and easy to trust.",
    },
  },
];

CAPABILITIES.push(
  {
    slug: "mobile-app-development",
    path: "/capabilities/mobile-app-development",
    label: "Mobile App Development",
    name: "Mobile App Development",
    tagline: "Put your best customer journeys in the palm of their hand.",
    summary:
      "Mobile products designed and built around the tasks your customers need to complete most.",
    outcomes: [
      "A focused mobile experience",
      "A clear product roadmap",
      "A maintainable app foundation",
    ],
    services: [
      {
        title: "Mobile product strategy",
        body: "User flows, feature priorities and a practical roadmap for the first release.",
      },
      {
        title: "App design and development",
        body: "Responsive mobile experiences built around real user needs.",
      },
      {
        title: "Launch and iteration",
        body: "Release support, analytics and improvements based on how people use the product.",
      },
    ],
    deliverables: [
      "Product roadmap",
      "UX and UI designs",
      "Working mobile application",
      "Launch handover",
    ],
    faqs: [],
    seo: {
      title: "Mobile App Development | HQ360",
      description:
        "HQ360 builds mobile products end to end: product strategy, UX and UI design, development and launch support focused on the tasks customers need to complete most.",
    },
  },
  {
    slug: "game-development",
    path: "/capabilities/game-development",
    label: "Game Development",
    name: "Game Development",
    tagline: "Build interactive experiences people want to play and share.",
    summary:
      "Game concepts, design and development for experiences that are clear, engaging and built to ship.",
    outcomes: [
      "A playable concept",
      "A clear development plan",
      "A polished interactive experience",
    ],
    services: [
      {
        title: "Game concept and design",
        body: "Core loops, player journeys and a practical plan for the experience.",
      },
      {
        title: "Game development",
        body: "Playable systems, levels and interactions built for the chosen platform.",
      },
      {
        title: "Polish and launch",
        body: "Testing, iteration and launch preparation to get the experience in front of players.",
      },
    ],
    deliverables: ["Game concept", "Design documentation", "Playable build", "Launch handover"],
    faqs: [],
    seo: {
      title: "Game Development | HQ360",
      description:
        "HQ360 designs and builds interactive games — core loops, playable systems and levels — from concept through testing and launch, built to ship and to be played.",
    },
  },
);

export function getCapability(slug: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.slug === slug);
}

export function capabilitiesFor(slugs: readonly string[]): Capability[] {
  return slugs
    .map((s) => CAPABILITIES.find((c) => c.slug === s))
    .filter((c): c is Capability => Boolean(c));
}

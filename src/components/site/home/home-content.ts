// Homepage editorial summaries. Existing industry and capability pages remain
// the source for detailed services; their full catalogs are not hero payloads.
import type { CapabilitySlug } from "@/data/capabilities";

export const HOME_CAPABILITIES: {
  slug: CapabilitySlug;
  label: string;
  short: string;
  outcome: string;
  summary: string;
  services: string[];
  industries: string;
}[] = [
  {
    slug: "brand-creative",
    label: "Brand & Creative",
    short: "Brand",
    outcome: "Make your first impression your unfair advantage.",
    summary:
      "A clear position and a distinctive identity, expressed consistently wherever people meet your brand.",
    services: ["Brand strategy & identity", "Creative direction", "Media kits & sales collateral"],
    industries: "Authors · Creators · Expert-led businesses",
  },
  {
    slug: "websites-funnels",
    label: "Websites & Funnels",
    short: "Web",
    outcome: "Give every visitor a reason to take the next step.",
    summary:
      "Fast websites and focused funnels that turn interest into an inquiry, a booking or a purchase.",
    services: [
      "Business & portfolio websites",
      "Landing pages & sales funnels",
      "Conversion optimisation",
    ],
    industries: "Real estate · Coaches · Home services",
  },
  {
    slug: "crm-automation",
    label: "CRM & Automation",
    short: "Automation",
    outcome: "Keep the conversation going. Even when you’re busy.",
    summary:
      "Bring your leads, pipeline and follow-up together, so the right response arrives at the right moment.",
    services: ["CRM setup & migration", "Email & SMS follow-up", "Pipeline & booking workflows"],
    industries: "Sales teams · Agencies · Local businesses",
  },
  {
    slug: "lead-generation",
    label: "Lead Generation & Growth",
    short: "Growth",
    outcome: "Get in front of people who are ready to act.",
    summary:
      "Focused campaigns and outreach built around the audience, offer and conversations that matter to your business.",
    services: [
      "Paid acquisition campaigns",
      "Audience & offer strategy",
      "Outreach & reactivation",
    ],
    industries: "Real estate · Home services · Consultants",
  },
  {
    slug: "content-social",
    label: "Content & Social",
    short: "Content",
    outcome: "Be the brand they remember between decisions.",
    summary:
      "A recognisable voice, purposeful video and a publishing rhythm that keeps your audience close.",
    services: ["Video production & editing", "Social content systems", "Campaign creative"],
    industries: "Creators · Authors · Personal brands",
  },
  {
    slug: "visibility-reputation",
    label: "Visibility & Reputation",
    short: "Visibility",
    outcome: "Easy to discover. Easier to trust.",
    summary:
      "Search presence, reviews and earned visibility that give your next customer confidence to choose you.",
    services: [
      "Search engine optimisation",
      "Local visibility & reviews",
      "Press & authority building",
    ],
    industries: "Local businesses · Authors · Professional services",
  },
];

export const HOME_STAGES = [
  {
    title: "Position",
    body: "Get clear on your audience, your offer and the reason someone should choose you.",
    capabilities: "Strategy · Positioning · Brand identity",
  },
  {
    title: "Build",
    body: "Put your brand to work with the website, funnels and tools your customer journey needs.",
    capabilities: "Websites · Funnels · CRM",
  },
  {
    title: "Attract",
    body: "Reach the right people with a purposeful mix of search, content and paid campaigns.",
    capabilities: "SEO · Content · Advertising",
  },
  {
    title: "Convert",
    body: "Connect interest to action with clear next steps and timely, relevant follow-up.",
    capabilities: "Landing pages · Booking · Automation",
  },
  {
    title: "Retain",
    body: "Give customers a reason to stay close, return and recommend you to someone else.",
    capabilities: "Nurture · Reviews · Reactivation",
  },
  {
    title: "Scale",
    body: "Use what you’ve learned to refine the system and expand the work that earns its place.",
    capabilities: "Reporting · Optimisation · Expansion",
  },
];

export const HOME_INDUSTRIES = [
  {
    slug: "authors",
    name: "Authors & Publishers",
    category: "Personal brands & experts",
    challenge: "Your book is published. Reaching the right readers is the next chapter.",
    outcome: "Turn discovery into readers and book sales.",
    path: ["Discover", "Read", "Recommend"],
    cta: "View author services",
  },
  {
    slug: "creators",
    name: "Content Creators / UGC",
    category: "Personal brands & experts",
    challenge: "You have the creative talent. Brands need a clear reason to hire you.",
    outcome: "Turn content skills into paid partnerships.",
    path: ["Get seen", "Get hired", "Get rebooked"],
    cta: "View creator services",
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    category: "Sales & professional teams",
    challenge: "New inquiries lose momentum when the follow-up depends on a busy team.",
    outcome: "Turn leads into appointments and closings.",
    path: ["Inquire", "Meet", "Close"],
    cta: "View real estate services",
  },
  {
    slug: "coaches",
    name: "Coaches & Consultants",
    category: "Personal brands & experts",
    challenge: "Your expertise delivers. Your pipeline needs to reach beyond referrals.",
    outcome: "Turn expertise into qualified conversations.",
    path: ["Discover", "Apply", "Work together"],
    cta: "View coaching services",
  },
  {
    slug: "home-services",
    name: "Home Services",
    category: "Local & home services",
    challenge: "Local demand is there. Being found and responding quickly makes the difference.",
    outcome: "Turn local demand into booked jobs.",
    path: ["Search", "Book", "Recommend"],
    cta: "View home services",
  },
  {
    slug: "agencies",
    name: "Agencies",
    category: "Sales & professional teams",
    challenge: "Winning new work and delivering it well compete for the same hours.",
    outcome: "Build the pipeline and capacity to grow.",
    path: ["Connect", "Win", "Deliver"],
    cta: "View agency services",
  },
];

export const HOME_PROCESS = [
  {
    title: "Discover",
    body: "We listen to where you are, where you want to go and what has already been tried.",
    output: "Shared goals",
  },
  {
    title: "Diagnose",
    body: "We review your brand, journey and pipeline to find what is holding progress back.",
    output: "A clear priority",
  },
  {
    title: "Strategize",
    body: "You get a practical plan with scope, owners, milestones and measures of success.",
    output: "Your growth roadmap",
  },
  {
    title: "Build",
    body: "Creative, websites and automation take shape together, with visible review points.",
    output: "Connected assets",
  },
  {
    title: "Launch",
    body: "We connect the final pieces, check the customer journey and put the work into the world.",
    output: "A working system",
  },
  {
    title: "Optimize",
    body: "We review the signals, improve the weak points and build on what is working.",
    output: "The next advantage",
  },
];

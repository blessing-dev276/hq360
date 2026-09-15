/**
 * WHO HQ360 helps. Each industry is a prospecting landing page with its own
 * direct URL (e.g. /real-estate). Pages are rendered from this data by a single
 * `IndustryPage` component, so a new vertical is mostly a new entry here plus a
 * thin route file.
 *
 * No fabricated metrics or client names. `proof` references real projects only.
 */

import type { CapabilitySlug } from "./capabilities";

export type IndustryCategory =
  | "Personal Brands & Experts"
  | "Local & Home Services"
  | "Sales & Professional Teams"
  | "Commerce & Product Brands";

export type Industry = {
  /** URL segment, e.g. "real-estate". */
  slug: string;
  /** Full path, e.g. "/real-estate". */
  path: string;
  /** Formal name for headings and schema. */
  name: string;
  /** Short label for cards and nav. */
  shortName: string;
  category: IndustryCategory;
  eyebrow: string;
  headline: string;
  subheadline: string;
  /** ~150 char summary for meta + card copy. */
  description: string;
  /** The single business outcome this page promises. */
  outcome: string;
  /** 4-6 concrete outcome statements — what the client gets. */
  outcomes: string[];
  painPoints: { title: string; body: string }[];
  /** "What's holding you back" — short, blunt bullets. */
  holdingBack: string[];
  /** How HQ360 helps — 2-3 short paragraphs. */
  howWeHelp: string[];
  recommendedCapabilities: CapabilitySlug[];
  /** Niche-specific service list. */
  services: string[];
  /** An example growth system for this niche. */
  growthSystem: { step: string; title: string; body: string }[];
  proof?: { kind: "project" | "note"; slug?: string; text: string }[];
  faqs: { q: string; a: string }[];
  cta: { label: string; sub: string };
  seo: { title: string; description: string };
};

export const INDUSTRIES: Industry[] = [
  /* ---------------------------------------------------------------- Authors */
  {
    slug: "authors",
    path: "/authors",
    name: "Authors & Publishers",
    shortName: "Authors & Publishers",
    category: "Personal Brands & Experts",
    eyebrow: "For authors, publishers and author-experts",
    headline: "Turn your book into a brand readers discover, trust, and buy from.",
    subheadline:
      "HQ360 combines brand, websites, SEO, content, social media, advertising, automation and reader technology into one connected growth system for authors and publishers.",
    description:
      "A connected growth system for authors and publishers: brand, book funnels, SEO, video, social, advertising, automation and a reader app that turns buyers into a repeat audience.",
    outcome: "A book that keeps finding readers, and a name that keeps earning opportunities.",
    outcomes: [
      "A retail listing that turns browsers into buyers",
      "A launch week that builds momentum instead of fading",
      "A review profile that keeps growing after release",
      "An email list and press footprint you own",
      "One team owning the result, not four freelancers",
    ],
    painPoints: [
      {
        title: "The launch was quiet",
        body: "Publication came and went. There was no plan for the weeks that actually decide a book's momentum.",
      },
      {
        title: "The listing does not sell",
        body: "Wrong categories, a flat description and a cover that does not earn the click. Readers who find it still bounce.",
      },
      {
        title: "Reviews are thin",
        body: "A handful of ratings, no system for getting more, and no idea which requests are compliant.",
      },
      {
        title: "No platform beyond the book",
        body: "No email list, no press, no reason for a producer or event to call. The book is the whole footprint.",
      },
      {
        title: "Everything is bought piecemeal",
        body: "A cover here, a publicist there, a funnel somewhere else, and nobody owns the result.",
      },
    ],
    holdingBack: [
      "No dated launch plan",
      "Metadata and categories left at defaults",
      "No review-generation system",
      "No email list or reader magnet",
      "No press or podcast pipeline",
    ],
    howWeHelp: [
      "We rebuild the retail listing from the metadata up — categories, keywords, description and cover feedback — so the book is findable and worth buying.",
      "We plan the launch backward from your date: preorder sequencing, a launch team, review timing and promotion stacked so week one compounds.",
      "Then we build the platform around it — email capture, a media kit, and hand-pitched press — so the book keeps working and your name keeps growing.",
    ],
    recommendedCapabilities: [
      "visibility-reputation",
      "websites-funnels",
      "lead-generation",
      "brand-creative",
    ],
    services: [
      "Amazon and retail listing optimisation",
      "Goodreads and reader-list placement",
      "Bestseller launch campaigns",
      "Verified review campaigns",
      "Author website and email funnel",
      "Media kit and author branding",
      "Press and podcast placement",
      "Speaking and thought-leadership outreach",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Listing rebuild",
        body: "Categories, keywords, description and cover feedback grounded in live marketplace data.",
      },
      {
        step: "02",
        title: "Launch runway",
        body: "A dated calendar, a recruited launch team and a promotion stack around release.",
      },
      {
        step: "03",
        title: "Review engine",
        body: "Compliant reader recruitment and follow-up that keeps ratings growing after launch.",
      },
      {
        step: "04",
        title: "Author platform",
        body: "Reader magnet, capture page and welcome sequence so readers become a list you own.",
      },
      {
        step: "05",
        title: "Press & stages",
        body: "Hand-pitched podcasts and features, plus speaking outreach that uses the book as proof.",
      },
    ],
    proof: [
      {
        kind: "project",
        slug: "sanman-thapa-book-launch",
        text: "Sanman Thapa's live launch for From the Window: The City of What Ifs — cover reveal film, a full signing room and two titles in print with Arti Facts Publishing.",
      },
    ],
    faqs: [
      {
        q: "Do you work with self-published and traditionally published authors?",
        a: "Both, plus small presses running multiple titles. The listing, review and platform work applies either way; the launch plan adapts to how much control you have over price and metadata.",
      },
      {
        q: "Can you guarantee a bestseller badge?",
        a: "No. We set a realistic target from category data, tell you what it would take, and run the campaign to it. Anyone promising a list placement is not being straight with you.",
      },
      {
        q: "Do you buy or incentivise reviews?",
        a: "Never. Reviews come from real readers who received and read the book, through compliant follow-up.",
      },
      {
        q: "What if my book is already published?",
        a: "A backlist relaunch is common. New categories, a rewritten description, a review push and a press run can bring a quiet title back.",
      },
    ],
    cta: {
      label: "Build my author growth system",
      sub: "A free look at your brand, book funnels, discovery and reader systems.",
    },
    seo: {
      title: "Author & Publisher Growth System | HQ360",
      description:
        "HQ360 connects brand, book funnels, SEO, advertising and automation into one growth system for authors and publishers, built to turn discovery into repeat sales.",
    },
  },

  /* --------------------------------------------------------------- Creators */
  {
    slug: "creators",
    path: "/creators",
    name: "Content & UGC Creators",
    shortName: "Content Creators",
    category: "Personal Brands & Experts",
    eyebrow: "For UGC creators, content creators and creator-led brands",
    headline: "From portfolio to paid partnership.",
    subheadline:
      "HQ360 builds the brand, portfolio, visibility and client-acquisition system behind professional UGC and content creators.",
    description:
      "Branding, portfolio websites, Canva portfolios, SEO, social media and client acquisition systems for UGC and professional content creators.",
    outcome: "A creator business brands can discover, trust, hire and come back to.",
    outcomes: [
      "A creator brand that makes your value commercially clear",
      "A portfolio that helps the right brand evaluate you quickly",
      "More useful discovery through search and social profiles",
      "Organized outreach and follow-up instead of scattered DMs",
      "A repeat-client path after the first collaboration",
    ],
    painPoints: [
      {
        title: "Income swings with the feed",
        body: "A good month follows a viral post, then nothing. There is no floor under the revenue.",
      },
      {
        title: "Brand deals are inbound chaos",
        body: "Offers land in DMs, get negotiated from scratch every time, and half go cold before a contract.",
      },
      {
        title: "No owned audience",
        body: "Every follower is rented from a platform. No email list, no way to reach them if reach drops.",
      },
      {
        title: "Products launch flat",
        body: "A course or a UGC service exists but there is no funnel, no proof and no launch behind it.",
      },
      {
        title: "The brand looks amateur next to the content",
        body: "Great videos, but the media kit, site and offer pages do not match the quality.",
      },
    ],
    holdingBack: [
      "No rate card or productised offer",
      "No inbound funnel for brand deals",
      "No email list",
      "No launch system for products",
      "Inconsistent brand across platforms",
    ],
    howWeHelp: [
      "We build the brand and the offer set — media kit, rate card, service or product pages — so a partner or a buyer meets a business, not a link in bio.",
      "We put an inbound funnel and CRM behind it: a page that qualifies brand enquiries, and follow-up that moves them to a booked call.",
      "Then we build owned audience — email capture and a repurposing engine — so one recording feeds a month of content and a list you control.",
    ],
    recommendedCapabilities: [
      "brand-creative",
      "websites-funnels",
      "content-social",
      "crm-automation",
    ],
    services: [
      "Brand & Creative for creator positioning and media kits",
      "UGC portfolio, professional creator and Canva websites",
      "Creator SEO and social search optimization",
      "Social authority, content pillars and video editing",
      "Brand prospecting, CRM, outreach and repeat-client systems",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Position",
        body: "Niche, identity, media kit and offer packaging that make the creator commercially clear.",
      },
      {
        step: "02",
        title: "Showcase & convert",
        body: "A portfolio path that shows relevant work, services, proof and an easy inquiry route.",
      },
      {
        step: "03",
        title: "Get discovered",
        body: "Creator SEO and social search optimization around type, niche, format and intent.",
      },
      {
        step: "04",
        title: "Build authority",
        body: "Portfolio content, behind-the-scenes work and personal brand signals that build trust.",
      },
      {
        step: "05",
        title: "Win & retain clients",
        body: "Targeted prospecting, a creator CRM and follow-up that turns collaborations into repeat work.",
      },
    ],
    faqs: [
      {
        q: "Do I need a portfolio website as a UGC creator?",
        a: "You need a credible place for a brand to evaluate your work and contact you. That can be a focused website, a professional creator site or a well-structured Canva portfolio, depending on your stage.",
      },
      {
        q: "Can HQ360 build my UGC portfolio in Canva?",
        a: "Yes. We can structure and design a mobile-friendly Canva portfolio with your positioning, work, services, proof and brand inquiry path.",
      },
      {
        q: "Do I need a large following to work with brands?",
        a: "No. UGC is often purchased for the quality, relevance and usability of the content, not the creator's audience size. A clear offer and strong portfolio make that distinction easier to understand.",
      },
      {
        q: "Can you help organize my brand outreach?",
        a: "Yes. We can help define a relevant prospecting approach, create personalized pitch frameworks and set up a pipeline so opportunities do not live only in scattered DMs and email threads.",
      },
      {
        q: "Can HQ360 set up a CRM for my collaborations?",
        a: "Yes. A creator CRM can track prospects, briefs, proposals, production, delivery, follow-up and rebooking without making your outreach robotic or spammy.",
      },
      {
        q: "Do you guarantee brand deals or search rankings?",
        a: "No. We build the positioning, discovery and acquisition systems intended to improve your ability to generate and convert opportunities. Outcomes depend on your work, market, offer and execution.",
      },
      {
        q: "Can you help turn one-off collaborations into repeat work?",
        a: "Yes. We can map feedback, testimonial, follow-up, new-idea and rebooking moments into a repeat-client or retainer workflow.",
      },
      {
        q: "Can you work with creators outside the USA?",
        a: "Yes. The system is designed for creators and brands working across markets. Location, language, platform and commercial requirements are considered during planning.",
      },
    ],
    cta: {
      label: "Build my creator growth system",
      sub: "A free review of your offers, funnel and owned audience.",
    },
    seo: {
      title: "UGC & Content Creator Growth Services | HQ360",
      description:
        "Branding, portfolio websites, Canva portfolios, SEO, social media and client acquisition systems for UGC and professional content creators.",
    },
  },

  /* ---------------------------------------------------------------- Coaches */
  {
    slug: "coaches",
    path: "/coaches",
    name: "Coaches & Consultants",
    shortName: "Coaches & Consultants",
    category: "Personal Brands & Experts",
    eyebrow: "For coaches, consultants and advisory practices",
    headline: "Fill your calendar with qualified calls, not discovery-call tyre-kickers.",
    subheadline:
      "HQ360 builds the positioning, funnel and follow-up that put the right clients on your calendar and filter out the rest.",
    description:
      "Client acquisition systems for coaches and consultants: positioning, application funnels, paid traffic and nurture that book qualified calls.",
    outcome:
      "A steady flow of qualified, pre-sold discovery calls with clients who can afford the work.",
    outcomes: [
      "A calendar of calls worth taking",
      "Fewer hours lost to unqualified prospects",
      "A channel that does not depend on referrals",
      "Higher show-up and close rates on booked calls",
      "Revenue that is steadier between launches",
    ],
    painPoints: [
      {
        title: "Referrals dried up",
        body: "The practice was built on word of mouth and it has plateaued. There is no system to replace it.",
      },
      {
        title: "Discovery calls are unqualified",
        body: "The calendar fills with people who cannot afford it or are not ready. Hours lost every week.",
      },
      {
        title: "The offer is not clear",
        body: "The positioning tries to serve everyone, so it compels no one and competes on price.",
      },
      {
        title: "Leads go cold before the call",
        body: "Someone books, then ghosts. No reminder sequence, no pre-call nurture, no show-up system.",
      },
      {
        title: "Launches are exhausting",
        body: "Revenue comes in big, stressful pushes with long flat stretches between.",
      },
    ],
    holdingBack: [
      "Positioning that speaks to everyone",
      "No application or qualification step",
      "No paid acquisition channel",
      "No pre-call nurture or reminders",
      "No evergreen offer between launches",
    ],
    howWeHelp: [
      "We sharpen the positioning to one audience and one outcome, then rebuild the site and offer pages around it.",
      "We build an application funnel that qualifies on budget, readiness and fit, so you only spend time on calls worth taking.",
      "Paid traffic and nurture keep the funnel fed, and a reminder and pre-call sequence protects your show-up rate.",
    ],
    recommendedCapabilities: [
      "websites-funnels",
      "lead-generation",
      "crm-automation",
      "brand-creative",
    ],
    services: [
      "Positioning and offer definition",
      "Consultant website and offer pages",
      "Application and qualification funnel",
      "Meta, Google and LinkedIn advertising",
      "Pre-call nurture and reminder automation",
      "Email list and evergreen nurture",
      "Case-study and proof asset production",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Positioning",
        body: "One audience, one outcome, one offer that does not compete on price.",
      },
      {
        step: "02",
        title: "Application funnel",
        body: "A page and form that qualify on fit, budget and readiness before a call is booked.",
      },
      {
        step: "03",
        title: "Paid traffic",
        body: "Campaigns to a cost-per-qualified-call target across the channels your buyers use.",
      },
      {
        step: "04",
        title: "Show-up system",
        body: "Confirmations, reminders and pre-call content that lift attendance and close rate.",
      },
      {
        step: "05",
        title: "Evergreen nurture",
        body: "A sequence that keeps unconverted leads warm until the timing is right.",
      },
    ],
    faqs: [
      {
        q: "I sell high-ticket. Will paid ads work?",
        a: "Yes, when the funnel qualifies hard and the nurture does the selling. The goal is fewer, better calls, not cheap leads.",
      },
      {
        q: "Do you write the offer for me?",
        a: "We pressure-test and refine it with you. A weak offer is the most common reason a good funnel underperforms.",
      },
      {
        q: "How fast can this be live?",
        a: "A first version of the funnel and campaigns is usually live within three to four weeks, then optimised from real data.",
      },
    ],
    cta: {
      label: "Build my client acquisition system",
      sub: "A free audit of your offer, funnel and follow-up.",
    },
    seo: {
      title: "Client Acquisition Systems for Coaches & Consultants | HQ360",
      description:
        "HQ360 builds positioning, application funnels, paid traffic and nurture that fill a coach or consultant's calendar with qualified calls.",
    },
  },

  /* ---------------------------------------------------------- Home services */
  {
    slug: "home-services",
    path: "/home-services",
    name: "Home Service Businesses",
    shortName: "Home Services",
    category: "Local & Home Services",
    eyebrow: "For home service companies and the trades",
    headline: "More booked jobs, less time chasing quotes.",
    subheadline:
      "HQ360 builds the lead generation, booking and follow-up system behind modern home service businesses, from the first click to the review after the job.",
    description:
      "Lead generation and booking systems for home service businesses: local ads, a site built to book, speed-to-lead texting and a review engine.",
    outcome: "A predictable number of booked jobs each week from a system you can see working.",
    outcomes: [
      "Lead channels you own, not just a directory",
      "Every enquiry answered within seconds",
      "More estimates that turn into booked jobs",
      "A review profile that brings in the next lead",
      "Clear reporting on cost per booked job",
    ],
    painPoints: [
      {
        title: "Leads depend on one directory",
        body: "When the lead-seller raises prices or sends junk, the pipeline dries up. No channel you control.",
      },
      {
        title: "Slow to respond",
        body: "A quote request sits for hours. By the time someone calls back, the customer booked a competitor.",
      },
      {
        title: "No-shows and no follow-up",
        body: "Estimates get booked and missed. Nobody chases the ones that did not close.",
      },
      {
        title: "Reviews trickle in",
        body: "Great work, but the online profile does not show it, so the phone rings less than it should.",
      },
      {
        title: "The website does not convert",
        body: "It lists services but makes it hard to actually book. Mobile visitors leave.",
      },
    ],
    holdingBack: [
      "Reliance on bought leads",
      "No speed-to-lead response",
      "Weak or missing Google Business Profile",
      "No estimate follow-up sequence",
      "A site that does not push to book",
    ],
    howWeHelp: [
      "We build a site and landing pages designed to get a mobile visitor to call or book in one or two taps.",
      "Local ads and an optimised Google Business Profile feed it, and an instant text reply reaches every new lead within seconds.",
      "Automated follow-up chases unbooked estimates, and a review system asks every happy customer at the right moment.",
    ],
    recommendedCapabilities: [
      "lead-generation",
      "websites-funnels",
      "crm-automation",
      "visibility-reputation",
    ],
    services: [
      "Service-area website built to book",
      "Local landing pages by service and town",
      "Google and Meta lead campaigns",
      "Google Business Profile optimisation",
      "Speed-to-lead SMS and call routing",
      "Estimate follow-up automation",
      "Review generation system",
      "Database reactivation campaigns",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Booking site",
        body: "Fast pages with call and book buttons above the fold on every service.",
      },
      {
        step: "02",
        title: "Local demand",
        body: "Google and Meta campaigns plus a Google Business Profile tuned for the map pack.",
      },
      {
        step: "03",
        title: "Speed to lead",
        body: "An automatic text and call routing so every enquiry is answered in seconds.",
      },
      {
        step: "04",
        title: "Estimate follow-up",
        body: "Sequences that chase quotes until they book or say no.",
      },
      {
        step: "05",
        title: "Review engine",
        body: "Automated requests after each job to build the profile that drives the next lead.",
      },
    ],
    faqs: [
      {
        q: "We already buy leads from a directory. Should we stop?",
        a: "Not immediately. We build channels you own alongside it, then you can reduce the bought spend as your own pipeline stabilises.",
      },
      {
        q: "Do you handle multiple service areas or trades?",
        a: "Yes. Landing pages and campaigns are structured by service and location so reporting stays clear.",
      },
      {
        q: "Can this connect to our scheduling software?",
        a: "In most cases, yes, through direct integrations or Zapier and Make, so leads and jobs stay in sync.",
      },
    ],
    cta: {
      label: "Build my home services growth system",
      sub: "A free look at your lead flow, response time and reviews.",
    },
    seo: {
      title: "Lead Generation Agency for Home Service Businesses | HQ360",
      description:
        "HQ360 builds local ads, booking-focused websites, speed-to-lead texting and review systems that book more jobs for home service businesses.",
    },
  },

  /* -------------------------------------------------------------- Plumbers */
  {
    slug: "plumbers",
    path: "/plumbers",
    name: "Plumbing Companies",
    shortName: "Plumbers",
    category: "Local & Home Services",
    eyebrow: "For plumbing companies and emergency plumbers",
    headline: "Be the plumber that gets the call, not the third quote.",
    subheadline:
      "HQ360 builds the local visibility, instant response and follow-up that turn emergency searches and quote requests into booked plumbing jobs.",
    description:
      "Marketing systems for plumbing companies: local search, emergency-intent ads, speed-to-lead response and review generation that fill the schedule.",
    outcome: "A full schedule of booked plumbing jobs, with emergency calls answered first.",
    outcomes: [
      "Showing up first for urgent plumbing searches",
      "After-hours leads answered, not missed",
      "Booked on trust and reviews, not just price",
      "Maintenance work pulled from past customers",
      "A local profile that competes in the map pack",
    ],
    painPoints: [
      {
        title: "Losing the emergency search",
        body: "When someone searches a burst pipe at 9pm, a competitor's ad and profile show up first.",
      },
      {
        title: "Quotes go unanswered too long",
        body: "Form fills sit until morning. Emergency work goes to whoever picked up.",
      },
      {
        title: "Booked by price, not trust",
        body: "Without visible reviews and a credible site, every job is a race to the lowest number.",
      },
      {
        title: "Slow seasons hit hard",
        body: "No system to reactivate past customers for maintenance and non-urgent work.",
      },
      {
        title: "Techs are the marketing plan",
        body: "Growth depends on word of mouth from the crew, with nothing behind it.",
      },
    ],
    holdingBack: [
      "Low map-pack visibility",
      "No after-hours lead response",
      "Thin review profile",
      "No maintenance reactivation",
      "A site that does not rank or convert",
    ],
    howWeHelp: [
      "We optimise the Google Business Profile and run emergency-intent search ads so you show up when the problem is urgent.",
      "An instant text-back and call routing system answers every lead in seconds, day or night.",
      "Automated review requests build the profile that wins the next call, and reactivation campaigns pull maintenance work out of your existing customer list.",
    ],
    recommendedCapabilities: [
      "visibility-reputation",
      "lead-generation",
      "crm-automation",
      "websites-funnels",
    ],
    services: [
      "Google Business Profile and local SEO",
      "Emergency-intent Google search ads",
      "Plumbing website built to call and book",
      "Speed-to-lead SMS and after-hours routing",
      "Review generation after every job",
      "Maintenance reactivation campaigns",
      "Service and location landing pages",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Local visibility",
        body: "Google Business Profile optimisation and citations to compete in the map pack.",
      },
      {
        step: "02",
        title: "Emergency ads",
        body: "Search campaigns targeting urgent plumbing intent with call-first ad formats.",
      },
      {
        step: "03",
        title: "Instant response",
        body: "Text-back and call routing so no after-hours emergency is missed.",
      },
      {
        step: "04",
        title: "Review engine",
        body: "Automatic requests after each job to build a profile that wins the next one.",
      },
      {
        step: "05",
        title: "Reactivation",
        body: "Seasonal outreach to past customers for maintenance and non-urgent work.",
      },
    ],
    faqs: [
      {
        q: "Most of our work is emergencies. Does content matter?",
        a: "Less than response speed and local visibility. We prioritise the Google Business Profile, search ads and instant response first.",
      },
      {
        q: "Can you route leads to an on-call phone after hours?",
        a: "Yes. Call routing and text-back rules are set to your schedule so urgent jobs always reach someone.",
      },
      {
        q: "How quickly could we see more calls?",
        a: "Profile and ad changes can lift call volume within the first few weeks. Organic ranking takes longer and we report the leading indicators.",
      },
    ],
    cta: {
      label: "Build my plumbing growth system",
      sub: "A free check of your local visibility and lead response.",
    },
    seo: {
      title: "Marketing Agency for Plumbing Companies | HQ360",
      description:
        "HQ360 builds local search, emergency-intent ads, instant lead response and review systems that fill plumbers' schedules with booked jobs.",
    },
  },

  /* --------------------------------------------------------------- Roofers */
  {
    slug: "roofers",
    path: "/roofers",
    name: "Roofing Companies",
    shortName: "Roofers",
    category: "Local & Home Services",
    eyebrow: "For roofing contractors and storm-response crews",
    headline: "Book roofing inspections while the demand is still hot.",
    subheadline:
      "HQ360 builds the lead generation, fast response and follow-up that turn storm-season and replacement demand into signed roofing jobs.",
    description:
      "Marketing systems for roofing companies: paid lead generation, inspection-booking funnels, speed-to-lead response and estimate follow-up.",
    outcome:
      "A steady pipeline of booked inspections and signed roofing contracts through the season.",
    outcomes: [
      "An always-on lead channel beyond door-knocking",
      "Fast response that holds up during storm surges",
      "More bids signed through structured follow-up",
      "Homeowners guided through insurance claims",
      "A review and referral loop that lowers lead cost",
    ],
    painPoints: [
      {
        title: "Demand spikes, capacity to respond does not",
        body: "After a storm the phones flood, then leads are lost because follow-up cannot keep up.",
      },
      {
        title: "Door-knocking does not scale",
        body: "Growth is capped by how many crews can canvass, with nothing generating leads in the background.",
      },
      {
        title: "Long sales cycle, weak follow-up",
        body: "Homeowners get three bids over weeks. Without nurture, the job goes to whoever stayed in touch.",
      },
      {
        title: "Insurance jobs stall",
        body: "No clear process or content to guide homeowners through claims, so deals drag or die.",
      },
      {
        title: "Reviews do not reflect the work",
        body: "Quality roofs, but a thin online profile that does not build trust before the inspection.",
      },
    ],
    holdingBack: [
      "No always-on lead channel",
      "Slow lead response during surges",
      "No structured estimate follow-up",
      "No claims-guidance content",
      "Weak review and referral system",
    ],
    howWeHelp: [
      "We run paid campaigns for replacement and storm-damage intent into an inspection-booking funnel built for mobile.",
      "Speed-to-lead automation and a nurture sequence keep every homeowner engaged through a multi-week decision.",
      "Estimate follow-up chases unsigned bids, and a review and referral system compounds trust for the next job.",
    ],
    recommendedCapabilities: [
      "lead-generation",
      "websites-funnels",
      "crm-automation",
      "visibility-reputation",
    ],
    services: [
      "Roofing website and inspection funnel",
      "Meta and Google storm and replacement campaigns",
      "Speed-to-lead SMS and call routing",
      "Estimate and bid follow-up automation",
      "Insurance-claim guidance content",
      "Review and referral system",
      "Google Business Profile optimisation",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Inspection funnel",
        body: "A mobile page with one job: book a roof inspection.",
      },
      {
        step: "02",
        title: "Intent campaigns",
        body: "Paid traffic for storm-damage and replacement searches, scaled with demand.",
      },
      {
        step: "03",
        title: "Instant + nurture",
        body: "Speed-to-lead reply plus a sequence that holds attention across a weeks-long decision.",
      },
      {
        step: "04",
        title: "Bid follow-up",
        body: "Automated chase on unsigned estimates until a decision.",
      },
      {
        step: "05",
        title: "Referral loop",
        body: "Post-job review and referral requests that lower the cost of the next lead.",
      },
    ],
    faqs: [
      {
        q: "Can you scale spend up after a storm and down afterward?",
        a: "Yes. Campaigns are built to flex with demand so you are not paying for volume you cannot service.",
      },
      {
        q: "Do you help with insurance-claim jobs?",
        a: "We build the content and follow-up that guide homeowners through the process. The claim itself stays with you and the adjuster.",
      },
      {
        q: "Is this only for retail, or commercial too?",
        a: "Both, with separate funnels and messaging. Commercial runs a longer nurture and a different proof set.",
      },
    ],
    cta: {
      label: "Build my roofing growth system",
      sub: "A free review of your lead flow and estimate follow-up.",
    },
    seo: {
      title: "Marketing Agency for Roofing Companies | HQ360",
      description:
        "HQ360 builds paid lead generation, inspection funnels, speed-to-lead response and estimate follow-up that book more roofing jobs.",
    },
  },

  /* ------------------------------------------------------------------ HVAC */
  {
    slug: "hvac",
    path: "/hvac",
    name: "HVAC Companies",
    shortName: "HVAC",
    category: "Local & Home Services",
    eyebrow: "For heating, cooling and air quality companies",
    headline: "Fill the schedule in shoulder season, not just the heatwave.",
    subheadline:
      "HQ360 builds the demand generation, membership growth and reactivation that keep HVAC crews booked all year, not only when it breaks.",
    description:
      "Marketing systems for HVAC companies: seasonal demand campaigns, maintenance-plan growth, speed-to-lead response and customer reactivation.",
    outcome:
      "A booked schedule across the whole year, with replacement and membership revenue on top of repairs.",
    outcomes: [
      "Demand in shoulder season, not just peak",
      "More repair calls converted to replacements",
      "A growing base of maintenance-plan members",
      "Revenue reactivated from past service records",
      "Emergency calls captured, not lost to speed",
    ],
    painPoints: [
      {
        title: "Feast and famine by season",
        body: "Slammed in July, quiet in April. Nothing generates work in the shoulder months.",
      },
      {
        title: "Repairs, not replacements",
        body: "Techs fix units that should be quoted for replacement, and the higher-value job is left on the table.",
      },
      {
        title: "Maintenance plans are undersold",
        body: "The recurring revenue that smooths the year is offered inconsistently and never followed up.",
      },
      {
        title: "Old customers are forgotten",
        body: "Thousands of past service records and no system to bring them back for tune-ups or upgrades.",
      },
      {
        title: "Emergency leads slip",
        body: "No-cooling calls in a heatwave go to whoever answered first.",
      },
    ],
    holdingBack: [
      "No shoulder-season demand plan",
      "No replacement-quote follow-up",
      "Inconsistent maintenance-plan offer",
      "No reactivation of the customer base",
      "Slow emergency lead response",
    ],
    howWeHelp: [
      "We plan campaigns by season — cooling, heating, air quality, tune-ups — so there is always a reason to call.",
      "Replacement-quote follow-up and financing-friendly pages lift the value of each opportunity, and a membership funnel builds recurring revenue.",
      "Reactivation campaigns work your existing service history, and speed-to-lead automation protects the emergency calls.",
    ],
    recommendedCapabilities: [
      "lead-generation",
      "crm-automation",
      "websites-funnels",
      "visibility-reputation",
    ],
    services: [
      "Seasonal demand campaigns",
      "HVAC website with financing-friendly quote pages",
      "Maintenance-plan membership funnel",
      "Replacement-quote follow-up automation",
      "Customer reactivation campaigns",
      "Speed-to-lead SMS and call routing",
      "Google Business Profile and review system",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Seasonal calendar",
        body: "Cooling, heating, air-quality and tune-up campaigns mapped across the year.",
      },
      {
        step: "02",
        title: "Quote pages",
        body: "Replacement and financing pages that make the bigger job an easy yes.",
      },
      {
        step: "03",
        title: "Membership funnel",
        body: "An offer and follow-up flow that grows maintenance-plan revenue.",
      },
      {
        step: "04",
        title: "Reactivation",
        body: "Automated outreach to past service customers for tune-ups and upgrades.",
      },
      {
        step: "05",
        title: "Emergency capture",
        body: "Instant response and routing for no-heat and no-cool calls.",
      },
    ],
    faqs: [
      {
        q: "Can you import our service history for reactivation?",
        a: "Yes, in most cases, through a CRM import or an integration with your field-service software. Clean data makes reactivation the fastest win.",
      },
      {
        q: "Do you sell the maintenance plan for us?",
        a: "We build the offer, the page and the follow-up. Your team still closes, but with a system prompting every touchpoint.",
      },
      {
        q: "Is financing messaging compliant?",
        a: "We follow your financing partner's approved language and disclosures. We do not invent terms.",
      },
    ],
    cta: {
      label: "Build my HVAC growth system",
      sub: "A free look at your seasonal demand and reactivation potential.",
    },
    seo: {
      title: "Marketing Agency for HVAC Companies | HQ360",
      description:
        "HQ360 builds seasonal demand campaigns, maintenance-plan funnels, replacement follow-up and reactivation that keep HVAC crews booked year-round.",
    },
  },

  /* ---------------------------------------------------------------- Med spas */
  {
    slug: "med-spas",
    path: "/med-spas",
    name: "Med Spas & Beauty Businesses",
    shortName: "Med Spas & Beauty",
    category: "Local & Home Services",
    eyebrow: "For med spas, aesthetic clinics and beauty studios",
    headline: "A full appointment book and clients who come back.",
    subheadline:
      "HQ360 builds the local visibility, booking funnels and retention automation that keep a med spa's calendar full and its regulars loyal.",
    description:
      "Marketing systems for med spas and beauty businesses: local ads, treatment booking funnels, membership growth and rebooking automation.",
    outcome:
      "A consistently booked calendar and higher client lifetime value from memberships and rebooking.",
    outcomes: [
      "A calendar that stays full without constant discounts",
      "First-time clients who rebook",
      "A booking path that ends in a confirmed appointment",
      "Predictable revenue from memberships and packages",
      "Ad accounts that stay compliant and live",
    ],
    painPoints: [
      {
        title: "Quiet weeks between promotions",
        body: "Discount pushes fill the book briefly, then it empties and the discounting resets the price.",
      },
      {
        title: "First-time clients do not return",
        body: "No rebooking prompt at checkout, no follow-up, so acquisition cost is paid again and again.",
      },
      {
        title: "Booking is high-friction",
        body: "Instagram to DM to phone tag. Prospects lose interest before they reach a calendar.",
      },
      {
        title: "Memberships and packages are underused",
        body: "The recurring revenue that stabilises a clinic is offered inconsistently.",
      },
      {
        title: "Compliance limits the ads",
        body: "Before-and-after content and claims get accounts restricted when handled carelessly.",
      },
    ],
    holdingBack: [
      "Reliance on discounting to fill the book",
      "No rebooking or retention system",
      "High-friction booking path",
      "Weak membership and package funnel",
      "Ad content that risks account restrictions",
    ],
    howWeHelp: [
      "We run compliant local campaigns into a treatment-specific booking funnel that takes a prospect from ad to confirmed appointment.",
      "Rebooking prompts, post-treatment follow-up and a membership funnel raise how much each client is worth over time.",
      "Consult-to-treatment nurture and a review system keep the calendar full without leaning on constant offers.",
    ],
    recommendedCapabilities: [
      "lead-generation",
      "websites-funnels",
      "crm-automation",
      "content-social",
    ],
    services: [
      "Treatment-specific booking funnels",
      "Compliant Meta and Google campaigns",
      "Consult-to-treatment nurture automation",
      "Membership and package funnel",
      "Rebooking and retention sequences",
      "Review generation system",
      "Content and before-after direction within platform rules",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Booking funnel",
        body: "A page per treatment that ends in a confirmed appointment, not a DM.",
      },
      {
        step: "02",
        title: "Compliant demand",
        body: "Local campaigns built to platform rules for aesthetic and medical content.",
      },
      {
        step: "03",
        title: "Consult nurture",
        body: "Follow-up that moves consults to booked treatments.",
      },
      {
        step: "04",
        title: "Retention",
        body: "Rebooking prompts and post-treatment sequences that raise lifetime value.",
      },
      {
        step: "05",
        title: "Membership growth",
        body: "An offer and funnel that build predictable recurring revenue.",
      },
    ],
    faqs: [
      {
        q: "Our ad account keeps getting flagged. Can you fix that?",
        a: "Often. Most restrictions come from claims and imagery that break platform policy. We build campaigns to the rules and keep the account healthy.",
      },
      {
        q: "Can this integrate with our booking software?",
        a: "Usually yes, so appointments, reminders and follow-up stay connected to the system your front desk uses.",
      },
      {
        q: "Do you provide the before-and-after content?",
        a: "We direct and edit what you capture in-clinic, within consent and platform requirements. We do not fabricate results imagery.",
      },
    ],
    cta: {
      label: "Build my med spa growth system",
      sub: "A free review of your booking path and retention.",
    },
    seo: {
      title: "Marketing Agency for Med Spas & Beauty Businesses | HQ360",
      description:
        "HQ360 builds compliant local ads, treatment booking funnels, membership growth and rebooking automation that keep a med spa's calendar full.",
    },
  },

  /* -------------------------------------------------------------- Real estate */
  {
    slug: "real-estate",
    path: "/real-estate",
    name: "Real Estate Agents & Teams",
    shortName: "Real Estate",
    category: "Sales & Professional Teams",
    eyebrow: "For agents, teams and brokerages",
    headline: "More listings. More appointments. Less chasing cold leads.",
    subheadline:
      "HQ360 builds the digital growth system behind modern real estate professionals, from lead generation and high-converting websites to CRM automation that follows up when you cannot.",
    description:
      "Growth systems for real estate agents and teams: lead generation, IDX and landing pages, GoHighLevel CRM, automated follow-up and database reactivation.",
    outcome:
      "A pipeline of seller and buyer appointments fed by a system that follows up on every lead.",
    outcomes: [
      "Every lead contacted within minutes",
      "Follow-up that continues for months, automatically",
      "A dedicated engine for seller appointments",
      "Tools that talk to each other, not silos",
      "Appointments generated from your existing database",
    ],
    painPoints: [
      {
        title: "Leads go cold before the callback",
        body: "Portal and ad leads sit for hours. By the time you call, they have spoken to three other agents.",
      },
      {
        title: "Follow-up stops after two attempts",
        body: "Most deals need many touches over months. Manual follow-up runs out of steam long before that.",
      },
      {
        title: "Weak online positioning",
        body: "A generic brokerage profile that looks like every other agent in the market.",
      },
      {
        title: "Disconnected tools",
        body: "Portal, ads, CRM, calendar and email all separate, so data is re-keyed and leads fall through gaps.",
      },
      {
        title: "The database is dead weight",
        body: "Thousands of past leads and clients sitting in a CRM with no campaign touching them.",
      },
      {
        title: "Listing generation is inconsistent",
        body: "Buyer leads come in, but there is no engine specifically for seller appointments.",
      },
    ],
    holdingBack: [
      "No speed-to-lead response",
      "No long-term nurture",
      "No seller-specific lead engine",
      "Tools that do not talk to each other",
      "A database nobody is working",
    ],
    howWeHelp: [
      "We build high-converting landing pages for buyers and sellers, and connect them to a GoHighLevel CRM set up around your pipeline.",
      "Meta and Google campaigns feed the funnel, and speed-to-lead SMS plus a long nurture sequence work every lead for months, not days.",
      "Then we reactivate your existing database with structured campaigns, so booked appointments come from a list you already paid for.",
    ],
    recommendedCapabilities: [
      "lead-generation",
      "crm-automation",
      "websites-funnels",
      "visibility-reputation",
    ],
    services: [
      "Agent and team website with IDX or search",
      "Seller and buyer landing pages",
      "Meta and Google lead campaigns",
      "GoHighLevel CRM setup and pipeline",
      "Speed-to-lead SMS and call routing",
      "Long-term email and SMS nurture",
      "Appointment booking and reminders",
      "Database reactivation campaigns",
      "Review and referral system",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Seller & buyer pages",
        body: "Home-valuation and search landing pages built to capture and qualify.",
      },
      {
        step: "02",
        title: "Lead campaigns",
        body: "Meta and Google traffic to a cost-per-appointment target.",
      },
      {
        step: "03",
        title: "Speed to lead",
        body: "Instant SMS and call routing so every lead is contacted within minutes.",
      },
      {
        step: "04",
        title: "Long nurture",
        body: "A months-long sequence that stays in front of leads until they transact.",
      },
      {
        step: "05",
        title: "Database reactivation",
        body: "Campaigns to past leads and clients that pull appointments from your existing list.",
      },
    ],
    faqs: [
      {
        q: "We already use a CRM. Do we have to switch?",
        a: "Not necessarily. We work primarily in GoHighLevel, but we assess what you have and recommend switching only if the gains clearly justify it.",
      },
      {
        q: "Do you guarantee a number of listings or deals?",
        a: "No. We set appointment targets from your market and ad budget, report weekly, and adjust. Transaction outcomes depend on your sales process too.",
      },
      {
        q: "Can this work for a solo agent, not just a team?",
        a: "Yes. The system scales down — a solo agent benefits most from speed-to-lead and database reactivation.",
      },
      {
        q: "Who owns the ad account and CRM?",
        a: "You do. Everything is built in your accounts so it keeps running if we part ways.",
      },
    ],
    cta: {
      label: "Build my real estate growth system",
      sub: "A free review of your lead flow, follow-up and database.",
    },
    seo: {
      title: "Digital Growth Agency for Real Estate Agents | HQ360",
      description:
        "HQ360 builds lead generation, high-converting landing pages, GoHighLevel CRM and automated follow-up that book more appointments for real estate agents and teams.",
    },
  },

  /* -------------------------------------------------------------- Law firms */
  {
    slug: "law-firms",
    path: "/law-firms",
    name: "Law Firms & Professional Services",
    shortName: "Law & Professional Services",
    category: "Sales & Professional Teams",
    eyebrow: "For law firms, accountants and professional practices",
    headline: "Turn enquiries into signed clients without the intake bottleneck.",
    subheadline:
      "HQ360 builds the visibility, intake and follow-up systems that help professional practices win the right matters and stop losing enquiries to slow response.",
    description:
      "Growth systems for law firms and professional services: local and organic visibility, intake automation, nurture and reputation management.",
    outcome:
      "More signed clients from the enquiries you already get, plus a steady flow of new ones.",
    outcomes: [
      "Every enquiry captured and answered fast",
      "Consultations spent on matters you will take",
      "Visibility for the practice areas that matter",
      "A review profile that reflects the real client base",
      "A channel that is not only referrals",
    ],
    painPoints: [
      {
        title: "Enquiries lost to slow intake",
        body: "A prospective client calls, gets voicemail, and retains the firm that called back first.",
      },
      {
        title: "Wrong-fit matters clog the calendar",
        body: "No qualification step, so fee earners spend consultations on matters the firm will not take.",
      },
      {
        title: "Invisible in local and organic search",
        body: "For the practice areas that matter, competitors own the first page and the map pack.",
      },
      {
        title: "Reputation is unmanaged",
        body: "A few negative reviews outweigh dozens of satisfied clients who were never asked.",
      },
      {
        title: "Referrals are the only channel",
        body: "Steady, but flat, and vulnerable to a single referrer moving on.",
      },
    ],
    holdingBack: [
      "No fast, structured intake",
      "No lead qualification step",
      "Weak local and practice-area SEO",
      "No review or reputation system",
      "No channel beyond referrals",
    ],
    howWeHelp: [
      "We build an intake system that captures every enquiry, qualifies it against your criteria and routes it to the right person quickly.",
      "Local and practice-area SEO plus targeted content make the firm visible for the matters it wants, and a review system builds the credibility that closes them.",
      "Nurture keeps slower-moving matters warm, so a consultation that is not ready today is not lost.",
    ],
    recommendedCapabilities: [
      "visibility-reputation",
      "crm-automation",
      "websites-funnels",
      "lead-generation",
    ],
    services: [
      "Practice-area and location SEO",
      "Firm website and practice-area pages",
      "Intake capture and qualification automation",
      "Consultation booking and reminders",
      "Matter-appropriate nurture sequences",
      "Review generation and reputation monitoring",
      "Targeted search and LinkedIn campaigns",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Visibility",
        body: "SEO and content for the practice areas and locations the firm wants to be known for.",
      },
      {
        step: "02",
        title: "Intake system",
        body: "Every enquiry captured, qualified against firm criteria and routed fast.",
      },
      {
        step: "03",
        title: "Consultation flow",
        body: "Booking, reminders and pre-consultation information that lift attendance.",
      },
      {
        step: "04",
        title: "Nurture",
        body: "Sequences that keep not-yet-ready matters engaged until the timing is right.",
      },
      {
        step: "05",
        title: "Reputation",
        body: "A steady review cadence and monitoring that protect the firm's standing.",
      },
    ],
    faqs: [
      {
        q: "Is marketing automation compliant for a regulated practice?",
        a: "Handled properly, yes. We work within your jurisdiction's advertising rules and your professional body's guidance, and we keep messaging factual.",
      },
      {
        q: "We do not want more volume, we want better matters.",
        a: "That is the point of the qualification step. The system is tuned to sign the right work, not to maximise raw enquiries.",
      },
      {
        q: "Can you work across several practice areas?",
        a: "Yes. Each area gets its own pages, campaigns and intake routing so reporting and follow-up stay clear.",
      },
    ],
    cta: {
      label: "Build my firm's growth system",
      sub: "A free review of your intake, visibility and reputation.",
    },
    seo: {
      title: "Growth Agency for Law Firms & Professional Services | HQ360",
      description:
        "HQ360 builds visibility, intake automation, nurture and reputation systems that help law firms and professional practices sign more of the right clients.",
    },
  },

  /* --------------------------------------------------------------- Agencies */
  {
    slug: "agencies",
    path: "/agencies",
    name: "Agencies",
    shortName: "Agencies",
    category: "Sales & Professional Teams",
    eyebrow: "For agencies, studios and consultancies",
    headline: "A sales pipeline for your agency, so you can focus on client work.",
    subheadline:
      "HQ360 builds the positioning, outbound and delivery capacity that let agencies win better retainers without the founder doing all the selling.",
    description:
      "Growth and white-label delivery for agencies: positioning, outbound systems, inbound funnels and overflow capacity in creative, web, CRM and paid.",
    outcome: "A predictable agency pipeline and the capacity to deliver what you sell.",
    outcomes: [
      "Pipeline that does not depend on the founder",
      "Positioning that stops the race to the bottom on price",
      "A retainer base under the project revenue",
      "Delivery capacity in the capabilities you do not staff",
      "Case studies packaged to win the next deal",
    ],
    painPoints: [
      {
        title: "Growth stops when the founder stops selling",
        body: "New business depends entirely on one person's network and time.",
      },
      {
        title: "Positioning is 'full service'",
        body: "The pitch sounds like every other agency, so it competes on price and scope creep.",
      },
      {
        title: "Feast-and-famine project revenue",
        body: "Big projects land, then a gap. No retainer base to smooth it.",
      },
      {
        title: "Delivery gaps in some capabilities",
        body: "You sell strategy well but scramble to staff web builds, CRM work or paid media.",
      },
      {
        title: "Case studies do not exist",
        body: "Great work shipped, but nothing packaged to sell the next deal.",
      },
    ],
    holdingBack: [
      "Founder-dependent sales",
      "Undifferentiated positioning",
      "No outbound system",
      "Capability gaps in delivery",
      "No packaged proof",
    ],
    howWeHelp: [
      "We sharpen the agency's positioning to a category it can own, then build the site and proof assets that back it.",
      "We stand up an outbound and inbound system — targeted lists, sequences and a funnel — so pipeline is not one person's job.",
      "And we can deliver white-label in the capabilities you do not staff: brand, web and funnels, CRM and automation, or paid media, under your name.",
    ],
    recommendedCapabilities: [
      "brand-creative",
      "lead-generation",
      "websites-funnels",
      "crm-automation",
    ],
    services: [
      "Agency positioning and offer design",
      "Website and case-study production",
      "Outbound list building and sequences",
      "Inbound lead funnel and CRM",
      "White-label web and funnel builds",
      "White-label CRM and automation",
      "White-label paid media management",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Positioning",
        body: "A category the agency can own, with an offer and proof to match.",
      },
      {
        step: "02",
        title: "Proof assets",
        body: "Case studies and a site that make the next pitch easier.",
      },
      {
        step: "03",
        title: "Outbound engine",
        body: "Targeted lists and sequences that generate pipeline without the founder.",
      },
      {
        step: "04",
        title: "Inbound funnel",
        body: "A qualification funnel and CRM for the enquiries the positioning attracts.",
      },
      {
        step: "05",
        title: "Delivery capacity",
        body: "White-label support in the capabilities you do not staff, under your brand.",
      },
    ],
    faqs: [
      {
        q: "Is the white-label work truly under our brand?",
        a: "Yes. No HQ360 branding on deliverables or client-facing communication unless you want us named.",
      },
      {
        q: "Will you take our clients?",
        a: "No. White-label engagements include a non-solicitation agreement.",
      },
      {
        q: "Can you only do the growth side, not delivery?",
        a: "Yes. Positioning, outbound and inbound systems stand on their own. Delivery capacity is there if and when you need it.",
      },
    ],
    cta: {
      label: "Build my agency's growth system",
      sub: "A free review of your positioning, pipeline and delivery gaps.",
    },
    seo: {
      title: "Growth & White-Label Delivery for Agencies | HQ360",
      description:
        "HQ360 builds positioning, outbound and inbound systems and white-label delivery capacity so agencies win better retainers without founder-only sales.",
    },
  },

  /* --------------------------------------------------------- Local business */
  {
    slug: "local-business",
    path: "/local-business",
    name: "Local Businesses",
    shortName: "Local Business",
    category: "Local & Home Services",
    eyebrow: "For restaurants, retail, gyms, clinics and local service brands",
    headline: "Be the obvious choice in your area.",
    subheadline:
      "HQ360 builds the local visibility, offers and follow-up that turn nearby searches and walk-past traffic into regulars.",
    description:
      "Growth systems for local businesses: Google Business Profile, local ads, offer funnels, review generation and customer reactivation.",
    outcome: "More first visits from your area, and more of them turning into repeat customers.",
    outcomes: [
      "Found first for the searches that matter locally",
      "Interest captured instead of walking away",
      "A review profile that reflects your regulars",
      "First-time customers who come back",
      "Marketing you can actually measure",
    ],
    painPoints: [
      {
        title: "Hard to find online",
        body: "The Google Business Profile is incomplete, and the website barely ranks for the obvious searches.",
      },
      {
        title: "No way to capture interest",
        body: "People discover the business and leave with nothing — no offer, no email, no reason to return.",
      },
      {
        title: "Reviews do not reflect reality",
        body: "Loyal customers, but a thin or dated review profile that undersells the place.",
      },
      {
        title: "One-time customers stay one-time",
        body: "No list, no offers, no follow-up to bring a first visit back.",
      },
      {
        title: "Marketing is random",
        body: "The occasional boosted post with no plan, no tracking and no idea what worked.",
      },
    ],
    holdingBack: [
      "Incomplete Google Business Profile",
      "No local search presence",
      "No lead capture or offer",
      "No review system",
      "No repeat-customer follow-up",
    ],
    howWeHelp: [
      "We fix the fundamentals: an optimised Google Business Profile, a fast local site and a first-visit offer worth opting in for.",
      "Local ads bring new people in, and a review system turns happy customers into the proof that brings the next ones.",
      "A simple list and offer calendar keep regulars coming back, so acquisition is not paid for twice.",
    ],
    recommendedCapabilities: [
      "visibility-reputation",
      "websites-funnels",
      "lead-generation",
      "crm-automation",
    ],
    services: [
      "Google Business Profile optimisation",
      "Local website and offer landing pages",
      "First-visit offer and email or SMS capture",
      "Local Meta and Google campaigns",
      "Review generation system",
      "Repeat-customer offers and reactivation",
      "Local SEO and citations",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Get found",
        body: "Google Business Profile, citations and a site tuned for local searches.",
      },
      {
        step: "02",
        title: "Capture interest",
        body: "A first-visit offer that turns a discovery into a contact you can reach again.",
      },
      {
        step: "03",
        title: "Bring people in",
        body: "Local paid campaigns to the offer, measured on redemptions.",
      },
      {
        step: "04",
        title: "Build proof",
        body: "An automated review request after each visit or purchase.",
      },
      {
        step: "05",
        title: "Bring them back",
        body: "An offer calendar and reactivation messages to your customer list.",
      },
    ],
    faqs: [
      {
        q: "We are a single location. Is this overkill?",
        a: "No. A single location benefits most from the basics done well — profile, reviews, a first-visit offer and a list.",
      },
      {
        q: "We do not collect emails. Can you still help?",
        a: "Yes. Setting up simple capture — a first-visit offer or loyalty sign-up — is usually the highest-return first step.",
      },
      {
        q: "Do you handle the ads and the creative?",
        a: "Yes, both, plus the tracking so you can see which campaigns bring people through the door.",
      },
    ],
    cta: {
      label: "Build my local growth system",
      sub: "A free check of your local presence, capture and reviews.",
    },
    seo: {
      title: "Local Business Marketing & Lead Generation | HQ360",
      description:
        "HQ360 builds Google Business Profile, local ads, offer funnels, review generation and reactivation that turn nearby searches into regulars.",
    },
  },

  /* ------------------------------------------------------- E-commerce & DTC */
  {
    slug: "ecommerce",
    path: "/ecommerce",
    name: "E-commerce & DTC Brands",
    shortName: "E-commerce & DTC",
    category: "Commerce & Product Brands",
    eyebrow: "For e-commerce, DTC and product brands on Shopify, WooCommerce and beyond",
    headline: "Turn more product interest into purchases — and purchases into repeat customers.",
    subheadline:
      "HQ360 connects brand, storefront, SEO, acquisition, automation and retention into one growth system for e-commerce and DTC brands. Not just a new store design — the system around the whole customer journey.",
    description:
      "A connected growth system for e-commerce and DTC brands: brand and product creative, Shopify and WooCommerce storefronts, CRO, e-commerce SEO, paid acquisition, cart recovery, retention email and analytics.",
    outcome: "A store that keeps finding buyers, converting them, and bringing them back.",
    outcomes: [
      "Product pages that make the value obvious and the decision easy",
      "A mobile store people can actually browse and check out on",
      "Discovery from search and shopping, not only paid traffic",
      "Recovered revenue from browse, cart and checkout drop-off",
      "A post-purchase path that earns the second and third order",
      "One team owning the whole journey, not five disconnected tools",
    ],
    painPoints: [
      {
        title: "Traffic comes, sales don't follow",
        body: "Ads and posts bring visitors, but the product pages, navigation and mobile checkout lose them before the order.",
      },
      {
        title: "Great product, average presentation",
        body: "The product is genuinely good, but the brand, photography and page layout make it look like everyone else's.",
      },
      {
        title: "Invisible when people are searching",
        body: "No product or collection SEO, no Merchant Center feed, so discovery depends entirely on paid traffic you rent.",
      },
      {
        title: "Revenue leaks and nothing catches it",
        body: "People browse, add to cart, start checkout and leave — with no browse, cart or checkout follow-up to bring them back.",
      },
      {
        title: "First-time buyers stay first-time",
        body: "No welcome flow, no post-purchase sequence, no win-back. Every order is acquired from scratch at full cost.",
      },
    ],
    holdingBack: [
      "Product pages that list features, not value",
      "A checkout journey that leaks on mobile",
      "No e-commerce SEO or product feed",
      "No browse, cart or checkout recovery",
      "No welcome, post-purchase or win-back flows",
      "Analytics that can't show where the money leaks",
    ],
    howWeHelp: [
      "We start with a Store Growth Audit across ten areas — brand, storefront, product pages, mobile, SEO, acquisition, conversion, cart and checkout, automation, retention and analytics — and name the one bottleneck costing the most right now.",
      "Then we build only what moves it: usually storefront and product-page CRO first, e-commerce SEO and a cleaned-up product feed for discovery, and Klaviyo or Omnisend flows to recover browse, cart and checkout abandonment.",
      "Retention email, win-back and new-product campaigns turn the first order into a relationship, and GA4 plus funnel analytics keep showing where to improve next — so acquisition isn't paid for twice.",
    ],
    recommendedCapabilities: [
      "websites-funnels",
      "lead-generation",
      "crm-automation",
      "visibility-reputation",
    ],
    services: [
      "Shopify and WooCommerce store design and redesign",
      "Product and collection page CRO",
      "Mobile commerce optimisation",
      "E-commerce and product SEO with Merchant Center feed",
      "Meta, Google Shopping and TikTok acquisition",
      "Browse, cart and checkout recovery (Klaviyo / Omnisend)",
      "Post-purchase, win-back and replenishment email",
      "GA4, funnel and CRO analytics",
    ],
    growthSystem: [
      {
        step: "01",
        title: "Position — brand & creative",
        body: "Positioning, product messaging and commercial creative so the product looks worth buying before a visitor reads a word.",
      },
      {
        step: "02",
        title: "Convert — store & CRO",
        body: "Shopify or WooCommerce storefront, collection and product pages, and mobile checkout tuned to turn visits into orders.",
      },
      {
        step: "03",
        title: "Get discovered — e-commerce SEO",
        body: "Product and collection keyword work, technical and structured data, and a clean Merchant Center feed for Shopping.",
      },
      {
        step: "04",
        title: "Acquire — digital marketing",
        body: "Meta, Google Shopping and TikTok campaigns to product and campaign pages — after checking platform and category eligibility.",
      },
      {
        step: "05",
        title: "Recover & nurture — CRM & automation",
        body: "Welcome, browse-abandonment, cart and checkout recovery flows that bring drop-off back without spammy messaging.",
      },
      {
        step: "06",
        title: "Retain — email & customer marketing",
        body: "Post-purchase education, review requests, cross-sell, win-back and new-product campaigns that earn repeat orders.",
      },
      {
        step: "07",
        title: "Scale — analytics & optimisation",
        body: "GA4, funnel and creative analysis plus CRO testing on product pages, offers and bundles to improve the whole system.",
      },
    ],
    faqs: [
      {
        q: "Can HQ360 redesign my existing store, or improve it without a full rebuild?",
        a: "Both. Often the highest-return work is targeted — rebuilding product and collection pages, fixing mobile checkout friction and adding recovery flows — without touching the rest of the store. The audit tells us which.",
      },
      {
        q: "Do you work with Shopify and WooCommerce?",
        a: "Yes, both. If you're on another platform, tell us what it is and we'll say honestly whether we can support it well or would recommend a migration.",
      },
      {
        q: "Can you set up abandoned-cart and email marketing for my store?",
        a: "Yes. We build browse, cart and checkout recovery plus welcome, post-purchase and win-back flows, usually in Klaviyo or Omnisend, integrated with your store.",
      },
      {
        q: "Do you provide e-commerce SEO?",
        a: "Yes — product and collection keyword research, technical SEO, product structured data, internal linking, and product-feed optimisation for Google Shopping. No guaranteed rankings; anyone promising those isn't being straight with you.",
      },
      {
        q: "Can you help with Meta or Google Ads?",
        a: "Yes, where the product category and platform policies allow. Some categories have advertising restrictions, so we check eligibility before recommending a channel or promising spend.",
      },
      {
        q: "Do you guarantee sales, ROAS or a revenue increase?",
        a: "No. We set realistic targets from your data, tell you what it would take, and report against them. Guaranteed revenue or ROAS claims in e-commerce are a red flag.",
      },
      {
        q: "Can you work with stores outside the USA?",
        a: "Yes. The team works remotely across time zones and a large share of clients are in the USA, but the work isn't US-only.",
      },
      {
        q: "Do I need every stage of the growth system?",
        a: "No. Most brands start with one or two — usually storefront CRO and cart recovery. We identify the biggest current bottleneck and begin there.",
      },
    ],
    cta: {
      label: "Build my e-commerce growth system",
      sub: "Starts with a free Store Growth Audit across brand, storefront, product pages, SEO, acquisition, automation, retention and analytics.",
    },
    seo: {
      title: "E-commerce & DTC Growth Services | HQ360",
      description:
        "HQ360 connects e-commerce branding, storefront design, SEO, acquisition, automation, retention and optimization into one growth system for product brands.",
    },
  },
];

export const INDUSTRY_CATEGORIES: {
  category: IndustryCategory;
  blurb: string;
}[] = [
  {
    category: "Personal Brands & Experts",
    blurb: "When your name and your ideas are the product.",
  },
  {
    category: "Local & Home Services",
    blurb: "When the job is booked locally and speed of response wins.",
  },
  {
    category: "Sales & Professional Teams",
    blurb: "When a pipeline and disciplined follow-up decide the quarter.",
  },
  {
    category: "Commerce & Product Brands",
    blurb: "When a product has to be found, understood, bought and bought again.",
  },
];

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function industriesByCategory(category: IndustryCategory): Industry[] {
  return INDUSTRIES.filter((i) => i.category === category);
}

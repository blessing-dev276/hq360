export type Faq = { q: string; a: string };
export type CoreService = {
  slug: string;
  name: string;
  description: string;
  audience: string;
  problems: string[];
  deliverables: string[];
  projects: string[];
  scope: string;
  faqs: Faq[];
};
export const CORE_SERVICES: CoreService[] = [
  {
    slug: "website-development",
    name: "Website Development",
    description: "Business websites, portfolios and useful paths from a visit to an inquiry.",
    audience:
      "For businesses explaining their services, creators presenting their work and agencies delivering a client website.",
    problems: [
      "Your services are difficult to understand or find on mobile.",
      "Inquiries arrive without the details needed to respond.",
      "Your team cannot easily update the site.",
    ],
    deliverables: [
      "Page structure and responsive layouts",
      "Agreed pages and content integration",
      "Contact, quote or booking forms connected to the agreed destination",
      "Accessibility and device checks, launch preparation and editing handover",
    ],
    projects: [
      "Service business website",
      "Creator or author portfolio",
      "Campaign landing page",
      "Website redesign",
    ],
    scope:
      "Page count, content readiness, design requirements, integrations and the amount of existing content to migrate determine the scope. Hosting, booking subscriptions and ongoing maintenance are agreed separately.",
    faqs: [
      {
        q: "Can you improve an existing website?",
        a: "Yes. We first review its platform and what needs to change, then recommend a focused update or a rebuild.",
      },
      {
        q: "Can customers book or request a quote?",
        a: "We can connect a suitable booking tool or build a request form. Availability, pricing and approval rules determine the right workflow.",
      },
      {
        q: "Who supplies the words and images?",
        a: "You can supply approved content, or include writing and content preparation in the scope. Image licensing and ownership are agreed before use.",
      },
    ],
  },
  {
    slug: "mobile-app-development",
    name: "Mobile App Development",
    description:
      "Mobile applications scoped around the tasks your customers or team need to complete.",
    audience:
      "For businesses with a recurring mobile workflow and agencies needing support to deliver an app.",
    problems: [
      "A repeated task is awkward to complete in the current tools.",
      "The app idea needs a clear first release.",
      "Design, data and third-party connections need to work together.",
    ],
    deliverables: [
      "User journeys and an agreed feature specification",
      "Screen designs and implementation for agreed target platforms",
      "Agreed API or backend connections",
      "Testing on agreed devices, release preparation and technical handover",
    ],
    projects: [
      "Customer account app",
      "Internal field workflow",
      "Companion to an existing service",
      "A focused first version of a product",
    ],
    scope:
      "Target platforms, feature count, account roles, offline needs, data handling, integrations and release requirements determine effort. We review technical feasibility first; app-store approval and third-party platform decisions are outside our control.",
    faqs: [
      {
        q: "Does my business need an app?",
        a: "Not necessarily. A responsive website or an existing tool may solve the problem more simply. We assess the frequency and complexity of the task before proposing an app.",
      },
      {
        q: "Will it work on iOS and Android?",
        a: "We agree the supported platforms and devices during scoping. Do not assume both platforms are included in a single-platform proposal.",
      },
      {
        q: "What happens after release?",
        a: "Handover includes the agreed source, access and documentation. Updates, monitoring and ongoing support need a defined scope of their own.",
      },
    ],
  },
  {
    slug: "automation-crm",
    name: "Automation & CRM",
    description:
      "Organised customer records, clear follow-ups and connections between your everyday tools.",
    audience:
      "For teams handling inquiries, estimates, appointments or repeat customers, including agencies implementing client workflows.",
    problems: [
      "Leads are spread across inboxes and spreadsheets.",
      "Follow-ups depend on someone remembering.",
      "Teams re-enter the same information in several tools.",
    ],
    deliverables: [
      "A map of the current process and required data",
      "Agreed CRM stages, fields and ownership rules",
      "Form connections, notifications and follow-up sequences",
      "Testing of exceptions, workflow documentation and team handover",
    ],
    projects: [
      "Inquiry-to-proposal pipeline",
      "Estimate follow-up",
      "Appointment reminders",
      "Repeat-service customer workflow",
    ],
    scope:
      "The number of systems, existing data quality, API availability, message volume and exception rules drive scope. Software subscriptions, email or SMS charges and consent requirements are reviewed before activation.",
    faqs: [
      {
        q: "Can you use our current CRM?",
        a: "We review its access, integrations and limitations before recommending changes. Replacing it is not a default requirement.",
      },
      {
        q: "Will every message be automated?",
        a: "No. We agree where automation is helpful and where a person should review, approve or respond.",
      },
      {
        q: "Can you migrate customer records?",
        a: "Data migration can be scoped after reviewing a sample, field mapping and duplicate handling. Existing records are preserved unless a specific cleanup is agreed.",
      },
    ],
  },
  {
    slug: "writing-editing",
    name: "Writing and Translation",
    description:
      "Clear website copy, business documents and manuscripts, adapted into other languages when needed, shaped around their readers.",
    audience:
      "For businesses explaining an offer, agencies preparing client content, and authors developing, refining or localizing a manuscript.",
    problems: [
      "The draft has useful ideas but lacks structure.",
      "The message is hard to follow or inconsistent.",
      "Content needs a careful edit, or a translation, before publication.",
    ],
    deliverables: [
      "A brief covering audience, purpose and tone",
      "An outline or content structure where needed",
      "Drafting, editing or translation of agreed material",
      "Agreed revision rounds and delivery in an editable format",
    ],
    projects: [
      "Website and service-page copy",
      "Company profile or media kit",
      "Customer emails and guides",
      "Book writing, manuscript editing and translation",
    ],
    scope:
      "Word count, source material, research needs, language pair (for translation), level of editing and revision rounds determine the quote. Subject-matter claims and specialist factual review require your input or an agreed qualified reviewer. Certified, sworn or specialist regulated translation is not included unless expressly confirmed.",
    faqs: [
      {
        q: "Can you keep my voice?",
        a: "We use your existing material and examples to agree a tone, then review a sample before larger pieces where appropriate.",
      },
      {
        q: "What kind of editing do I need?",
        a: "We review a sample to distinguish structure and development work from sentence-level editing or proofreading.",
      },
      {
        q: "Do you work on books?",
        a: "Yes. Our dedicated author offer covers manuscript development, editing and translation, with publishing preparation scoped separately.",
      },
      {
        q: "Which languages do you support?",
        a: "Share the source language, target language and a sample. We confirm availability and review arrangements for that exact brief before quoting.",
      },
    ],
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    description:
      "Campaigns, content and ad management that bring the right audience to what you've already built.",
    audience:
      "For businesses and agencies that need consistent visibility across search, social and paid channels, not just a one-off campaign.",
    problems: [
      "Traffic and enquiries are inconsistent month to month.",
      "Social channels and ads are running without a shared plan.",
      "There's no clear read on what's actually driving results.",
    ],
    deliverables: [
      "A channel plan matched to the audience and budget",
      "Content calendar and creative for agreed channels",
      "Campaign setup and ongoing management",
      "Regular reporting against agreed metrics",
    ],
    projects: [
      "Social media management and content",
      "Paid search and paid social campaigns",
      "SEO and on-site content planning",
      "Email and lifecycle marketing",
    ],
    scope:
      "Channels, ad spend, content volume and reporting cadence determine the quote. Ad spend itself is billed separately from management fees unless agreed otherwise.",
    faqs: [
      {
        q: "Do you manage the ad budget?",
        a: "We plan and manage campaigns; ad spend is paid directly to the platform (Google, Meta, etc.) and billed separately from our management fee.",
      },
      {
        q: "Which platforms do you cover?",
        a: "Share your current channels and goals. We confirm which platforms suit your audience before proposing a plan.",
      },
      {
        q: "How do you report results?",
        a: "We agree the metrics that matter for your goals up front and report against those on a regular schedule.",
      },
    ],
  },
];
export const getCoreService = (slug: string) =>
  CORE_SERVICES.find((service) => service.slug === slug);
export const SERVICE_REDIRECTS: Record<string, string> = {
  "websites-funnels": "website-development",
  "crm-automation": "automation-crm",
  "writing-translation": "writing-editing",
  "translation-localization": "writing-editing",
};
export type Audience = {
  slug: string;
  name: string;
  summary: string;
  headline: string;
  intro: string;
  needs: string[];
  solutions: { title: string; body: string; service: string }[];
  process: string[];
  faqs: Faq[];
  proofSlugs: string[];
  defaultServices: string[];
};
export const AUDIENCES: Audience[] = [
  {
    slug: "authors",
    name: "Authors & Publishers",
    summary: "Develop your book and give readers a place to find you.",
    headline: "Bring your book to life. Help readers find it.",
    intro: "Support for your next chapter.",
    needs: [],
    solutions: [],
    process: [],
    faqs: [],
    proofSlugs: ["authors"],
    defaultServices: [],
  },
  {
    slug: "ugc-creators",
    name: "UGC Creators",
    summary: "Present your work and make brand inquiries easier to manage.",
    headline: "A portfolio that makes your work easy to understand.",
    intro:
      "Bring your best content, collaboration options and inquiry details together in a place you control.",
    needs: [
      "Brands need to see relevant samples quickly.",
      "Your offers and collaboration details are scattered across links.",
      "Inquiries get lost between social messages and email.",
    ],
    solutions: [
      {
        title: "Creator portfolio",
        body: "A mobile-friendly website with organised examples and a clear brand contact route.",
        service: "website-development",
      },
      {
        title: "Media kit and offers",
        body: "Present your formats, collaboration options and supplied audience information clearly, without inflated metrics.",
        service: "writing-editing",
      },
      {
        title: "Video editing and branding",
        body: "Edit supplied footage and prepare consistent visual assets for your portfolio, with formats and usage agreed in the brief.",
        service: "website-development",
      },
      {
        title: "Brand inquiry workflow",
        body: "Capture the brief, budget and deadline, then route the inquiry and track the next reply.",
        service: "automation-crm",
      },
    ],
    process: [
      "Select portfolio examples and agree permissions.",
      "Organise offers and design the presentation.",
      "Review pages, supplied footage and inquiry routing.",
      "Hand over the site and a repeatable update process.",
    ],
    faqs: [
      {
        q: "Do you find brand deals for me?",
        a: "This offer covers presentation and inquiry handling. Brand introductions or guaranteed deals are not included.",
      },
      {
        q: "Can you edit footage I already have?",
        a: "Yes, subject to reviewing the footage, permissions, required formats and revision scope. Filming is not assumed.",
      },
      {
        q: "Can I update my portfolio myself?",
        a: "We agree an editing approach and include a handover for the parts you need to maintain.",
      },
    ],
    proofSlugs: ["creators", "ugc-creators"],
    defaultServices: ["website-development"],
  },
  {
    slug: "agencies",
    name: "Agencies",
    summary: "Bring in delivery support for clearly scoped client work.",
    headline: "Delivery support for the agency behind the brief.",
    intro:
      "HQ360 works with other agencies on websites, mobile apps, CRM workflows, writing and translation. Start with a defined project or discuss ongoing collaboration.",
    needs: [
      "Client deadlines exceed your current delivery capacity.",
      "Your team needs a specific implementation skill.",
      "Review and handover need to fit your client process.",
    ],
    solutions: [
      {
        title: "Website and app delivery",
        body: "Implement agreed designs or develop a defined build, with milestones and technical responsibilities set up front.",
        service: "website-development",
      },
      {
        title: "CRM and workflow implementation",
        body: "Connect client forms, customer records and follow-ups around approved requirements.",
        service: "automation-crm",
      },
      {
        title: "Writing and translation support",
        body: "Prepare copy or adapt content from an agreed brief. Language availability and review requirements are confirmed separately.",
        service: "writing-editing",
      },
      {
        title: "Ongoing delivery capacity",
        body: "Agree the types of work, availability, review cadence and handover expectations for repeat projects.",
        service: "mobile-app-development",
      },
    ],
    process: [
      "Review the client brief, access and responsibilities.",
      "Agree milestones, one point of contact and a review schedule.",
      "Share progress and incorporate consolidated feedback.",
      "Hand over agreed files, credentials and documentation.",
    ],
    faqs: [
      {
        q: "Who communicates with the end client?",
        a: "We agree this before starting. Your agency can consolidate feedback, or we can join agreed project discussions.",
      },
      {
        q: "Can we start with one project?",
        a: "Yes. A defined first project lets both teams assess the working relationship before discussing ongoing capacity.",
      },
      {
        q: "Is white-label delivery included?",
        a: "Branding, confidentiality and client-facing responsibilities must be expressly agreed. White-label arrangements are not assumed.",
      },
    ],
    proofSlugs: ["agencies"],
    defaultServices: ["website-development"],
  },
  {
    slug: "cleaning-businesses",
    name: "Cleaning Businesses",
    summary: "Turn service questions into organised estimates and repeat visits.",
    headline: "From a cleaning inquiry to the right next step.",
    intro:
      "Explain where you work, what you clean and how customers can request an estimate or schedule a suitable service.",
    needs: [
      "You need property and job details before quoting.",
      "Customers are unsure whether you cover their area.",
      "Estimate follow-ups and recurring visits require manual chasing.",
    ],
    solutions: [
      {
        title: "Service-area website",
        body: "Present your coverage, cleaning services and customer preparation information clearly.",
        service: "website-development",
      },
      {
        title: "Quote and estimate requests",
        body: "Collect property type, location, size and job requirements before a quote or site visit.",
        service: "website-development",
      },
      {
        title: "Appropriate scheduling",
        body: "Use instant booking only for services with defined prices, duration and availability. Route variable jobs to an estimate first.",
        service: "automation-crm",
      },
      {
        title: "Repeat-service workflow",
        body: "Organise customer records, reminders, estimate follow-ups and recurring-service requests with agreed consent rules.",
        service: "automation-crm",
      },
    ],
    process: [
      "Map services, coverage and when an estimate is required.",
      "Agree the request fields, booking rules and handoff.",
      "Build and test realistic job scenarios with your team.",
      "Hand over the workflow and agree maintenance needs.",
    ],
    faqs: [
      {
        q: "Can every cleaning job be booked instantly?",
        a: "No. Standardised services may suit instant booking. Larger, specialist or variable jobs often need an estimate or visit before confirmation.",
      },
      {
        q: "Do we need a mobile app?",
        a: "Usually the first step is a usable website and a suitable scheduling workflow. An app is only considered if a specific operational need justifies it.",
      },
      {
        q: "Can you support recurring customers?",
        a: "We can scope reminders and repeat-service workflows around your scheduling tool, staff capacity and customer consent.",
      },
    ],
    proofSlugs: ["cleaning-businesses"],
    defaultServices: ["website-development", "automation-crm"],
  },
  {
    slug: "appointment-based-businesses",
    name: "Appointment-Based Businesses",
    summary: "Help customers schedule, change and prepare for appointments.",
    headline: "Booking that fits the way your business operates.",
    intro:
      "For salons, consultants, trainers and studios: connect the website, calendar and customer follow-up around your own appointment rules.",
    needs: [
      "Staff, rooms or equipment have different availability.",
      "Customers need a clear way to cancel or reschedule.",
      "Reminders and customer notes sit in separate systems.",
    ],
    solutions: [
      {
        title: "Booking website",
        body: "Explain appointment types, duration, preparation and the route to choose a suitable slot.",
        service: "website-development",
      },
      {
        title: "Availability and scheduling",
        body: "Agree buffers, staff calendars, locations, approval rules and resource limits before connecting a booking tool.",
        service: "automation-crm",
      },
      {
        title: "Deposits and changes",
        body: "Where the selected booking platform and payment provider support it, configure agreed deposits, cancellation and rescheduling rules.",
        service: "automation-crm",
      },
      {
        title: "Customer follow-up",
        body: "Keep appropriate customer records and set up confirmations, reminders and follow-up with consent and access controls.",
        service: "automation-crm",
      },
    ],
    process: [
      "Understand appointment types and scheduling exceptions.",
      "Check platform support for availability, payments and changes.",
      "Test bookings, cancellations and reminder timing together.",
      "Train the team and document how to manage changes.",
    ],
    faqs: [
      {
        q: "Can you take deposits?",
        a: "Only where the selected booking platform, payment provider and your account support them. We check capabilities and fees before committing to a deposit workflow.",
      },
      {
        q: "Will the same setup work for every business?",
        a: "No. A salon with several staff, a consultant with approval-based sessions and a studio with shared rooms require different rules.",
      },
      {
        q: "Can customers reschedule themselves?",
        a: "We can configure this where supported, with the notice periods and restrictions you agree.",
      },
    ],
    proofSlugs: ["appointment-based-businesses"],
    defaultServices: ["website-development", "automation-crm"],
  },
  {
    slug: "local-businesses",
    name: "Local Businesses",
    summary: "Explain your services and organise customer inquiries.",
    headline: "A useful online home for your local business.",
    intro:
      "Help nearby customers understand your business, see where you operate and take a clear next step. Connect inquiries to the people who respond.",
    needs: [
      "Customers cannot easily find current services, hours or contact details.",
      "Quote requests arrive without enough information.",
      "Customer follow-up is inconsistent.",
    ],
    solutions: [
      {
        title: "Business website",
        body: "Present services, location or coverage, opening hours and clear contact options.",
        service: "website-development",
      },
      {
        title: "Lead and quote capture",
        body: "Collect the details your team needs to respond, with routing and ownership agreed.",
        service: "website-development",
      },
      {
        title: "Local visibility foundations",
        body: "Review service-page content and consistency of supplied business information. Search rankings and review volumes are not guaranteed.",
        service: "writing-editing",
      },
      {
        title: "Customer records and follow-up",
        body: "Keep inquiries organised and define what happens after a quote, completed job or repeat request.",
        service: "automation-crm",
      },
    ],
    process: [
      "Clarify services, coverage and the current inquiry process.",
      "Agree content, contact routes and ownership.",
      "Build and review the site and follow-up connections.",
      "Hand over access and instructions for keeping details current.",
    ],
    faqs: [
      {
        q: "Is this a booking service?",
        a: "This page covers general websites and inquiry handling. Cleaning and appointment-based businesses have dedicated pages for more specific scheduling needs.",
      },
      {
        q: "Can you guarantee local search rankings?",
        a: "No. We can improve the clarity and consistency of your website and supplied business information, but search placement is outside our control.",
      },
      {
        q: "Can we start small?",
        a: "Yes. We can scope a focused site or an improvement to the current inquiry process, then review additional work separately.",
      },
    ],
    proofSlugs: ["local-business", "local-businesses"],
    defaultServices: ["website-development"],
  },
];
export const getAudience = (slug: string) => AUDIENCES.find((audience) => audience.slug === slug);
export const AGENCY_PROCESS = [
  [
    "Understand the project",
    "Review your audience, material, existing tools and the problem to solve.",
  ],
  ["Agree scope", "Write down deliverables, responsibilities, review rounds, timing and price."],
  [
    "Build and review",
    "Share the work at agreed milestones and test the important journeys together.",
  ],
  [
    "Deliver and support",
    "Hand over the agreed assets, access and instructions, then define any ongoing support.",
  ],
] as const;

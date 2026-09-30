export const AUTHOR_OFFERS = [
  {
    slug: "book-writing-editing",
    name: "Book Writing & Editing",
    step: "Develop",
    situation: "I need help developing or completing my book.",
    description: "Give your ideas a clear structure and prepare a manuscript that sounds like you.",
    deliverables: [
      "Manuscript assessment and chapter outline",
      "Writing or editing against an agreed brief",
      "Editorial feedback and an agreed revision round",
    ],
    capability: "writing-translation",
  },
  {
    slug: "book-formatting-publishing",
    name: "Book Formatting & Publishing Support",
    step: "Publish",
    situation: "I need my manuscript prepared for publication.",
    description:
      "Turn your finished manuscript into files and listing materials ready for your chosen publishing route.",
    deliverables: [
      "Print interior and ebook formatting",
      "File checks for the agreed publishing platform",
      "Book description and upload guidance",
    ],
    capability: "brand-creative",
  },
  {
    slug: "author-visibility-marketing",
    name: "Author Visibility & Marketing",
    step: "Improve visibility",
    situation: "My book is published, but I need better visibility.",
    description:
      "Understand where readers lose the trail, then work through a focused marketing plan.",
    deliverables: [
      "Evidence-led visibility review",
      "Book listing copy and positioning support",
      "Launch or ongoing marketing plan with agreed activities",
    ],
    capability: "visibility-reputation",
  },
  {
    slug: "author-websites-email",
    name: "Author Websites & Email Systems",
    step: "Build your platform",
    situation: "I need somewhere to build my audience.",
    description: "Give readers a home for your books and a clear way to stay in touch.",
    deliverables: [
      "Author website or improvements to an existing site",
      "Reader signup form and email platform connection",
      "Welcome email setup and handover",
    ],
    capability: "websites-funnels",
  },
] as const;
export type AuthorOffer = (typeof AUTHOR_OFFERS)[number];
export const getAuthorOffer = (slug: string) => AUTHOR_OFFERS.find((offer) => offer.slug === slug);

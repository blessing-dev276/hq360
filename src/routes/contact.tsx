import { createFileRoute } from "@tanstack/react-router";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { ProjectInquiryForm } from "@/components/site/ProjectInquiryForm";
import { FaqSection } from "@/components/site/FaqSection";
import { BRAND } from "@/config/brand";
import { buildSeo, breadcrumbSchema, faqSchema } from "@/lib/seo";

const CONTACT_FAQS = [
  {
    q: "What happens after I send this?",
    a: "We read it ourselves and reply within one working day, usually with a first view of what we would do and an honest read on whether we are the right fit. If we are not, we will say so.",
  },
  {
    q: "Do I need a budget figured out?",
    a: "No. A rough range helps us scope realistically, but 'not sure yet' is a valid answer. We will tell you what a sensible first phase costs.",
  },
  {
    q: "Are you US-based?",
    a: "We work with businesses and brands worldwide, and a large share of our clients are in the US. Calls are scheduled to your hours.",
  },
  {
    q: "Can you work with our existing team or agencies?",
    a: "Yes. We can own the whole system or connect to specialists you already trust. The goal is one accountable plan, not necessarily one vendor.",
  },
];

export const Route = createFileRoute("/contact")({
  head: () =>
    buildSeo(
      {
        title: "Start a Project | HQ360",
        description:
          "Tell HQ360 about your book. We reply within one working day with a first view of what we would build and whether we are the right fit.",
        path: "/contact",
      },
      [
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]),
        faqSchema(CONTACT_FAQS),
      ],
    ),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-16">
          <div>
            <SectionHeader
              as="h1"
              eyebrow="Start a project"
              title="Tell us about your next chapter"
              intro="The more context you give, the more useful our first reply will be. Everything here is optional except your name, email and where you need help."
            />
            <ul className="mt-10 space-y-3 text-sm text-muted-foreground">
              <li>One working day to a considered reply, not an autoresponder</li>
              <li>You own every account, asset and automation we build</li>
              <li>Month-to-month on ongoing work, with 30 days' notice</li>
              <li>{BRAND.serviceArea}</li>
            </ul>
            <p className="mt-8 text-sm">
              Prefer email?{" "}
              <a href={`mailto:${BRAND.email}`} className="text-brand underline underline-offset-4">
                {BRAND.email}
              </a>
            </p>
            <p className="mt-2 text-sm">
              Prefer WhatsApp?{" "}
              <a
                href={BRAND.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline underline-offset-4"
              >
                {BRAND.whatsapp}
              </a>
            </p>
          </div>

          <ProjectInquiryForm defaultIndustry="Authors & Publishers" sourceIndustry="authors" />
        </div>
      </Section>

      <Section tone="raised">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <SectionHeader eyebrow="Before you ask" title="Common questions" />
          <FaqSection faqs={CONTACT_FAQS} idPrefix="contact" />
        </div>
        <Container className="mt-12 px-0">
          <p className="text-xs tracking-wide text-muted-foreground/80 uppercase">
            {BRAND.name} was previously {BRAND.formerlyKnownAs}.
          </p>
        </Container>
      </Section>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { BRAND } from "@/config/brand";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    buildSeo({
      title: "Privacy Policy | HQ360",
      description:
        "How HQ360 collects, uses and stores personal information from website visitors, subscribers and clients.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

const sections = [
  {
    heading: "What we collect",
    body: "Your name, email address and the details you provide when you submit a form (company, website, industry, goals, budget and message), the content of messages you send us, newsletter sign-ups, and basic analytics about how pages on this site are used. We do not collect payment details through this website.",
  },
  {
    heading: "Why we collect it",
    body: "To respond to your enquiry, to route it to the right person, to send the monthly letter if you subscribed, and to understand which pages are useful so we can improve them.",
  },
  {
    heading: "Where it is stored",
    body: "Enquiries and sign-ups are stored in our database (Supabase). Where you have consented, an enquiry may also be forwarded to our CRM or workflow tools so we can follow up.",
  },
  {
    heading: "Cookies",
    body: "We use a small number of cookies for analytics only. You can decline them in the banner shown on your first visit, and the site will continue to work normally.",
  },
  {
    heading: "Who we share it with",
    body: "Our database, email, analytics and CRM providers, acting on our instructions. We do not sell personal information and we do not share it for advertising.",
  },
  {
    heading: "How long we keep it",
    body: "Enquiry records for three years. Subscriber records until you unsubscribe. Client records for the period required by accounting rules.",
  },
  {
    heading: "Your rights",
    body: "You may request a copy of your data, ask us to correct it, or ask us to delete it. Write to us and we will respond within thirty days.",
  },
];

function PrivacyPage() {
  return (
    <>
      <Section tone="hero">
        <SectionHeader
          as="h1"
          eyebrow="Legal"
          title="Privacy policy"
          intro="Placeholder policy for demonstration. Have counsel review before publishing."
        />
      </Section>
      <Section>
        <div className="max-w-3xl space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-xl">{s.heading}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
          <section>
            <h2 className="font-display text-xl">Contact</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Questions about this policy can be sent to{" "}
              <a href={`mailto:${BRAND.email}`} className="text-brand underline underline-offset-4">
                {BRAND.email}
              </a>
              .
            </p>
          </section>
        </div>
      </Section>
    </>
  );
}

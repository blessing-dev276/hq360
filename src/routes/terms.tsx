import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { BRAND } from "@/config/brand";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    buildSeo({
      title: "Terms of Service | HQ360",
      description:
        "The terms that apply to engagements with HQ360: scope, payment, cancellation, ownership of work and limits of liability.",
      path: "/terms",
    }),
  component: TermsPage,
});

const sections = [
  {
    heading: "Scope of work",
    body: "Every engagement begins with a written scope listing deliverables, dates and the named team members responsible. Work outside that scope is quoted separately before it begins.",
  },
  {
    heading: "Fees and payment",
    body: "Fees are stated in the scope. Projects are invoiced against milestones; partnerships are invoiced monthly in advance. Advertising budget is paid by you directly to the platforms and is never handled by us.",
  },
  {
    heading: "Cancellation",
    body: "Either party may end an ongoing engagement with thirty days' written notice. Work already delivered is payable. Any unused portion of a prepaid month is refunded. There are no termination penalties.",
  },
  {
    heading: "Ownership",
    body: "On payment, you own every asset, account and automation we create for you, including copy, designs, research, builds and reports. We retain the right to reference the work in our portfolio unless you ask us not to.",
  },
  {
    heading: "Outcomes",
    body: "We are engaged to deliver a defined scope of work to a professional standard. We do not guarantee specific market outcomes such as rankings, lead volumes, revenue or list placements, because those depend on factors outside our control.",
  },
  {
    heading: "Liability",
    body: "Our liability under any engagement is limited to the fees paid in the three months preceding the claim. We are not liable for indirect or consequential loss.",
  },
  {
    heading: "Confidentiality",
    body: "Business plans, sales data, customer lists and unpublished material shared with us are treated as confidential and are not disclosed to third parties without written permission.",
  },
];

function TermsPage() {
  return (
    <>
    <Section tone="hero">
      <SectionHeader
        as="h1"
        eyebrow="Legal"
        title="Terms of service"
        intro="Placeholder terms for demonstration. Have counsel review before publishing."
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
            Questions about these terms can be sent to{" "}
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

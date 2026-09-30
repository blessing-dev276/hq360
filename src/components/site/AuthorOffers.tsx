import { Link } from "@tanstack/react-router";
import { AUTHOR_OFFERS, type AuthorOffer } from "@/data/author-offers";
import { Section, SectionHeader, ButtonLink } from "./Primitives";
import { ProjectInquiryForm } from "./ProjectInquiryForm";
import { TestimonialStrip } from "./TestimonialStrip";
export function AuthorOffers() {
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {AUTHOR_OFFERS.map((offer, index) => (
        <Link
          key={offer.slug}
          to="/services/$slug"
          params={{ slug: offer.slug }}
          className="rounded-2xl border border-border bg-card p-7 transition-colors hover:border-brand focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-sm font-semibold text-brand">
            0{index + 1} / {offer.step}
          </p>
          <h3 className="mt-4 text-2xl">{offer.name}</h3>
          <p className="mt-3 text-muted-foreground">{offer.situation}</p>
          <p className="mt-6 text-sm font-semibold">Explore this service →</p>
        </Link>
      ))}
    </div>
  );
}
export function AuthorOfferPage({ offer }: { offer: AuthorOffer }) {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="For authors & publishers"
          title={offer.name}
          intro={offer.description}
        />
        <h2 className="mt-10 text-2xl">What we can help you deliver</h2>
        <ul className="mt-5 space-y-3">
          {offer.deliverables.map((item) => (
            <li key={item}>✓ {item}</li>
          ))}
        </ul>
        <p className="my-8 max-w-2xl text-muted-foreground">
          We review your material before agreeing deliverables, revisions, timing and price in a
          proposal. Publishing decisions and sales outcomes depend on factors beyond the scope of
          our work.
        </p>
        <ButtonLink to="/contact">Discuss your project</ButtonLink>
        {offer.slug === "author-visibility-marketing" && (
          <div className="mt-8">
            <ButtonLink to="/book-launch" variant="secondary">
              Explore launch support
            </ButtonLink>
          </div>
        )}
      </Section>
      <TestimonialStrip industry="authors" capability={offer.capability} />
      <Section tone="raised">
        <SectionHeader title="Start with your next step" />
        <div className="mt-8 max-w-2xl">
          <ProjectInquiryForm
            defaultIndustry="Authors & Publishers"
            sourceIndustry="authors"
            helpOptions={[offer.name]}
          />
        </div>
      </Section>
    </>
  );
}

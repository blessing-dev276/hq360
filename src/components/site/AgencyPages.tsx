import { Link } from "@tanstack/react-router";
import {
  AUDIENCES,
  CORE_SERVICES,
  AGENCY_PROCESS,
  getCoreService,
  getAudience,
  type Audience,
  type CoreService,
} from "@/data/agency";
import { AUTHOR_OFFERS } from "@/data/author-offers";
import { PLANS } from "@/data/pricing";
import { Section, SectionHeader, ButtonLink } from "./Primitives";
import { ProjectInquiryForm } from "./ProjectInquiryForm";
import { FaqSection } from "./FaqSection";
import { ExpertVoices } from "./ExpertVoices";
import { AgencyWork } from "./AgencyWork";

/** Starting price per service, where one of the /pricing packages covers it.
 *  Mobile apps, writing/translation and digital marketing are scoped and
 *  quoted individually, matching PRICING_NOTES on /pricing. */
const SERVICE_PRICE: Record<string, string> = {
  "website-development": PLANS[0]!.price,
  "automation-crm": PLANS[1]!.price,
};

/** The /pricing package that best fits each audience's typical project. */
const AUDIENCE_PLAN: Record<string, string> = {
  authors: "Author",
  "ugc-creators": "Starter",
  agencies: "Growth",
  "cleaning-businesses": "Growth",
  "appointment-based-businesses": "Growth",
  "local-businesses": "Starter",
};

function PriceCallout({
  label,
  price,
  cadence,
  note,
}: {
  label: string;
  price: string;
  cadence?: string;
  note: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-3xl">
          {price}
          {cadence ? <span className="text-base text-muted-foreground"> /{cadence}</span> : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
      <ButtonLink to="/pricing" variant="secondary" className="ml-auto">
        See all packages
      </ButtonLink>
    </div>
  );
}
export function AudienceLinks() {
  return (
    <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {AUDIENCES.map((item) => (
        <Link
          to={"/" + item.slug}
          key={item.slug}
          className="border-t border-border py-6 hover:border-brand"
        >
          <h3 className="text-xl">
            {item.name}{" "}
            <span aria-hidden="true" className="text-brand">
              ↗
            </span>
          </h3>
          <p className="mt-3 max-w-sm text-muted-foreground">{item.summary}</p>
        </Link>
      ))}
    </div>
  );
}
export function ServiceLinks() {
  return (
    <div className="mt-10 divide-y divide-border">
      {CORE_SERVICES.map((item, index) => (
        <Link
          to="/services/$slug"
          params={{ slug: item.slug }}
          key={item.slug}
          className="grid gap-3 py-7 hover:text-brand sm:grid-cols-[3rem_1fr_1fr] sm:gap-6"
        >
          <span className="text-sm text-brand">0{index + 1}</span>
          <h3 className="text-2xl">{item.name}</h3>
          <p className="text-base text-muted-foreground">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
export function AgencyProcess({ steps }: { steps?: string[] }) {
  return (
    <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {AGENCY_PROCESS.map(([title, description], index) => (
        <li key={title}>
          <span className="text-sm font-semibold text-brand">0{index + 1}</span>
          <h3 className="mt-3 text-xl">{title}</h3>
          <p className="mt-3 text-muted-foreground">{steps?.[index] ?? description}</p>
        </li>
      ))}
    </ol>
  );
}
export function CoreServicePage({
  service,
  audience = "",
  sourcePath,
}: {
  service: CoreService;
  audience?: string | undefined;
  sourcePath?: string | undefined;
}) {
  const authorSlugs =
    service.slug === "writing-editing"
      ? ["book-writing-editing", "book-formatting-publishing"]
      : service.slug === "website-development"
        ? ["author-websites-email"]
        : [];
  return (
    <>
      <Section tone="hero">
        <SectionHeader
          as="h1"
          eyebrow="HQ360 / Services"
          title={service.name}
          intro={service.description}
        />
        <p className="mt-6 max-w-2xl text-muted-foreground">{service.audience}</p>
        <div className="mt-8">
          <ButtonLink href="#project-inquiry">Discuss {service.name.toLowerCase()}</ButtonLink>
        </div>
        {SERVICE_PRICE[service.slug] ? (
          <PriceCallout
            label="Starting from"
            price={SERVICE_PRICE[service.slug]!}
            note="One-time, with a written scope before any work begins."
          />
        ) : (
          <PriceCallout
            label="Pricing"
            price="Custom quote"
            note="Scoped and priced after a short brief — no fixed package covers this service."
          />
        )}
      </Section>
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader title="When this service helps" />
            <ul className="mt-8 space-y-4">
              {service.problems.map((item) => (
                <li key={item} className="border-l border-brand pl-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl">What we can deliver</h2>
            <ul className="mt-8 space-y-4">
              {service.deliverables.map((item) => (
                <li key={item} className="border-b border-border pb-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12">
          <h2 className="text-2xl">Common project types</h2>
          <p className="mt-4 text-muted-foreground">{service.projects.join(" · ")}</p>
        </div>
      </Section>
      <Section tone="raised">
        <SectionHeader
          title="Relevant work"
          intro="Published examples that match this service. We keep gaps visible rather than presenting proposed work as a completed project."
        />
        <AgencyWork service={service.slug} limit={4} />
        <ExpertVoices service={service.slug} />
      </Section>
      <Section>
        <SectionHeader title="How delivery works" />
        <AgencyProcess />
        <div className="mt-12 max-w-3xl">
          <h2 className="text-2xl">What determines scope and price</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{service.scope}</p>
        </div>
      </Section>
      {authorSlugs.length > 0 && (
        <Section tone="raised">
          <SectionHeader
            title="Working on a book or author platform?"
            intro="Our author offers cover the specific publishing and reader journeys within this broader service."
          />
          <div className="mt-6 flex flex-wrap gap-4">
            {AUTHOR_OFFERS.filter((offer) => authorSlugs.includes(offer.slug)).map((offer) => (
              <ButtonLink key={offer.slug} to={`/services/${offer.slug}`} variant="secondary">
                {offer.name}
              </ButtonLink>
            ))}
          </div>
        </Section>
      )}
      <Section>
        <SectionHeader title="Questions before we start" />
        <div className="mt-8 max-w-3xl">
          <FaqSection faqs={service.faqs} idPrefix={service.slug} />
        </div>
      </Section>
      <Section id="project-inquiry" tone="raised">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeader
            title="Tell us what you need"
            intro="Your service is preselected. Add or change it to match the work you have in mind."
          />
          <ProjectInquiryForm
            defaultServices={[service.name]}
            sourceService={service.slug}
            defaultIndustry={getAudience(audience)?.name}
            sourceIndustry={audience}
            sourcePath={sourcePath}
          />
        </div>
      </Section>
    </>
  );
}
export function AudiencePage({ audience }: { audience: Audience }) {
  return (
    <>
      <Section tone="hero">
        <SectionHeader
          as="h1"
          eyebrow={`HQ360 / ${audience.name}`}
          title={audience.headline}
          intro={audience.intro}
        />
        <div className="mt-8">
          <ButtonLink href="#project-inquiry">
            Start a project for {audience.name.toLowerCase()}
          </ButtonLink>
        </div>
        {(() => {
          const planName = AUDIENCE_PLAN[audience.slug];
          const plan = PLANS.find((p) => p.name === planName);
          return plan ? (
            <PriceCallout
              label={`Recommended package for ${audience.name.toLowerCase()}`}
              price={plan.price}
              note={plan.note}
            />
          ) : null;
        })()}
      </Section>
      <Section>
        <SectionHeader title="Does this sound familiar?" />
        <ul className="mt-8 grid gap-7 md:grid-cols-3">
          {audience.needs.map((need) => (
            <li key={need} className="border-t border-brand pt-5 text-lg">
              {need}
            </li>
          ))}
        </ul>
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          {audience.solutions.map((solution) => (
            <div key={solution.title}>
              <h2 className="text-2xl">{solution.title}</h2>
              <p className="mt-4 text-muted-foreground">{solution.body}</p>
              <Link
                to="/services/$slug"
                params={{ slug: solution.service }}
                search={{
                  audience: audience.slug,
                  from: `/${audience.slug}`,
                  service: solution.service,
                }}
                className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
              >
                {getCoreService(solution.service)?.name} →
              </Link>
            </div>
          ))}
        </div>
      </Section>
      <Section tone="raised">
        <SectionHeader title="Relevant published work" />
        <AgencyWork audience={audience.slug} limit={4} />
        <ExpertVoices audience={audience.slug} />
      </Section>
      <Section>
        <SectionHeader title="A practical way to work together" />
        <AgencyProcess steps={audience.process} />
      </Section>
      {audience.slug === "local-businesses" && (
        <Section tone="raised">
          <SectionHeader title="Need a more specific workflow?" />
          <div className="mt-6 flex flex-wrap gap-4">
            <ButtonLink to="/cleaning-businesses" variant="secondary">
              Cleaning Businesses
            </ButtonLink>
            <ButtonLink to="/appointment-based-businesses" variant="secondary">
              Appointment-Based Businesses
            </ButtonLink>
          </div>
        </Section>
      )}
      <Section>
        <SectionHeader title={`Questions from ${audience.name.toLowerCase()}`} />
        <div className="mt-8 max-w-3xl">
          <FaqSection faqs={audience.faqs} idPrefix={audience.slug} />
        </div>
      </Section>
      <Section id="project-inquiry" tone="raised">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeader
            title="Start with your next project"
            intro="The audience and likely services are preselected. Change them if another option fits better."
          />
          <ProjectInquiryForm
            defaultIndustry={audience.name}
            sourceIndustry={audience.slug}
            defaultServices={audience.defaultServices.map((slug) => getCoreService(slug)!.name)}
          />
        </div>
      </Section>
    </>
  );
}

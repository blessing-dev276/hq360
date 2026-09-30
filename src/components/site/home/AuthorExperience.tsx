import { AUTHOR_OFFERS } from "@/data/author-offers";
import { Section, SectionHeader, ButtonLink } from "../Primitives";
import { AuthorOffers } from "../AuthorOffers";
import { FeaturedAuthor } from "../FeaturedAuthor";
import { PortfolioStrip } from "../PortfolioStrip";
import { TestimonialStrip } from "../TestimonialStrip";
import { TeamShowcase } from "../TeamShowcase";
import { ProjectInquiryForm } from "../ProjectInquiryForm";
export function AuthorExperience() {
  return (
    <>
      <Section tone="raised">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">
            HQ360 / Authors & Publishers
          </p>
          <h1 className="mt-6 text-5xl leading-tight sm:text-6xl lg:text-7xl">
            Bring your book to life.
            <br />
            Help readers find it.
          </h1>
          <p className="mt-7 max-w-2xl text-lg text-muted-foreground">
            From your first draft to your next reader, we help you develop your book, prepare for
            publication and build an author platform.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href="#start-project">Start an Author Project</ButtonLink>
            <ButtonLink to="/tools/author-visibility-audit" variant="secondary">
              Free Visibility Check
            </ButtonLink>
          </div>
        </div>
      </Section>
      <Section>
        <SectionHeader
          eyebrow="Choose your next step"
          title="Where are you in your author journey?"
        />
        <AuthorOffers />
      </Section>
      <FeaturedAuthor />
      <PortfolioStrip industry="authors" title="Selected author & publishing work" />
      <Section tone="raised">
        <SectionHeader
          eyebrow="Free Author Visibility Check"
          title="See where readers might lose the trail."
          intro="Request an initial assessment of your supplied book and author links, with a few practical priorities. We review the information before presenting findings."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            "Can readers recognise you across your profiles?",
            "Does your book listing explain who it is for?",
            "Is there a clear path to join your reader list?",
          ].map((text) => (
            <div key={text} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs text-brand">CHECK PREVIEW · EXAMPLE QUESTION</p>
              <p className="mt-4 text-lg">{text}</p>
            </div>
          ))}
        </div>
        <p className="my-7 max-w-2xl text-muted-foreground">
          Need a deeper review? A Detailed Author Visibility Report adds researched evidence and a
          prioritised roadmap, subject to human review. We agree scope and pricing separately.
        </p>
        <ButtonLink to="/tools/author-visibility-audit">Request your free check</ButtonLink>
      </Section>
      <Section>
        <SectionHeader title="A clear path from inquiry to delivery" />
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            ["01 / Inquiry", "Tell us about your book, your readers and what you need next."],
            [
              "02 / Scope",
              "We review your needs and agree the deliverables, schedule and price in a proposal.",
            ],
            [
              "03 / Delivery",
              "We complete the agreed work, review it with you and discuss ongoing support where useful.",
            ],
          ].map(([title, text]) => (
            <li key={title}>
              <h3 className="text-xl">{title}</h3>
              <p className="mt-3 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section tone="raised">
        <SectionHeader
          title="Preparing for a launch?"
          intro="Bring your book positioning, author platform and launch activity into one agreed plan."
        />
        <div className="mt-6">
          <ButtonLink to="/book-launch">Explore book launch support</ButtonLink>
        </div>
      </Section>
      <TestimonialStrip industry="authors" title="From authors we have worked with" />
      <Section tone="raised">
        <TeamShowcase
          title="Meet the people behind your next chapter"
          limit={3}
          viewAll={{ label: "About our team", to: "/about" }}
        />
      </Section>
      <Section id="start-project">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeader
            eyebrow="Start a Project"
            title="Tell us what comes next for your book."
            intro="Share where you are now and what you would like help with. We will review your needs and discuss a suitable scope."
          />
          <ProjectInquiryForm
            defaultIndustry="Authors & Publishers"
            sourceIndustry="authors"
            helpOptions={AUTHOR_OFFERS.map((offer) => offer.name)}
          />
        </div>
      </Section>
    </>
  );
}

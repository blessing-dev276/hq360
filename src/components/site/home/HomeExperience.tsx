import { Section, SectionHeader, ButtonLink } from "../Primitives";
import { AgencyProcess, AudienceLinks, ServiceLinks } from "../AgencyPages";
import { AgencyWork } from "../AgencyWork";
import { TeamShowcase } from "../TeamShowcase";
import { TestimonialStrip } from "../TestimonialStrip";
import { ProjectInquiryForm } from "../ProjectInquiryForm";
export function HomeExperience() {
  return (
    <>
      <Section tone="raised">
        <div className="max-w-5xl">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">
            HQ360 SPACE / Digital services & content
          </p>
          <h1 className="mt-6 text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Your next website.
            <br />
            Your everyday systems.
            <br />
            Your words, made clear.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            HQ360 builds websites, mobile apps and automation systems, and provides writing, editing
            and translation for businesses. We start with what you need to get done.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href="#project-inquiry">Start a Project</ButtonLink>
            <ButtonLink to="/services" variant="secondary">
              Explore Services
            </ButtonLink>
          </div>
        </div>
      </Section>
      <Section>
        <SectionHeader
          eyebrow="Who we help"
          title="Different businesses. Specific needs."
          intro="Find a starting point that fits the way you work."
        />
        <AudienceLinks />
      </Section>
      <Section tone="raised">
        <SectionHeader eyebrow="Core services" title="Bring the right skills to your project." />
        <ServiceLinks />
      </Section>
      <Section>
        <SectionHeader
          eyebrow="Selected work"
          title="A closer look at the work."
          intro="Our published collection currently centres on websites and author projects. Each example is labelled by the work delivered and the audience it serves."
        />
        <AgencyWork limit={4} />
        <div className="mt-8">
          <ButtonLink to="/work" variant="secondary">
            Explore Our Work
          </ButtonLink>
        </div>
      </Section>
      <Section tone="raised">
        <SectionHeader
          eyebrow="How we work"
          title="Clear steps, from the first conversation to handover."
        />
        <AgencyProcess />
      </Section>
      <Section>
        <TeamShowcase
          title="The people behind HQ360"
          limit={4}
          viewAll={{ label: "Meet the team", to: "/about" }}
        />
      </Section>
      <TestimonialStrip title="Feedback from our clients" />
      <Section id="project-inquiry" tone="raised">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeader
            eyebrow="Start a Project"
            title="What would you like to build or improve?"
            intro="Tell us your business type and choose the services you need. A short starting brief is enough."
          />
          <ProjectInquiryForm />
        </div>
      </Section>
    </>
  );
}

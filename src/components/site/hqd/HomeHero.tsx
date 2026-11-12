import { MarketingHero } from "../MarketingHero";

export function HomeHero() {
  return (
    <MarketingHero
      eyebrow="Your ambition. Our expertise."
      title={
        <>
          Your next big idea.
          <br />
          Let’s <em>build it.</em>
        </>
      }
      description="Websites, apps, automation and content — brought together by one team to help your business move forward."
      primary={{ label: "Start a project", href: "#project-inquiry" }}
      secondary={{ label: "Explore our work", href: "#work" }}
      highlights={["Websites & apps", "Automation & CRM", "Content & marketing"]}
    />
  );
}

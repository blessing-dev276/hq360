import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Globe, Linkedin, MapPin } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { FALLBACK_TEAM, initials, useExpertDirectory, type PublicExpert } from "@/lib/experts";
import { fetchPublicContent } from "@/lib/public-content";
import { getCoreService, getAudience } from "@/data/agency";
import { Reveal } from "@/components/site/Reveal";
import { Eyebrow, Grain, PersonCard, Pill } from "@/components/site/hqd/Hqd";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  external_link: string | null;
  service_slugs: string[];
  audience_slugs: string[];
};

function usePortfolio(slug: string) {
  const query = useQuery({
    queryKey: ["public", "expert-portfolio", slug],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: PortfolioItem[] }>(
        `/api/public/expert-portfolio?slug=${encodeURIComponent(slug)}`,
        signal,
      ),
  });
  return query.data?.items ?? [];
}

export const Route = createFileRoute("/experts/$slug")({
  head: ({ params }) => {
    const known = FALLBACK_TEAM.find((person) => person.slug === params.slug);
    return buildSeo({
      title: known ? `${known.name}, ${known.headline} | HQ360 Experts` : "Expert profile | HQ360",
      description: known
        ? `${known.name} is ${known.headline} at HQ360.`
        : "An HQ360 expert profile: specialties, background and how to work together.",
      path: `/experts/${params.slug}`,
    });
  },
  component: ExpertProfilePage,
});

function paragraphs(person: PublicExpert) {
  if (person.bio)
    return person.bio
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  return person.kind === "team"
    ? [`${person.name} is part of the HQ360 core team as ${person.headline}.`]
    : [`${person.name} is an approved HQ360 expert.`];
}

function ExpertProfilePage() {
  const { slug } = Route.useParams();
  const { all, loading } = useExpertDirectory();
  const person = all.find((item) => item.slug === slug);
  const portfolio = usePortfolio(slug);

  if (!person) {
    return (
      <div className="hqd dark">
        <section className="hqd-page-hero">
          <div className="hqd-page-panel" style={{ minHeight: "32rem" }}>
            <span className="hqd-hero-shade" aria-hidden="true" />
            <Grain />
            <div className="hqd-page-inner">
              <div>
                <p className="hqd-hero-kicker">{loading ? "Loading profile…" : "Expert profile"}</p>
                <h1 className="hqd-page-title" style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>
                  {loading ? "One moment." : "Profile not found."}
                </h1>
              </div>
              {!loading && (
                <div className="hqd-hero-aside">
                  <p>This profile may be private or no longer listed.</p>
                  <div className="hqd-hero-actions">
                    <Pill to="/experts">Meet our experts</Pill>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const first = person.name.split(/\s+/)[0] ?? person.name;
  const [intro, ...rest] = paragraphs(person);
  const others = all.filter((item) => item.slug !== person.slug).slice(0, 4);

  return (
    <div className="hqd dark">
      <section className="hqd-page-hero">
        <div className="hqd-page-panel">
          <span className="hqd-hero-glow" aria-hidden="true" />
          {person.photo ? (
            <div className="hqd-page-photo" aria-hidden="true">
              <img src={person.photo} alt="" fetchPriority="high" />
            </div>
          ) : (
            <span className="hqd-page-initials" aria-hidden="true">
              {initials(person.name)}
            </span>
          )}
          <span className="hqd-hero-shade" aria-hidden="true" />
          <Grain />
          <div className="hqd-page-inner">
            <div>
              <p className="hqd-hero-kicker">{person.headline}</p>
              <h1
                className="hqd-page-title"
                style={
                  person.name.length > 14 ? { fontSize: "clamp(2.8rem, 8vw, 7rem)" } : undefined
                }
              >
                {person.name}
              </h1>
              <span
                className="hqd-chip"
                style={{ position: "static", display: "inline-block", marginTop: "1.25rem" }}
              >
                {person.kind === "team" ? "HQ360 core team" : "Approved HQ360 expert"}
              </span>
            </div>
            <div className="hqd-hero-aside">
              <p className="hqd-lede">The person behind the work.</p>
              <p>{intro}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hqd-section">
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Who {first} is</Eyebrow>
              <h2 className="hqd-h2">
                Work with
                <br />
                <span className="hqd-orange-text">{first}.</span>
              </h2>
            </div>
            <div className="hqd-split-aside">
              <p className="hqd-lede">{person.headline}</p>
              {[intro, ...rest].map((text) => (
                <p key={text} className="hqd-body">
                  {text}
                </p>
              ))}
              {(person.location || person.website || person.linkedin) && (
                <div className="hqd-links">
                  {person.location && (
                    <span
                      className="hqd-tag"
                      style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      <MapPin size={14} aria-hidden="true" /> {person.location}
                    </span>
                  )}
                  {person.website && (
                    <a
                      className="hqd-tag"
                      href={person.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      <Globe size={14} aria-hidden="true" /> Website{" "}
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  )}
                  {person.linkedin && (
                    <a
                      className="hqd-tag"
                      href={person.linkedin}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      <Linkedin size={14} aria-hidden="true" /> LinkedIn{" "}
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
              <div className="hqd-hero-actions">
                <Pill to="/contact" tone="orange">
                  Start a project
                </Pill>
                <Pill to="/experts" tone="ghost">
                  All experts
                </Pill>
              </div>
            </div>
          </Reveal>

          {person.specialties.length > 0 && (
            <Reveal className="hqd-specialties">
              <Eyebrow>Specialties</Eyebrow>
              <div className="hqd-cards" style={{ marginTop: "1.5rem" }}>
                {person.specialties.map((item, index) => (
                  <div key={item} className="hqd-card" style={{ minHeight: "11rem" }}>
                    <span className="hqd-card-rule" aria-hidden="true" />
                    <span className="hqd-card-top">
                      <span className="hqd-num">
                        <em>#</em>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="hqd-card-body">
                      <h3>{item}</h3>
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {portfolio.length > 0 && (
        <section className="hqd-section" style={{ paddingTop: 0 }}>
          <div className="hqd-wrap">
            <Reveal className="hqd-arc-head">
              <Eyebrow>Portfolio</Eyebrow>
              <h2 className="hqd-h2">Recent work</h2>
            </Reveal>
            <div className="hqd-cards" style={{ marginTop: "1.5rem" }}>
              {portfolio.map((item) => {
                const tags = [
                  ...item.service_slugs.map((s) => getCoreService(s)?.name).filter(Boolean),
                  ...item.audience_slugs.map((s) => getAudience(s)?.name).filter(Boolean),
                ] as string[];
                return (
                  <div key={item.id} className="hqd-card" style={{ minHeight: "16rem" }}>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt=""
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          objectFit: "cover",
                          borderRadius: "1rem",
                        }}
                      />
                    )}
                    <span className="hqd-card-body">
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                      {tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.4rem",
                            marginTop: "0.75rem",
                          }}
                        >
                          {tags.map((tag) => (
                            <span key={tag} className="hqd-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.external_link && (
                        <a
                          href={item.external_link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="hqd-tag"
                          style={{
                            display: "inline-flex",
                            gap: "0.4rem",
                            alignItems: "center",
                            marginTop: "0.75rem",
                          }}
                        >
                          View <ArrowUpRight size={13} aria-hidden="true" />
                        </a>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="hqd-section" style={{ paddingTop: 0 }}>
          <div className="hqd-wrap">
            <Reveal className="hqd-split">
              <div>
                <Eyebrow>Keep exploring</Eyebrow>
                <h2 className="hqd-h2">More experts</h2>
              </div>
              <div className="hqd-split-aside">
                <Pill to="/expert-signup" tone="ghost">
                  Become an Expert
                </Pill>
              </div>
            </Reveal>
            <div className="hqd-people">
              {others.map((item) => (
                <PersonCard key={item.slug} person={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

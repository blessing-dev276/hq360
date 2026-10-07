import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { resolveExpertSlug } from "@/lib/expert-slug.functions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Globe, Linkedin, MapPin } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { FALLBACK_TEAM, initials, useExpertDirectory, type PublicExpert } from "@/lib/experts";
import { fetchPublicContent } from "@/lib/public-content";
import { getCoreService, getAudience } from "@/data/agency";
import { Reveal } from "@/components/site/Reveal";
import { ReviewCards, type PublicReview } from "@/components/site/hqd/ReviewCards";
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

type VideoTestimonial = {
  id: string;
  client_name: string;
  client_role: string | null;
  quote: string | null;
  video_url: string;
  service_slug: string | null;
};

function useReviews(slug: string) {
  const query = useQuery({
    queryKey: ["public", "expert-reviews", slug],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: PublicReview[] }>(
        `/api/public/expert-reviews?slug=${encodeURIComponent(slug)}`,
        signal,
      ),
  });
  return query.data?.items ?? [];
}

function useTestimonials(slug: string) {
  const query = useQuery({
    queryKey: ["public", "expert-testimonials", slug],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: VideoTestimonial[] }>(
        `/api/public/expert-testimonials?slug=${encodeURIComponent(slug)}`,
        signal,
      ),
  });
  return query.data?.items ?? [];
}

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
  beforeLoad: async ({ params }) => {
    const canonical = await resolveExpertSlug({ data: { slug: params.slug } });
    if (canonical)
      throw redirect({
        to: "/experts/$slug",
        params: { slug: canonical },
        replace: true,
        statusCode: 301,
      });
  },
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

/** Bio clamped to exactly five lines, with "View more" when it runs longer. */
function AboutText({ paragraphs }: { paragraphs: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [paragraphs, open]);
  return (
    <div>
      {open ? (
        <div className="hqd-about">
          {paragraphs.map((text) => (
            <p key={text} className="hqd-body">
              {text}
            </p>
          ))}
        </div>
      ) : (
        // Collapsed: one block so line-clamp counts real text lines only.
        <p ref={ref} className="hqd-body hqd-about-clamp">
          {paragraphs.join(" ")}
        </p>
      )}
      {overflows && (
        <button
          type="button"
          className="hqd-work-more hqd-about-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
}

const DESCRIPTION_PREVIEW = 160;

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const [open, setOpen] = useState(false);
  const tags = [
    ...item.service_slugs.map((s) => getCoreService(s)?.name),
    ...item.audience_slugs.map((s) => getAudience(s)?.name),
  ].filter(Boolean) as string[];
  const long = (item.description?.length ?? 0) > DESCRIPTION_PREVIEW;
  return (
    <article className="hqd-card hqd-work-card">
      {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
      <div className="hqd-card-body">
        <h3>{item.title}</h3>
        {item.description && (
          <p className={open ? undefined : "hqd-work-clamp"}>{item.description}</p>
        )}
        {long && (
          <button type="button" className="hqd-work-more" onClick={() => setOpen((v) => !v)}>
            {open ? "Show less" : "Read more"}
          </button>
        )}
        {tags.length > 0 && (
          <div className="hqd-work-tags">
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
            className="hqd-work-link"
          >
            View project <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

function TestimonialCard({ item }: { item: VideoTestimonial }) {
  const service = item.service_slug ? getCoreService(item.service_slug)?.name : null;
  return (
    <figure className="hqd-card hqd-video-card">
      <video src={item.video_url} controls playsInline preload="metadata" />
      <figcaption className="hqd-card-body">
        {item.quote && <blockquote>“{item.quote}”</blockquote>}
        <strong>{item.client_name}</strong>
        {(item.client_role || service) && (
          <small>{[item.client_role, service].filter(Boolean).join(" · ")}</small>
        )}
      </figcaption>
    </figure>
  );
}

/** Service chips that narrow the portfolio to one Related service. */
function PortfolioSection({ items }: { items: PortfolioItem[] }) {
  const [service, setService] = useState("all");
  const services = [...new Set(items.flatMap((item) => item.service_slugs))]
    .map((slug) => ({ slug, name: getCoreService(slug)?.name }))
    .filter((s): s is { slug: string; name: string } => Boolean(s.name));
  const visible =
    service === "all" ? items : items.filter((item) => item.service_slugs.includes(service));
  return (
    <section className="hqd-section" style={{ paddingTop: 0 }}>
      <div className="hqd-wrap">
        <Reveal className="hqd-arc-head">
          <Eyebrow>Portfolio</Eyebrow>
          <h2 className="hqd-h2">Recent work</h2>
        </Reveal>
        {services.length > 1 && (
          <div className="hqd-filter" role="group" aria-label="Filter work by service">
            {[{ slug: "all", name: "All work" }, ...services].map((option) => (
              <button
                key={option.slug}
                type="button"
                aria-pressed={service === option.slug}
                className="hqd-filter-chip"
                onClick={() => setService(option.slug)}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
        <div className="hqd-cards hqd-work-cards" style={{ marginTop: "1.5rem" }}>
          {visible.map((item) => (
            <PortfolioCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Hero line: the expert's own short intro, never a repeat of the bio below. */
function shortIntro(person: PublicExpert) {
  if (person.summary) return person.summary;
  return person.kind === "team" ? "Part of the HQ360 core team." : "An approved HQ360 expert.";
}

function ExpertProfilePage() {
  const { slug } = Route.useParams();
  const { all, loading } = useExpertDirectory();
  // Prefer the editable expert profile when a bundled team name shares its URL.
  const person =
    all.find(
      (item) => item.portfolioSlug === slug || (item.kind === "expert" && item.slug === slug),
    ) ?? all.find((item) => item.slug === slug);
  const portfolio = usePortfolio(person?.portfolioSlug ?? slug);
  const testimonials = useTestimonials(person?.portfolioSlug ?? slug);
  const reviews = useReviews(person?.portfolioSlug ?? slug);

  if (!person) {
    return (
      <div className="hqd dark">
        <section className="hqd-page-hero">
          <div className="hqd-page-panel" style={{ minHeight: "32rem" }}>
            <span className="hqd-hero-shade" aria-hidden="true" />
            <Grain />
            <div className="hqd-page-inner">
              {loading ? (
                <LoadingRegion label="Loading profile" className="hqd-profile-skeleton">
                  <span className="hq-skel-row" style={{ gap: 24 }}>
                    <Skeleton variant="circle" height={112} />
                    <span className="hq-skel-stack" style={{ flex: 1, gap: 14 }}>
                      <Skeleton width={140} height={11} />
                      <Skeleton width="70%" height={56} />
                      <Skeleton width="45%" height={18} />
                    </span>
                  </span>
                  <span className="hq-skel-row" style={{ marginTop: 28 }}>
                    <Skeleton variant="pill" width={150} height={46} />
                    <Skeleton variant="pill" width={120} height={46} />
                  </span>
                </LoadingRegion>
              ) : (
                <div>
                  <p className="hqd-hero-kicker">Expert profile</p>
                  <h1 className="hqd-page-title" style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>
                    Profile not found.
                  </h1>
                </div>
              )}
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
                {person.kind === "team" ? "HQ360 Team" : "Approved HQ360 expert"}
              </span>
            </div>
            <div className="hqd-hero-aside">
              <p className="hqd-lede">The person behind the work.</p>
              <p
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {shortIntro(person)}
              </p>
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
              <AboutText paragraphs={[intro!, ...rest]} />
              {(person.location ||
                person.website ||
                person.linkedin ||
                person.fiverr ||
                person.upwork) && (
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
                  {person.fiverr && (
                    <a
                      className="hqd-tag"
                      href={person.fiverr}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      Fiverr <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  )}
                  {person.upwork && (
                    <a
                      className="hqd-tag"
                      href={person.upwork}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}
                    >
                      Upwork <ArrowUpRight size={13} aria-hidden="true" />
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

      {portfolio.length > 0 && <PortfolioSection items={portfolio} />}

      {reviews.length > 0 && (
        <section className="hqd-section" style={{ paddingTop: 0 }}>
          <div className="hqd-wrap">
            <Reveal className="hqd-arc-head">
              <Eyebrow>Client reviews</Eyebrow>
              <h2 className="hqd-h2">What clients say</h2>
            </Reveal>
            <ReviewCards reviews={reviews} />
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="hqd-section" style={{ paddingTop: 0 }}>
          <div className="hqd-wrap">
            <Reveal className="hqd-arc-head">
              <Eyebrow>Testimonials</Eyebrow>
              <h2 className="hqd-h2">In their clients' words</h2>
            </Reveal>
            <div className="hqd-cards hqd-video-cards" style={{ marginTop: "1.5rem" }}>
              {testimonials.map((item) => (
                <TestimonialCard key={item.id} item={item} />
              ))}
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

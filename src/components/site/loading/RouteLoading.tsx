import { Link, useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

export function TextSkeleton({
  title = false,
  short = false,
}: {
  title?: boolean;
  short?: boolean;
}) {
  return (
    <span
      className={`route-skeleton-block ${title ? "route-skeleton-title" : "route-skeleton-line"}${short ? " is-short" : ""}`}
    />
  );
}

export function MediaSkeleton({ square = false }: { square?: boolean }) {
  return (
    <div className={`route-skeleton-block route-skeleton-media${square ? " is-square" : ""}`} />
  );
}

export function OrbitSkeleton() {
  return (
    <div className="route-skeleton-orbit">
      <i />
      <i />
      <i />
      <span className="route-skeleton-block" />
    </div>
  );
}

function SkeletonHeading({ actions = false }: { actions?: boolean }) {
  return (
    <div className="route-skeleton-heading">
      <span className="route-skeleton-block route-skeleton-eyebrow" />
      <TextSkeleton title />
      <TextSkeleton title short />
      <div className="route-skeleton-copy">
        <TextSkeleton />
        <TextSkeleton short />
      </div>
      {actions && (
        <div className="route-skeleton-actions">
          <span className="route-skeleton-block route-skeleton-pill" />
          <span className="route-skeleton-block route-skeleton-pill" />
        </div>
      )}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="route-skeleton-split">
      <SkeletonHeading actions />
      <OrbitSkeleton />
    </div>
  );
}

export function CapabilitySkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <>
      {detail ? <HeroSkeleton /> : <SkeletonHeading />}
      <div className="route-skeleton-grid">
        {[0, 1, 2].map((item) => (
          <div key={item} className="route-skeleton-card">
            <span className="route-skeleton-block route-skeleton-icon" />
            <TextSkeleton title />
            <TextSkeleton />
            <TextSkeleton short />
            <span className="route-skeleton-block route-skeleton-eyebrow" />
          </div>
        ))}
      </div>
    </>
  );
}

export function IndustrySkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <>
      {detail ? (
        <div className="route-skeleton-split">
          <SkeletonHeading actions />
          <MediaSkeleton square />
        </div>
      ) : (
        <SkeletonHeading />
      )}
      <div className="route-skeleton-grid">
        {[0, 1, 2].map((item) => (
          <div key={item} className="route-skeleton-card">
            <span className="route-skeleton-block route-skeleton-eyebrow" />
            <TextSkeleton title />
            <TextSkeleton />
            <TextSkeleton short />
            <span className="route-skeleton-block route-skeleton-pill" />
          </div>
        ))}
      </div>
    </>
  );
}

export function CaseStudySkeleton({
  detail = false,
  cardsOnly = false,
}: {
  detail?: boolean;
  cardsOnly?: boolean;
}) {
  return (
    <>
      {!cardsOnly && <SkeletonHeading />}
      {!cardsOnly && !detail && (
        <div className="route-skeleton-actions">
          {[0, 1, 2].map((item) => (
            <span key={item} className="route-skeleton-block route-skeleton-pill" />
          ))}
        </div>
      )}
      {detail ? (
        <div className="route-skeleton-case-media">
          <MediaSkeleton />
          <div className="route-skeleton-grid">
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <TextSkeleton title short />
                <TextSkeleton />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`route-skeleton-grid${cardsOnly ? "" : " route-skeleton-work-list"}`}>
          {(cardsOnly ? [0, 1, 2] : [0, 1]).map((item) => (
            <div key={item} className="route-skeleton-work">
              {cardsOnly && <MediaSkeleton />}
              <div className="route-skeleton-card">
                <span className="route-skeleton-block route-skeleton-eyebrow" />
                <TextSkeleton title />
                <TextSkeleton />
                <TextSkeleton short />
                {!cardsOnly && (
                  <div className="route-skeleton-actions">
                    <span className="route-skeleton-block route-skeleton-pill" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function InsightSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <>
      <SkeletonHeading />
      {detail ? (
        <div className="route-skeleton-article">
          {[0, 1, 2].map((item) => (
            <div key={item}>
              <TextSkeleton />
              <TextSkeleton />
              <TextSkeleton short />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="route-skeleton-actions">
            {[0, 1, 2].map((item) => (
              <span key={item} className="route-skeleton-block route-skeleton-pill" />
            ))}
          </div>
          <div className="route-skeleton-grid">
            {[0, 1, 2].map((item) => (
              <div key={item} className="route-skeleton-card">
                <span className="route-skeleton-block route-skeleton-eyebrow" />
                <TextSkeleton title />
                <TextSkeleton title short />
                <TextSkeleton />
                <TextSkeleton short />
                <span className="route-skeleton-block route-skeleton-eyebrow" />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function FormSkeleton() {
  return (
    <div className="route-skeleton-form">
      {[0, 1, 2, 3].map((item) => (
        <div key={item}>
          <span className="route-skeleton-block route-skeleton-label" />
          <span className="route-skeleton-block route-skeleton-input" />
        </div>
      ))}
      <div className="route-skeleton-full">
        <span className="route-skeleton-block route-skeleton-label" />
        <span className="route-skeleton-block route-skeleton-textarea" />
      </div>
      <span className="route-skeleton-block route-skeleton-pill" />
    </div>
  );
}

const industryPaths = new Set([
  "authors",
  "creators",
  "real-estate",
  "home-services",
  "coaches",
  "agencies",
  "local-business",
  "law-firms",
  "med-spas",
  "plumbers",
  "roofers",
  "hvac",
  "book-launch",
]);

/** Loaded with the route shell so feedback never waits for the destination chunk. */
export function PageSkeleton() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [section, slug] = pathname.split("/").filter(Boolean);
  let content: ReactNode;
  if (!section) content = <HeroSkeleton />;
  else if (section === "capabilities" || section === "services")
    content = <CapabilitySkeleton detail={Boolean(slug)} />;
  else if (section === "industries" || industryPaths.has(section))
    content = <IndustrySkeleton detail={section !== "industries"} />;
  else if (section === "work" || section === "results" || section === "reviews")
    content = <CaseStudySkeleton detail={Boolean(slug)} />;
  else if (["insights", "blog", "resources"].includes(section))
    content = <InsightSkeleton detail={Boolean(slug)} />;
  else if (section === "contact")
    content = (
      <div className="route-skeleton-split route-skeleton-contact">
        <SkeletonHeading />
        <FormSkeleton />
      </div>
    );
  else content = <SkeletonHeading />;

  return (
    <div className="route-skeleton-page" role="status" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true">{content}</div>
    </div>
  );
}

export function RouteProgress() {
  const loading = useRouterState({ select: (state) => state.status === "pending" });
  return loading ? (
    <div className="route-progress" role="status">
      <span className="sr-only">Opening page</span>
    </div>
  ) : null;
}

export function PageLoadError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);
  return (
    <div className="route-load-error">
      <span className="route-error-mark" aria-hidden="true">
        ↗
      </span>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
        A small interruption
      </p>
      <h1 className="mt-4 text-3xl sm:text-4xl">This page couldn’t load.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Please try again. If your connection dropped, reconnect and come straight back.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          className="route-retry-button"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
        <Link to="/" className="route-home-link">
          Back to home <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}

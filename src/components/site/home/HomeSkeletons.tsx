import "./featured-proof.css";

export function ProofSkeleton() {
  return (
    <div className="home-featured-proof-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading featured project and client videos</span>
      <div aria-hidden="true">
        <div className="home-featured-project">
          <div className="home-featured-photograph">
            <div className="home-featured-image-frame hq-skeleton" />
            <div className="mt-4">
              <span className="hq-skeleton home-proof-skeleton-caption" />
            </div>
          </div>
          <div className="home-featured-project-copy">
            <span className="hq-skeleton home-proof-skeleton-kicker" />
            <span className="hq-skeleton home-proof-skeleton-title" />
            <span className="hq-skeleton home-proof-skeleton-title" />
            <span className="hq-skeleton home-proof-skeleton-title" />
            <span className="hq-skeleton home-proof-skeleton-author" />
            <span className="hq-skeleton home-proof-skeleton-line is-short" />
            <div className="home-proof-skeleton-summary">
              <span className="hq-skeleton home-proof-skeleton-line" />
              <span className="hq-skeleton home-proof-skeleton-line" />
              <span className="hq-skeleton home-proof-skeleton-line is-short" />
            </div>
            <div className="home-proof-skeleton-outcome">
              <span className="hq-skeleton home-proof-skeleton-line is-short" />
              <span className="hq-skeleton home-proof-skeleton-line" />
              <span className="hq-skeleton home-proof-skeleton-line" />
              <span className="hq-skeleton home-proof-skeleton-line is-short" />
            </div>
            <span className="hq-skeleton home-proof-skeleton-link" />
          </div>
        </div>
        <div className="home-proof-client-videos">
          <span className="hq-skeleton home-proof-skeleton-video-heading" />
          <div className="home-proof-video-links">
            {[0, 1].map((index) => (
              <div key={index} className="home-proof-skeleton-video">
                <span className="hq-skeleton home-proof-skeleton-play" />
                <div className="home-proof-skeleton-video-copy">
                  <span className="hq-skeleton home-proof-skeleton-line is-short" />
                  <span className="hq-skeleton home-proof-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

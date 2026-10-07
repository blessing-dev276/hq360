import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play, RotateCcw } from "lucide-react";
import { LAUNCH, LAUNCH_GALLERY } from "@/data/launch";
import { VIDEO_TESTIMONIALS } from "@/data/proof";
import { CASE_STUDIES } from "@/data/work";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import "./featured-proof.css";

const project = CASE_STUDIES.find(
  (study) => study.status === "verified" && study.slug === "sanman-thapa-book-launch",
)!;
const photograph = LAUNCH_GALLERY[0];

function LaunchPhotograph() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  if (!photograph) return null;

  return (
    <figure className="home-featured-photograph">
      <div className="home-featured-image-frame" aria-busy={state === "loading"}>
        <img
          key={attempt}
          src={photograph.src}
          alt={photograph.alt}
          loading="lazy"
          decoding="async"
          className={state === "ready" ? "is-ready" : ""}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
        {state === "loading" ? (
          <div className="home-proof-image-loading hq-skeleton" role="status">
            <span className="sr-only">Loading launch photograph</span>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="home-proof-media-error" role="status">
            <p>Launch photography is unavailable right now.</p>
            <button
              type="button"
              onClick={() => {
                setState("loading");
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" /> Retry photograph
            </button>
          </div>
        ) : null}
        <span className="home-featured-image-label">Launch day / Sanman Thapa</span>
      </div>
      <figcaption>
        <span>{photograph.caption}</span>
        <span>With {LAUNCH.publisher}</span>
      </figcaption>
    </figure>
  );
}

function ClientVideo({ video }: { video: (typeof VIDEO_TESTIMONIALS)[number] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || state !== "loading") return;
    const timeout = window.setTimeout(() => setState("error"), 20_000);
    return () => window.clearTimeout(timeout);
  }, [open, state, attempt]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setState("loading");
      }}
    >
      <DialogTrigger asChild>
        <button className="home-proof-video-trigger" type="button">
          <span className="home-proof-play-icon">
            <Play size={17} fill="currentColor" aria-hidden="true" />
          </span>
          <span>
            <span className="home-proof-video-label">{video.label}</span>
            <strong>{video.title}</strong>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="home-proof-video-dialog">
        <DialogTitle>{video.title}</DialogTitle>
        <DialogDescription>A video shared by a HQ360 client.</DialogDescription>
        <div className="home-proof-video-frame" aria-busy={open && state === "loading"}>
          {/* Mount a source only after an explicit play action. Closing removes it and stops playback. */}
          {open ? (
            <video
              key={`${video.id}-${attempt}`}
              src={video.src}
              controls
              playsInline
              autoPlay
              preload="none"
              aria-label={video.title}
              onLoadedData={() => setState("ready")}
              onCanPlay={() => setState("ready")}
              onError={() => setState("error")}
              style={state === "error" ? { visibility: "hidden" } : undefined}
            >
              Your browser does not support embedded video.
            </video>
          ) : null}
          {state === "loading" ? (
            <div className="home-proof-video-loading" role="status">
              <span className="home-proof-loading-ring" aria-hidden="true" />
              <span>Loading video…</span>
            </div>
          ) : null}
          {state === "error" ? (
            <div className="home-proof-media-error" role="status">
              <p>This video could not load. Please try again.</p>
              <button
                type="button"
                onClick={() => {
                  setState("loading");
                  setAttempt((value) => value + 1);
                }}
              >
                <RotateCcw size={16} aria-hidden="true" /> Retry video
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Homepage proof keeps the documented launch and unattributed client videos distinct. */
export function FeaturedProof() {
  return (
    <div className="home-featured-proof">
      <article className="home-featured-project" aria-labelledby="home-featured-project-title">
        <LaunchPhotograph />
        <div className="home-featured-project-copy">
          <p className="home-featured-project-kicker">Featured project · {project.industry}</p>
          <h3 id="home-featured-project-title">{project.title}</h3>
          <p className="home-featured-client">{LAUNCH.author}</p>
          <p className="home-featured-book">{LAUNCH.book}</p>
          <p className="home-featured-summary">{project.summary}</p>
          <div className="home-featured-outcome">
            <span>The outcome</span>
            <p>{project.outcome}</p>
          </div>
          <Link
            to="/work/$slug"
            params={{ slug: project.slug }}
            preload="intent"
            className="home-text-link"
          >
            Inside the project <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </article>
      <div className="home-proof-client-videos" aria-label="Client videos">
        <p>Hear it from our clients</p>
        <div className="home-proof-video-links">
          {VIDEO_TESTIMONIALS.map((video) => (
            <ClientVideo key={video.id} video={video} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { ReviewCards } from "@/components/site/hqd/ReviewCards";
import { matchesTags, useExpertProof } from "@/lib/expert-proof";

/**
 * Client video testimonials and reviews that HQ360 experts added (approved),
 * matched to a service and/or audience. Renders nothing when there's none.
 */
export function ExpertVoices({
  service = "",
  audience = "",
  title = "From our experts' clients",
  limit = 6,
}: {
  service?: string;
  audience?: string;
  title?: string;
  limit?: number;
}) {
  const { data } = useExpertProof();
  const videos = (data?.videos ?? [])
    .filter((v) => matchesTags(v, service, audience))
    .slice(0, limit);
  const reviews = (data?.reviews ?? [])
    .filter((r) => matchesTags(r, service, audience))
    .slice(0, limit);
  if (!videos.length && !reviews.length) return null;
  return (
    <section aria-labelledby="expert-voices-title" className="my-14">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Client feedback
      </p>
      <h2 id="expert-voices-title" className="mt-2 text-3xl tracking-tight sm:text-4xl">
        {title}
      </h2>
      {videos.length > 0 && (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id} className="min-w-0">
              <video
                src={v.video}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full rounded-xl bg-secondary object-contain"
              />
              {v.quote && <p className="mt-3 text-sm leading-relaxed">“{v.quote}”</p>}
              <p className="mt-2 text-sm font-semibold">
                {v.client}
                {v.role && <span className="font-normal text-muted-foreground">, {v.role}</span>}
              </p>
              <Credit expert={v.expert} />
            </li>
          ))}
        </ul>
      )}
      {reviews.length > 0 && (
        <div className="mt-10">
          <ReviewCards
            reviews={reviews.map((r) => ({
              id: r.id,
              client_name: r.client,
              platform: r.platform,
              rating: r.rating,
              review_text: r.text,
              review_date: r.date,
              screenshot_url: r.screenshot,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Reviews for work by{" "}
            {[...new Map(reviews.map((r) => [r.expert.name, r.expert])).values()].map(
              (e, i, all) => (
                <span key={e.name}>
                  {e.slug ? (
                    <a href={`/experts/${e.slug}`} className="underline underline-offset-4">
                      {e.name}
                    </a>
                  ) : (
                    e.name
                  )}
                  {i < all.length - 1 ? ", " : ""}
                </span>
              ),
            )}
            , HQ360 experts.
          </p>
        </div>
      )}
    </section>
  );
}

function Credit({ expert }: { expert: { name: string; slug: string | null } }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Work by{" "}
      {expert.slug ? (
        <a href={`/experts/${expert.slug}`} className="underline underline-offset-4">
          {expert.name}
        </a>
      ) : (
        expert.name
      )}
      , HQ360 expert
    </p>
  );
}

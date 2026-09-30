import { contextForPath, inquiryHref, readInquiryContext } from "@/lib/inquiry-context";
import { Link, useRouterState } from "@tanstack/react-router";
import { OrbitGraphic } from "@/components/brand/OrbitGraphic";
import { CTAS } from "@/config/brand";

/**
 * Closing call to action. Dark by default. Intent-based: a primary action and
 * one lower-friction secondary.
 */
export function CtaBand({
  eyebrow = "Start here",
  title,
  body,
  primary = CTAS.primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  const location = useRouterState({ select: (state) => state.location });
  const contact = inquiryHref({
    ...contextForPath(location.pathname),
    ...readInquiryContext(location.search),
  });
  return (
    <section className="bg-carbon text-[oklch(0.95_0.006_90)]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-12 lg:p-16">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 hidden h-72 w-72 text-white/40 sm:block"
          >
            <OrbitGraphic />
          </span>
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[oklch(0.78_0.03_60)] uppercase">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-3xl leading-tight text-balance text-[oklch(0.97_0.006_90)] sm:text-4xl">
              {title}
            </h2>
            {body ? (
              <p className="mt-5 text-base leading-relaxed text-[oklch(0.82_0.01_80)] sm:text-lg">
                {body}
              </p>
            ) : null}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to={primary.to === "/contact" ? contact : primary.to}
                className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {primary.label}
              </Link>
              {secondary ? (
                <Link
                  to={secondary.to === "/contact" ? contact : secondary.to}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-[oklch(0.97_0.006_90)] hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import type { ComponentType, SVGProps } from "react";
import { contextForPath, inquiryHref, readInquiryContext } from "@/lib/inquiry-context";
import { Link, useRouterState } from "@tanstack/react-router";
import { Instagram, Twitter } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import { TrustpilotBadge } from "@/components/site/TrustpilotBadge";
import { BRAND, FOOTER_NAV, SOCIALS } from "@/config/brand";

function TikTok(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.5 3c.26 2.07 1.5 3.63 3.5 3.9v3.02c-1.38.05-2.7-.35-3.83-1.1v6.62c0 3.53-2.86 6.06-6.24 6.06C6.55 21.5 4 18.86 4 15.56c0-3.36 2.86-5.98 6.28-5.87v3.13c-.42-.11-.86-.16-1.3-.16-1.6 0-2.9 1.31-2.9 2.93 0 1.62 1.3 2.93 2.9 2.93 1.66 0 3.02-1.3 3.02-3.06V3h2.5Z" />
    </svg>
  );
}

function WhatsApp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.94 9.94 0 0 0 4.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.09.81.82-3.01-.2-.31a8.2 8.2 0 0 1-1.26-4.4c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.25-8.26 8.25Zm4.53-6.19c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.96-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.24-.85.83-.85 2.03s.87 2.36 .99 2.52c.12.17 1.72 2.63 4.18 3.68.58.25 1.04.4 1.4.51.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.08.15-1.18-.07-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

const iconFor: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Instagram,
  Twitter,
  TikTok,
  WhatsApp,
};

export function SiteFooter() {
  const location = useRouterState({ select: (state) => state.location });
  const contact = inquiryHref({
    ...contextForPath(location.pathname),
    ...readInquiryContext(location.search),
  });
  return (
    <footer className="bg-carbon text-[oklch(0.9_0.006_90)]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo variant="mono" size={30} />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[oklch(0.78_0.008_90)]">
              {BRAND.positioning}
            </p>
            <p className="mt-4 text-sm text-[oklch(0.7_0.008_90)]">{BRAND.serviceArea}</p>
            <a
              href={`mailto:${BRAND.email}`}
              className="mt-5 inline-block text-sm text-[oklch(0.82_0.01_80)] underline-offset-4 hover:text-brand hover:underline"
            >
              {BRAND.email}
            </a>
            {SOCIALS.length > 0 ? (
              <ul className="mt-6 flex gap-3">
                {SOCIALS.map((s) => {
                  const Icon = iconFor[s.label];
                  return (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-[oklch(0.88_0.008_90)] hover:border-brand hover:text-brand"
                      >
                        {Icon ? <Icon className="size-4" aria-hidden="true" /> : s.label[0]}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_NAV.map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-semibold tracking-[0.16em] text-[oklch(0.68_0.008_90)] uppercase">
                  {col.heading}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={`${col.heading}-${l.label}`}>
                      <Link
                        to={l.to === "/contact" ? contact : l.to}
                        className="text-sm text-[oklch(0.85_0.006_90)] hover:text-brand"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="font-display text-lg text-[oklch(0.95_0.006_90)]">
                Practical notes for your next project.
              </p>
              <p className="mt-1 text-sm text-[oklch(0.72_0.008_90)]">
                Notes on websites, apps, automation and content. Unsubscribe any time.
              </p>
            </div>
            <NewsletterSignup variant="dark" />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-[oklch(0.62_0.008_90)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {BRAND.legalName}. {BRAND.descriptor}.
          </p>
          <TrustpilotBadge tone="dark" />
          <p>
            {BRAND.name} was previously {BRAND.formerlyKnownAs}.
          </p>
        </div>
        <span className="hqd-footer-mark" aria-hidden="true">
          HQ360
        </span>
      </div>
    </footer>
  );
}

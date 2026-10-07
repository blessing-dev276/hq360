# HQ360 Website — Full Overview

> Context document for sharing with an AI assistant so it can understand the whole
> project. Updated 2026-09-08 after the multi-industry rebrand.

---

## 1. What this is

Marketing + **prospecting** website for **HQ360**, a premium **multi-industry growth agency**:
brand, websites, funnels, CRM, automation, lead generation, content, social, visibility and
reputation — run as one connected system rather than five separate vendors.

- **Positioning:** "Everything your brand needs to grow." HQ360 surrounds a business with the
  strategy, creative, technology and marketing it needs to get seen, earn trust and convert
  attention into customers.
- **History:** HQ360 was previously **House of Synergy**, an author/personal-brand agency. That
  practice is now the **Authors & Publishers** vertical. Old name is referenced only as history
  in `src/config/brand.ts` (`formerlyKnownAs`).
- **Primary business goal:** prospecting. Each industry has its own direct URL
  (`/real-estate`, `/plumbers`, …) so a prospect can be sent a page built for their niche.
- **Deploy:** nitro build (`.output/`), Cloudflare preset by default. Do not rewrite pushed git history.

---

## 2. Tech stack

TanStack Start + TanStack Router (file-based), React 19, Vite 8, TypeScript, Tailwind CSS v4,
shadcn/Radix primitives, Supabase, React Query, zod, lucide-react, Bun.

Scripts: `bun run dev` · `bun run build` · `bun run lint` · `bun run format`.
`bun run preview` does **not** work here (Nitro/Cloudflare build target outputs to `.output/`,
not `dist/server`); use `bun run dev` for local SSR.

---

## 3. Brand & design system

- **Central config:** `src/config/brand.ts` — `BRAND`, `CTAS`, `PRIMARY_NAV`, `INDUSTRY_MENU`,
  `CAPABILITY_MENU`, `FOOTER_NAV`, `SOCIALS`. This is the single source of truth.
- **Tokens:** `src/styles.css`. Palette = Near-black `#111416`, Warm white `#FAF9F6`,
  HQ Orange `#FF5A00`, Energy Orange `#FF8500`, warm neutral ramp — all oklch. Orange is an
  accent only (`--brand`, `--brand-strong`, `--brand-soft`); `--primary` is near-black.
  Section tones: `base` / `raised` / `dark` (`--charcoal`) / `carbon` (`--carbon`).
- **Type:** Space Grotesk (display) + Inter (body). `--font-display`, `--font-sans`. Loaded in
  `src/routes/__root.tsx`.
- **Motif:** `src/components/brand/OrbitGraphic.tsx` — abstract 360/orbit SVG (rings, orbiting
  nodes, central spark). Used as hero graphic, section backdrop, capability marker.
- **Motion:** CSS classes `hq-spin-slow/slower`, `hq-marquee-track`, `hq-reveal` +
  `src/hooks/use-reveal.ts` / `src/components/site/Reveal.tsx` (IntersectionObserver). All
  disabled under `prefers-reduced-motion`.

---

## 4. Routing

TanStack file-based routing in `src/routes/`. `routeTree.gen.ts` is auto-generated on build.

| Path                                                                                                                                         | File                     | Notes                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `/`                                                                                                                                          | `index.tsx`              | Homepage                                               |
| `/industries`                                                                                                                                | `industries.tsx`         | Overview, grouped by category                          |
| `/authors`                                                                                                                                   | `authors.tsx`            | Industry page + author-service catalogue + launch link |
| `/real-estate` `/creators` `/coaches` `/home-services` `/plumbers` `/roofers` `/hvac` `/med-spas` `/law-firms` `/agencies` `/local-business` | `<slug>.tsx`             | Thin files → shared `IndustryPage`, data-driven        |
| `/capabilities`                                                                                                                              | `capabilities.index.tsx` | Six capability pillars                                 |
| `/capabilities/:slug`                                                                                                                        | `capabilities.$slug.tsx` | Capability detail                                      |
| `/work`                                                                                                                                      | `work.index.tsx`         | Case studies + proof (filterable)                      |
| `/work/:slug`                                                                                                                                | `work.$slug.tsx`         | Case study detail                                      |
| `/about`                                                                                                                                     | `about.tsx`              | Why HQ360, approach, team, process                     |
| `/contact`                                                                                                                                   | `contact.tsx`            | Project inquiry form (real)                            |
| `/pricing`                                                                                                                                   | `pricing.tsx`            | Project / Growth System / Growth Partnership           |
| `/insights`                                                                                                                                  | `insights.index.tsx`     | Blog (filter by category)                              |
| `/insights/:slug`                                                                                                                            | `insights.$slug.tsx`     | Article                                                |
| `/book-launch`                                                                                                                               | `book-launch.tsx`        | Sanman Thapa launch (real project)                     |
| `/privacy` `/terms`                                                                                                                          | legal                    | Rebranded, still placeholder text                      |
| `/services` `/services/:slug` `/results` `/reviews` `/blog` `/blog/:slug` `/faqs` `/guarantee` `/resources`                                  | redirect stubs           | Forward to the new equivalents so old links never 404  |

**API routes** (`src/routes/api/public/`): `inquiry.ts`, `newsletter.ts`, `growth-audit.ts`,
`resource-request.ts` (legacy). All zod-validated, service-role writes, honeypot field, and
degrade to `503 {"ok":false}` if Supabase env is missing.

---

## 5. Content data model (`src/data/`)

Typed, scalable — **adding an industry = one data entry + a ~12-line route file.**

- `industries.ts` — `Industry` type + `INDUSTRIES` (12) + `getIndustry`, `industriesByCategory`,
  `INDUSTRY_CATEGORIES`. Fields: slug, path, name, shortName, category, eyebrow, headline,
  subheadline, description, outcome, outcomes[], painPoints[], holdingBack[], howWeHelp[],
  recommendedCapabilities[], services[], growthSystem[], proof?[], faqs[], cta, seo.
- `capabilities.ts` — `Capability` type + `CAPABILITIES` (6: brand-creative, websites-funnels,
  crm-automation, lead-generation, content-social, visibility-reputation) + `getCapability`,
  `capabilitiesFor`.
- `process.ts` — `GROWTH_FRAMEWORK` (Brand→Build→Attract→Convert→Retain→Scale), `PROCESS`
  (Discover→Strategise→Build→Launch→Optimise→Scale), `PRINCIPLES` (replaces the old fake stat bar).
- `work.ts` — `CASE_STUDIES` with `status: "verified" | "sample"`. Sanman Thapa = verified
  (media only, no invented metrics). Others = "sample", shown with an "Illustrative" badge and
  no hard numbers.
- `insights.ts` — `INSIGHTS` (7 posts; 3 original author articles kept under "Author Growth").
- `pricing.ts` — `ENGAGEMENTS` (3 models, `priceHint` marked placeholder), `PRICING_FAQS`.
- `authors.ts` — `AUTHOR_SERVICES` (the 10 author services, preserved, rendered on `/authors`).
- `team.ts` — `TEAM` (real names + photos; role titles generalised — flagged to confirm).
- `launch.ts`, `proof.ts` — unchanged (real supplied media: launch photos/video, review
  screenshots, client videos).

---

## 6. Key components (`src/components/`)

`site/Primitives.tsx` (Container, Section, SectionHeader, Eyebrow, Button/ButtonLink,
SampleBadge), `brand/OrbitGraphic.tsx`, `site/SiteHeader.tsx` (Industries + Capabilities mega
menus, mobile panel), `site/SiteFooter.tsx`, `site/IndustryPage.tsx` (the reusable industry
page), `site/CapabilityGrid`, `site/IndustryGrid`, `site/GrowthFrameworkStrip`,
`site/ProcessTimeline`, `site/PainPoints`, `site/OutcomeCards`, `site/GrowthSystemSteps`,
`site/FaqSection`, `site/CtaBand`, `site/WorkGrid` (+ `CaseStudyCard`), `site/ProjectInquiryForm`
(real, zod, honeypot, polished success/error), `site/ToolCloud` (honest "platforms we build on"),
`site/ProofStrip`, `site/NewsletterSignup` (wired), `site/CookieBanner`, `site/FeaturedAuthor`,
`site/TeamAvatar`, `Logo.tsx` (uses `/public/logo-abstract.png` + `/public/logo-text.png`).

Removed: StickyCta, ExitIntentOffer, AwardsSection, RiskReversal, ProofSection,
ConnectedPlatforms, PlatformLogos, CompareSlider, and `src/data/site.ts`.

---

## 7. Backend & lead flow

- **Migration:** `supabase/migrations/20260908120000_hq360_growth_inquiries.sql` creates
  `project_inquiries`, `newsletter_subscribers`, `growth_audit_requests` (RLS on, service-role
  only). Types added to `src/integrations/supabase/types.ts`.
- **Lead forwarding:** `src/lib/lead-forwarding.server.ts` — webhook-ready abstraction. Set
  `LEAD_WEBHOOK_URL` (+ optional secret/auth headers) to push every lead to GoHighLevel /
  HubSpot / Zapier / Make. No-op + logged if unset.
- **Email:** `src/lib/email.server.ts` — provider abstraction (Resend-ready). `EMAIL_PROVIDER`,
  `RESEND_API_KEY`, `EMAIL_FROM`. No-op if unset. `resource-delivery.server.ts` uses it.
- **Industry attribution:** industry pages submit `industry` + `sourceIndustry` + `sourcePath`,
  so a lead from `/real-estate` is tagged "Real Estate" for routing.
- **Env vars:** documented in `.env.example`. `load-env.server.ts` reads `.env` into
  process.env for local dev; deployed builds need them set in the host environment.

---

## 8. SEO

`src/lib/seo.ts` — `buildSeo()` (canonical + OG + Twitter per page), `organizationSchema`,
`professionalServiceSchema`, `faqSchema`, `breadcrumbSchema`. `src/lib/page-heads.ts` —
`industryHead()` / `capabilityHead()` compose title/description/JSON-LD from the data model.
Organization JSON-LD is site-wide in `__root.tsx`. Each industry page emits ProfessionalService

- BreadcrumbList + FAQPage.

---

## 9. Placeholder content to replace before launch

- `BRAND.email` (`hello@hq360.co`) and domain — not confirmed.
- Pricing `priceHint` figures in `src/data/pricing.ts` — indicative only.
- `src/data/team.ts` role titles — generalised, confirm with each person; add bios only if real.
- `/privacy` and `/terms` body copy — placeholder, needs counsel review.
- `work.ts` "sample" case studies — replace with client-approved case studies when available.
- Any real client logos / press / awards — intentionally omitted (none were verifiable).

## 10. Remaining recommended work

- Configure `SUPABASE_SERVICE_ROLE_KEY`, `LEAD_WEBHOOK_URL`, and an email provider in the
  deploy environment.
- Add a proper OG image (`buildSeo` currently falls back to `/favicon.png`).
- Consider a sitemap route and `robots.txt` update for the new URLs.
- Add an OG image and a sitemap route.

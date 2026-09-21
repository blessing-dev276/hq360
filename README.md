# Brand Ignition Studio

PROMPT START

Build a professional, high-converting marketing website for House of Synergy, a full-service agency for authors and personal/brand building — think of it as an evolution of a book-marketing agency into a complete author-and-personal-brand growth studio (visibility, credibility, sales, and media presence, not just book rankings).

1. Brand & Visual Identity

Name: House of Synergy Tagline options (use one as the primary hero eyebrow tag):

"Where Your Story Meets Its Spark."

"Built for Authors. Built for Brands. Built to Be Seen."

"Ignite Your Story. Amplify Your Name."

Logo: A blazing fire mark — a stylized flame built from two or three interlocking flame-strokes that also read as an "S" (for Synergy) when viewed as a whole, rendered in a gradient from deep ember red → orange → gold at the tip. Pair it with a clean serif or modern-serif wordmark "House of Synergy" in near-black or deep charcoal, so the logo feels premium and editorial (book/publishing world) rather than like a generic startup flame icon. Provide a monochrome (single-color) version for footer/dark backgrounds and a full-gradient version for the header/hero. Generate the logo as an SVG so it's crisp at all sizes and easy to re-theme.

Color palette:

Primary: Ember Red #C0392B / Deep Ember #8B1E1E

Accent: Blazing Orange #E8681C and Gold #D4A017

Base: Charcoal/near-black #161311 for text and dark sections

Neutral: Warm off-white #FAF7F2 for backgrounds (avoid stark white — should feel warm, editorial, premium)

Use the fire gradient (red → orange → gold) sparingly as an accent — underlines, stat numbers, hover states, section dividers — not as a background wash everywhere.

Typography: A refined serif (e.g. Fraunces, Playfair Display, or Canela-style) for headlines to signal editorial/publishing credibility, paired with a clean modern sans (e.g. Inter or Söhne) for body copy and UI. Generous whitespace, confident large type in the hero, no cramped layouts.

Tone: Confident, warm, a little literary — never salesy or "growth-hacker" in voice. Should feel like a boutique agency a serious author or founder would trust, not a mass-market marketplace.

2. Site Structure / Pages

Build as a multi-page site (not just a single long scroll):

/ Home

/services Services overview + individual service detail pages

/results Results & Case Studies (portfolio)

/about About / Team

/pricing Pricing

/resources Free resources / lead magnets hub

/blog Insights / Blog (listing + article template)

/faqs FAQs

/guarantee What we do and don't guarantee

/contact / Book a Call

/privacy, /terms Legal

3. Homepage Sections (in order)

Sticky header — logo left, nav (Home, Services, Results, About, Pricing, Resources, Blog, FAQs), a "Book a Free Strategy Call" CTA button on the right, mobile hamburger menu.

Hero — Eyebrow tag ("Book marketing, brand building, and press for authors and creators"), large serif headline (e.g. "Your Work Deserves More Than Just Being Published."), supporting paragraph, two CTAs: primary "Book a Free Strategy Call" + secondary "Get a Free Brand Audit." Include a subtle animated flame/gradient accent in the background. Below the fold of the hero, a horizontal stat bar with animated count-up numbers: books/brands elevated, five-star reviews generated, clients served, average days to visible results.

Social proof strip — logos of platforms/publications the agency gets clients seen on (Amazon, Goodreads, Apple Books, Barnes & Noble, Kobo, Audible, Forbes, Publishers Weekly, Podcast networks) in a scrolling marquee.

"Who we are" — mission statement + 3 differentiator cards (e.g. "We turn away work we can't help," "Research before promises," "Full reporting, not vibes"), plus a repeated stat row.

Services grid — numbered cards (7–9 services), each with icon, short description, and a small visual/before-after snippet, linking to a full service detail page. Cover both author services and broader personal-brand services:

Amazon/Book Listing Optimization

Goodreads & Reader List Placement

Bestseller Launch Campaigns

Author Branding & Media Kit

Press & PR Placement (podcasts, blogs, trade press)

Verified Review & Social Proof Campaigns

Email Marketing / Launch Funnels

Social & Direct-to-Audience Promotion (SMS, DMs)

Personal Brand Strategy (positioning, website, LinkedIn/X presence) — for non-author brand-building clients

Speaking & Thought Leadership Placement (speaker bureaus, panels, guest expert bookings)

Featured campaigns / case studies carousel — draggable/filterable cards by category (Thriller, Self-Help, Business, Memoir, Personal Brand, etc.), each showing before → after ranking/metric movement.

Results section — big stat counters + a real "drag to compare" before/after slider showing an actual ranking or follower jump.

Process timeline — step-by-step (Audit → Research → Strategy → Launch → Tracking → Optimization), each with a short description and progress indicator.

Team section (new vs. reference site) — 3–5 team member cards with photo, name, role, 1-line bio, to build human trust and credibility.

Testimonials — carousel of client quotes with name, title/book, and photo/headshot placeholder.

Comparison / "Why House of Synergy" table (new) — House of Synergy vs. typical marketing agency vs. DIY, across columns like transparency, reporting, guarantees, personal brand support.

Pricing — one flagship bundle card (highlighted/featured) + à la carte services grid with prices, plus a link to /guarantee.

Guarantee callout — short trust section: "See exactly what we do and don't guarantee" linking to a dedicated guarantee page.

FAQs — accordion, grouped by General / Process / Pricing / Ethics.

Free resources / lead magnets — 3 cards (Free Brand/Book Audit, Free Positioning Report, Free Launch Checklist), each with a short form or email capture.

Blog/Insights preview (new) — 3 latest article cards linking to /blog.

Final CTA / booking section — embedded calendar booking widget placeholder, trust line (average rating, no long-term contracts), large "Book Your Free Strategy Call" button.

Footer — logo + tagline, nav columns (Company, Free Tools, Legal), contact email, social icons (Instagram, TikTok, X, LinkedIn), newsletter signup input, copyright line.

4. Cross-cutting requirements

Fully responsive (mobile-first), smooth scroll-triggered fade/slide-in animations, animated stat counters, hover micro-interactions on cards and buttons.

Accessible: proper heading hierarchy, alt text on all images/icons, sufficient color contrast against the warm off-white background, keyboard-navigable nav and accordions.

SEO: unique meta title/description per page, Open Graph + Twitter card images, semantic HTML, fast-loading optimized images.

Include a cookie-consent banner and a simple newsletter signup component in the footer.

Use placeholder but realistic-sounding copy/testimonials/stats (clearly marked as placeholder content for the client to replace with real data).

Build the logo as a reusable SVG component so colors can be swapped from a central theme/token file.

There should be no Ai words or hypens in text and no Animation excpet the bazing Logo

## Development

Uses [bun](https://bun.sh).

```sh
git clone <this-repository-url>
cd hq360
bun install
bun dev            # http://localhost:8080
```

`bun run build` produces a nitro bundle in `.output/` (Cloudflare preset by
default — change it in `vite.config.ts` for another host). Deployed builds need
the Supabase env vars from `.env.example` set in the host environment.

Scout source architecture, crawl controls, scheduling, identity review, migration steps,
and future-source onboarding are documented in [docs/scout-sources.md](docs/scout-sources.md).

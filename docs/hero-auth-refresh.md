# Hero portraits and workspace sign-in

The five homepage portraits now use transparent WebP cutouts in `src/assets/team-hero-{1..5}-cutout.webp`. Original JPGs remain unchanged. Their combined transfer size is approximately 1.64 MB. The lower edge fades into the hero, with a narrow 4% feather at the original photo’s cropped side edges; faces and shoulders no longer receive the broad radial mask. Existing orange ambient lighting, crossfade and reduced-motion behavior remain.

Admin and expert sign-in share `src/components/auth/AuthShell.tsx` and scoped CSS: dark surfaces, warm orange light, large editorial typography, labelled inputs, visible keyboard focus and rounded action buttons. Mobile stacks the introduction above the form. Existing credential types, endpoints, access approval and workspace components are retained. Session checks now have an explicit loading state. Expert signup already uses the public site's design.

## Asset generation

Mode: built-in imagegen, one background extraction per existing portrait. PNG outputs are retained in `/Users/synergy/.codex/generated_images/01a0f1ec-b384-7811-97cd-d7355960dae5/`; website assets are WebP encodings at quality 0.9 with no resizing or visual modification. Actual alpha transparency was checked for every portrait.

Portrait 1 prompt:

> Remove only the background from this existing portrait. Output a PNG with actual transparent alpha background. Preserve the exact person's identity, face, expression, hair, glasses, clothing, folded arms, watch, original colors, lighting and framing. Do not redraw, beautify or restyle the person. Clean natural hair and clothing edges, no colored backdrop halo, no shadow or replacement background. Retain the complete visible person at original aspect ratio. Save the edited asset.

Portraits 2–5 prompt:

> Remove only the background from this portrait. Output PNG with actual transparent alpha. Preserve the exact person's identity, face, expression, hair, glasses if present, clothing, arms, hands, jewelry, colors, lighting, and original framing. Do not redraw, beautify or restyle. Clean natural edges without backdrop halos. Remove backdrop and any furniture, retain all visible parts of the person without inventing cropped body parts. No replacement background or shadow.

Inputs: `src/assets/team-hero-{1..5}.jpg`. Output PNG filenames in order:

- `exec-e93e756b-db6f-4264-bc2c-65c86a618a7c.png`
- `exec-1617bd40-482c-448b-92b6-0ad5ba102dc9.png`
- `exec-841d83d6-a7be-4541-ac6d-f7cd755d6b33.png`
- `exec-d99cbd22-9830-4f59-bc3b-203f10498d3b.png`
- `exec-308c4cda-5e1d-4480-bc5d-df3af2dc3720.png`

## Review

Run `bun run build`, then `bun run preview --port 8105` and `bun scripts/test-auth-design-browser.mjs`. The browser script mocks authentication and workspace APIs, verifies invalid and successful sign-ins, expert approval states, transparent hero images and desktop/mobile overflow. Screenshots are saved under `/tmp/hq-*.png`. No real accounts, outreach or payments are used.

Validation: build, TypeScript, changed-file ESLint and 33 targeted tests passed. Mocked browser checks passed for authentication states, desktop/mobile layout and all five alpha-transparent portraits. The existing payment browser suite also passed with NOWPayments fixtures. No deployment was performed.

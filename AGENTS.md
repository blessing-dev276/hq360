# Agent notes

- Package manager: **bun** (`bun install`, `bun dev`, `bun run build`, `bun run lint`).
- Stack: TanStack Start + React 19 + Vite 8, Tailwind v4, Supabase. Build output is
  a nitro Cloudflare bundle (`.output/`); change the preset in `vite.config.ts` for
  other hosts.
- Deployed builds need `SUPABASE_URL`, `SUPABASE_PROJECT_ID`,
  `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (and the `VITE_` copies)
  set in the host environment — see `.env.example`.
- Keep `main` in a working state; avoid rewriting pushed git history.

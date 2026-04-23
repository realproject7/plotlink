# PlotLink

On-chain storytelling protocol. Writers tokenise their storylines on a bonding curve from day 1 — every new plot drives trading, and every trade generates royalties for the author. Story artifacts stored on IPFS via Filebase. The app is mobile-first with a terminal/monospace design aesthetic.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase
- **Storage**: Filebase (IPFS)
- **Chain**: EVM-compatible (RPC + contract interaction)

## Repo Structure

```
src/
  app/          # Next.js App Router pages and layouts
    globals.css # Design tokens (CSS custom properties)
    layout.tsx  # Root layout (monospace font)
    page.tsx    # Home page
.github/
  workflows/
    ci.yml                # Lint + type-check + e2e on PRs
    update-snapshots.yml  # Visual regression (manual-only)
```

## Commands

```sh
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # TypeScript type-check (tsc --noEmit)
```

## CI / Visual Regression

PR CI runs `lint-and-typecheck` and `e2e` only. Visual regression snapshots are **manual-only** — trigger the `Update Visual Snapshots` workflow via GitHub Actions or `gh workflow run update-snapshots.yml` when a change is likely to impact UI layout.

## Design System

Terminal aesthetic: dark background (`#0a0a0a`), monospace font (Geist Mono), green accent (`#00ff88`), outline-based UI. CSS custom properties defined in `src/app/globals.css`.

## Proposal

The full project proposal will be added at `docs/PROPOSAL-plotlink.md` in a future ticket.

## Versioning

Version format: X.Y.Z (e.g., 1.0.0, 1.11.23). Each digit can go beyond 9.

| Digit | Meaning | Who can bump |
|-------|---------|-------------|
| 3rd (Z) | Minor updates, bug fixes | T3 autonomously |
| 2nd (Y) | Major updates, new features | T3 autonomously |
| 1st (X) | Operator (T1) permission only | Never bump without asking |

When making a PR, bump the 3rd digit for bug fixes, the 2nd digit for feature work. Never bump the 1st digit without explicit T1 approval.

## Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

# Portman Center Bipartisanship Scores

A public-facing site for exploring the Portman Center's bipartisanship scores by legislator, chamber, party, and issue area.

Inspired by:
- [voteview.com](https://voteview.com) — top-nav, search, and chamber/party views
- The Center for Effective Lawmaking's "Find Representatives" tool (`../cel/cel-vis`, built and maintained in-house) — table + control-panel + glossary layout, search/filter UX, glossary surfacing of methodology terms

## Stack

### Core
- **TypeScript** — used everywhere (app code, data loaders, build scripts)
- **Next.js 16** (App Router) — statically generated; one pre-rendered page per legislator via `generateStaticParams`. No runtime backend. Chosen deliberately over an SPA so legislator pages have real, shareable, indexable URLs. Turbopack is the default builder.
- **React 19** (required by Next.js 16)
- **Node ≥ 20** (required by Next.js 16)

### Data
- **Static JSON committed to the repo**, one file per Congress (e.g. `data/scores-119.json`). Updates = drop in a new file and redeploy.
- **Zod** for schema definition + runtime validation when new scores arrive. TS types are inferred from the Zod schema (single source of truth).

### UI
- **Tailwind CSS** for styling
- **shadcn/ui** for base components (buttons, dialogs, dropdowns, etc.)
- **TanStack Table** (headless) for the Find Your Legislator index — sorting, filtering, pagination logic without prescribed markup.

### Search & export
- **Fuse.js** or **MiniSearch** — client-side fuzzy search across legislators (dataset is small enough to ship with the page).
- **PapaParse** — in-browser CSV export for academic users.

### Charts
- *Deferred — all of this is TBD until the page skeleton and data model are in place.*
- **Datawrapper is out** as a default. The original deck assumed Datawrapper iframe embeds for the Chamber and Party views; we've decided not to rely on it. Reasons: chart data would live outside this repo (two places to update), embeds are iframes hosted on Datawrapper's CDN (uptime + restyling limits), and we want full control over interactivity and theming.
- Current leaning is **in-code charting** with **Recharts**, dropping to **Visx** only for figures that genuinely need lower-level control. Still subject to revisit when we actually start building charts.

### Hosting
- **GitHub Pages** for the prototype, using Next.js's static export (`output: 'export'`). Same hosting model as `cel-vis`.
- Required Next.js config notes:
  - `output: 'export'` — emits the site to `out/` as flat static HTML/JS
  - `images.unoptimized: true` — GH Pages can't run Image Optimization
  - `basePath` set to the repo name unless served at a custom domain
  - `.nojekyll` in `out/` so `_next/` assets aren't stripped
- Deployment: a GitHub Actions workflow that runs `next build` and publishes `out/`.
- Things unsupported under static export (none currently needed): API routes, middleware, ISR, runtime image optimization, `next/headers`.

## Routes (planned)

- `/` — landing
- `/search` — advanced search (member name, bioguide, govtrack, state, district, congress, issue)
- `/legislator/[bioguide]` — per-legislator detail page
- `/chamber` — chamber-level views
- `/party` — party-level views
- `/issues/[slug]` — per-issue-area views
- `/data` — bulk CSV downloads + crosswalks
- `/about` — methodology, citations
- `/research` — linked publications

## Core metrics

- **Attraction Score** — how much bipartisan cosponsorship a member's bills attract
- **Offering Score** — how often a member cosponsors out-party bills

Both reported overall and per-issue, with rankings.

## Design goals

- User-friendly for non-academics
- Detailed enough for academics (CSV export, bioguide/govtrack crosswalks)
- Easy to update — new scores each congressional term

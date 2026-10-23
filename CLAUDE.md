# Horizon Vantage - Project Notes

Marketing site for a one-person Irish photography/videography/web-dev/local-SEO
business, built in Astro. This file exists so Claude Code has continuity with
prior work done on this project via claude.ai chat - there's no shared history
between the two, so treat this as the handoff.

## Stack

- Astro (static output), TypeScript
- GSAP + ScrollTrigger for scroll-driven animation
- Lenis for smooth/inertia scrolling, synced to GSAP's ticker
- No component framework (React/Vue) - plain `.astro` components

## Structure

- `src/pages/index.astro` - assembles all sections, wires up animation inits
- `src/components/` - one component per section (Header, FilmRollIntro, Hero,
  Gap, Offer, Portfolio, Process, About, Seo, Contact, Footer, ScrollNav,
  Sprockets)
- `src/scripts/animations.ts` - all GSAP/ScrollTrigger logic, one exported
  `init*()` function per effect, called from `index.astro`'s inline script
- `src/lib/analytics/`, `src/scripts/{analytics,consent,dashboard,charts}.ts`,
  `netlify/functions/{collect,stats}.ts`, `src/pages/{analytics,privacy}.astro` -
  the analytics system; see "Analytics" below
- `src/scripts/lenis.ts` - Lenis smooth-scroll setup, exports `getLenis()`
  so other modules can route programmatic scrolls through it
- `src/layouts/Layout.astro` - holds the persistent fixed background
  (`.persist-bg`) that sits behind every section
- `PRODUCT.md` / `DESIGN.md` - product truth and the visual design system,
  captured via the `impeccable` skill (`/impeccable init` / `document`).
  Read these before product or visual decisions; this file stays focused on
  implementation gotchas.

## Key decisions worth knowing before changing things

**Header is `position: fixed`, not `sticky`.** This was a real bug fix, not
a style choice - `sticky` reserves its own height in document flow, which
pushed the intro's box down and exposed the wrong background (persist-bg,
cool/dark) behind the header instead of the intro's own artwork. Three
earlier commits tried to patch this by raising the header's opacity instead
of fixing the actual cause. If you touch Header.astro, know that `fixed`
is intentional and load-bearing for this reason.

**Scroll-behavior is `auto`, not `smooth`, in global.css.** Lenis owns
smooth scrolling now. Native CSS smooth-scroll would run its own competing
animation on anchor jumps and fight Lenis's easing. Anchor clicks are
intercepted in `lenis.ts` and routed through `lenis.scrollTo()` instead.

**The homepage intro (`FilmRollIntro.astro` + `initFilmRollIntro` in
animations.ts) is a pinned, scroll-scrubbed film strip.** Replaced an
earlier "glowing portal" concept that read as a spa/wellness site rather
than a photography business (see `FILM-ROLL-INTRO-BRIEF.md` for the full
brief and phase history). Idle drift → scroll-driven roll → deceleration
lock on a designated hero frame → develop (colour negative to positive via
CSS filter) → expand (transform only) until the frame fills the viewport →
pin releases directly into the real Hero section underneath, which is
sitting on the same `persist-bg` photo the whole time so the handoff reads
as one continuous reveal rather than a cut. Desktop-only (`min-width: 641px`
gate in `initFilmRollIntro`) - mobile and reduced-motion visitors get the
static Phase 1 layout with no pin/scrub, both as the actual fallback and as
what static analysis/no-JS visitors see.

Two non-obvious bugs worth knowing if you touch this again:
- A flex item's `offsetParent` is its flex container, even when that
  container has no `position` set - `heroFrame.offsetLeft` alone silently
  dropped the parent track's own flex-centering offset. Walk the real
  offsetParent chain (see `cumulativeOffsetLeft` in animations.ts) rather
  than assuming a single hop, if you restructure the strip's markup.
- Numeric `scrub` values (e.g. `scrub: 0.4`) add GSAP's own lag on top of
  Lenis's already-smoothed scroll position - two independent smoothing
  systems fighting each other, worst right as scroll velocity approaches
  zero. Use `scrub: true` on any new pinned ScrollTrigger in this codebase.

**Multiple scrub-tied ScrollTrigger effects run concurrently** (the
pinned intro, persist-bg fade, hero parallax, per-section fade/scale in
`initSectionTransitions`). This is by design for the "cinematic journey"
feel, but it's also why scroll performance matters - Lenis was added
specifically because this many concurrent scrub animations reading raw,
un-smoothed scroll position felt choppy.

## Analytics (first-party, consent-gated)

Built 2026-10-23: a cookie-free tracker, two Netlify functions and a private
dashboard at `/analytics/`. The founder chose "own collector" over a hosted tool
and "full tracking behind consent" over anonymous-only. Rules that matter:

- **Nothing is tracked until the visitor clicks Accept.** `src/scripts/consent.ts`
  holds the choice under `hv-consent-v2`; the old `hv-cookie-consent` key meant
  "essential only" and must never be read as consent. Global Privacy Control /
  Do Not Track and the dashboard's "ignore my visits" flag (`hv-ignore`) beat
  consent. `/analytics*` is never tracked.
- **Flow:** `src/scripts/analytics.ts` (called from Layout's `astro:page-load`
  handler) -> `POST /api/collect` (`netlify/functions/collect.ts`) -> one raw
  JSON blob per batch in the `analytics` Netlify Blobs store -> `stats.ts`
  folds each past Dublin day into a cached daily rollup (no visitor IDs in it)
  and serves `/api/stats`, locked behind the `ANALYTICS_TOKEN` env var. All
  logic is in `src/lib/analytics/` (`core.ts` sanitising + rollup, `report.ts`
  merge, `server.ts` handlers written against a store interface, `demo.ts`
  sample data). The functions are thin wrappers - test logic there.
- **`ANALYTICS_TOKEN` must be set in Netlify** (Site configuration >
  Environment variables; `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  or `/api/stats` answers 503. There is no Netlify CLI here, so the functions
  can't run locally: `astro dev` has no `/api/*`, and the dashboard's
  `?demo=1` (dev only) shows sample data instead.
- **Raw records are purged after `RAW_RETENTION_DAYS` (30)**, once their
  rollup exists. `/privacy/` states that number and the full list of what is
  collected - change the page whenever the tracker or retention changes.
- **Treat every event as hostile.** Strings are sanitised and every counter map
  is capped (`MAP_CAP`) in `core.ts`; the dashboard writes labels with
  `textContent` only (`scripts/charts.ts`). Keep it that way.
- **A "day" is a Europe/Dublin day** everywhere (`dublinDay`).
- **Dashboard panels are `<div>`s, not `<section>`s on purpose:**
  `initSectionTransitions` scales and fades every `<section>` on the page.
- `npm install <pkg>` prunes `@astrojs/check` and `typescript` (installed but
  not in package.json) - restore with `npm install --no-save @astrojs/check typescript`.

## Known open items

- Contact form (`Contact.astro`) submits via Netlify Forms
  (`data-netlify="true"` on the `<form>`) - functional, no separate backend.
- Portfolio section has real client photos now (`src/assets/photos/portfolio/`)
  but no video content wired into the video lightbox yet, if that's still
  planned.
- **`Portfolio.astro` globs every file in `src/assets/photos/portfolio/*`
  automatically** (unlike `FilmRollIntro.astro`, which explicitly enumerates
  its own photo pool for exactly this reason). Dropping a new file into that
  folder puts it live on the public site immediately, caption and all -
  confirmed this actually happened (a watermarked photo and an unrelated
  personal shoot both went live unreviewed before being caught and added to
  `Portfolio.astro`'s `EXCLUDED_FILES` set). Check new files in that folder
  before they land, not after.
- `package-lock.json` - regenerate with `npm install` after pulling if
  it looks out of sync; don't hand-edit it.

## Working conventions from prior sessions

- Prices and copy changes go through `src/data/packages.ts`, which
  `Offer.astro` and the stays/food landing pages all read from. Each entry's
  `group` (`core` / `ongoing` / `addon`) decides which Offer section it
  lands in; array order is display order within a group. Payment/VAT lines
  on the Offer section mirror `terms.astro` - change them together.
- "FRAME 00N" tags number sections in reading order, per page, from 001.
  Homepage sections take their number from `src/data/homeFrames.ts` (which
  also drives `ScrollNav`'s dot numbers) - add or move a homepage section
  there, never hard-code its number. Standalone pages number their own
  sections directly in their templates. A page's tags must always read
  001, 002, 003... top to bottom, and any caption that quotes a frame
  number (e.g. "PHOTOGRAPHY - FRAME 001") must match its section's tag.
- Prefer `git format-patch` / small focused commits over one large diff
  when handing off work between sessions - makes bisecting issues easier
  given how much of this site is scroll-effect timing that's hard to
  debug from a diff alone.

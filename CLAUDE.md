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
- `src/components/` - one component per section (Header, Intro, Hero, Gap,
  Offer, Portfolio, Process, About, Seo, Contact, Footer, ScrollNav,
  Sprockets)
- `src/scripts/animations.ts` - all GSAP/ScrollTrigger logic, one exported
  `init*()` function per effect, called from `index.astro`'s inline script
- `src/scripts/lenis.ts` - Lenis smooth-scroll setup, exports `getLenis()`
  so other modules can route programmatic scrolls through it
- `src/layouts/Layout.astro` - holds the persistent fixed background
  (`.persist-bg`) that sits behind every section

## Key decisions worth knowing before changing things

**Header is `position: fixed`, not `sticky`.** This was a real bug fix, not
a style choice - `sticky` reserves its own height in document flow, which
pushed Intro's box down and exposed the wrong background (persist-bg,
cool/dark) behind the header instead of Intro's own warm artwork. Three
earlier commits tried to patch this by raising the header's opacity instead
of fixing the actual cause. If you touch Header.astro, know that `fixed`
is intentional and load-bearing for this reason.

**Scroll-behavior is `auto`, not `smooth`, in global.css.** Lenis owns
smooth scrolling now. Native CSS smooth-scroll would run its own competing
animation on anchor jumps and fight Lenis's easing. Anchor clicks are
intercepted in `lenis.ts` and routed through `lenis.scrollTo()` instead.

**The intro zoom effect (`initIntroZoomTransition` in animations.ts) is
resolution-limited.** The source image (`src/assets/photos/intro-window.png`)
is only 1456×816. `scale` and the perspective-driven `z` transform multiply
together (roughly `scale × 500/(500-z)` at this container's
`perspective: 500px`), so pushing these values up reintroduces visible
blur/blockiness. Currently at `scale: 2, z: 200` (~3.4x combined) as the
practical ceiling for this source. If a higher-resolution version of that
photo becomes available, these values can go back up - comments in that
function have the math.

**Multiple scrub-tied ScrollTrigger effects run concurrently** (pinned
intro zoom, persist-bg fade, hero parallax, per-section fade/scale in
`initSectionTransitions`). This is by design for the "cinematic journey"
feel, but it's also why scroll performance matters - Lenis was added
specifically because this many concurrent scrub animations reading raw,
un-smoothed scroll position felt choppy.

## Known open items

- Contact form (`Contact.astro`) is front-end only - no real submission
  endpoint wired up yet.
- Portfolio section has real client photos now (`src/assets/photos/portfolio/`)
  but no video content wired into the video lightbox yet, if that's still
  planned.
- `package-lock.json` - regenerate with `npm install` after pulling if
  it looks out of sync; don't hand-edit it.

## Working conventions from prior sessions

- Prices and copy changes go through `Offer.astro`'s `tiers` array at the
  top of the file - keep `num`/order fields consistent if reordering.
- Prefer `git format-patch` / small focused commits over one large diff
  when handing off work between sessions - makes bisecting issues easier
  given how much of this site is scroll-effect timing that's hard to
  debug from a diff alone.

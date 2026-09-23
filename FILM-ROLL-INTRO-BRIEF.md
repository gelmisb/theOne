# Film Roll → Live Site: Intro Brief

Brief for building a new homepage intro, collaboratively, in phases. Read
`CLAUDE.md` first for stack context and the reasoning behind existing
decisions (fixed header, Lenis, etc.).

## Kickoff prompt (paste this into Claude Code)

> Read CLAUDE.md and FILM-ROLL-INTRO-BRIEF.md. We're building this together
> in phases. Do Phase 0 only: inspect the current intro implementation, then
> give me your plan and the open questions from section 10. Don't write any
> code until I've answered.

---

## 1. The one idea

**"I shoot it, then I build the site around it."**

Visitors are owners of Irish cafés, salons, gyms, clinics and trades, not
designers. Within about five seconds they need to understand two things:
the photography is real (not stock), and a real website gets built around
it. Any beat that doesn't serve that sentence gets cut.

## 2. What this replaces

The current intro (`src/components/Intro.astro`, `intro-window.png`,
`intro-bg.mp4`, `initIntroTimeline` and `initIntroZoomTransition` in
`src/scripts/animations.ts`, and its interplay with `persist-bg` /
`initPersistBgFade` in `Layout.astro`). The glowing-portal concept is being
dropped because it reads as a spa/wellness site.

Don't delete any of it until the new intro is approved. Build the new
component alongside, swap it in via `index.astro`, and remove the old code
in a separate cleanup commit at the end. Check what `persist-bg` and
`initPersistBgFade` depend on before touching them.

## 3. Storyboard

One pinned section with a scroll-scrubbed GSAP timeline. Progress ranges
are starting points; tune them by feel.

**Beat 0 — Arrival (before any scroll)**
- A film strip spans the viewport, frames filled with real shoots from
  `src/assets/photos/portfolio/`. Sprocket holes and edge frame numbers,
  reusing the visual language of `Sprockets.astro`.
- The strip drifts slowly on its own so the page feels alive before the
  visitor scrolls. This drift is time-based, not scrubbed.
- The wordmark (the real `<h1>`), one plain-language line, and the primary
  CTA are visible and clickable at first paint. No entrance delay on text.

**Beat 1 — The roll (0 → ~0.35)**
- Scroll takes over from the idle drift and drives the strip sideways. The
  handoff must be seamless: no jump in position or speed.
- Optional: slight perspective or curve so it reads as film coming off a
  spool. The wordmark and tagline move out of the way.

**Beat 2 — The stop (~0.35 → ~0.5)**
- The strip decelerates and one chosen hero frame locks to centre. The
  neighbouring frames dim. It should feel like picking a frame off a
  contact sheet.

**Beat 3 — Develop (~0.5 → ~0.7)**
- The hero frame develops: it starts as a colour negative (inverted, with
  an orange film-base cast) and resolves to the final positive image.
- First pass uses CSS filters (`invert`, `sepia`/`hue-rotate`, `contrast`)
  on that single image only. Move to canvas/WebGL only if CSS looks cheap,
  and only after asking.

**Beat 4 — The build (~0.7 → 1.0)** — revised after Phase 0
- The developed hero frame expands directly into the real Hero section's
  hero image — no mock website, no simulated UI. Animate with transforms
  (FLIP-style), not width/height.
- As the frame expands, the pin releases into the actual page: Hero.astro,
  unchanged, with the real fixed header, real headline, and real CTA
  already working. This must read as one continuous reveal, not a cut —
  the visitor should feel like they've arrived on the real site, not
  watched a preview of one.
- No fabricated GBP-style card, no mock nav, no mock CTA. Proof now comes
  from landing on the real, live site itself, not a simulated mock-up of
  one — a stronger version of the same claim.
- The "see your own business" proof-by-example moment (a real Grafton
  Barbers case study) moves to the Portfolio section as a separate, later
  task — not part of this component.

## 4. Content rules — revised after Phase 0

- Real photos only. No stock and no AI-generated imagery anywhere in this
  section.
- No mock website and no fictional or third-party client business. Beat 4
  hands off into Horizon Vantage's own real Hero section — this is our
  site, shown as itself, not a simulated one for someone else.
- `D:\Photos\Edited\Events\Grafton Barbers - J6` is cleared for reuse in
  Horizon Vantage's own marketing. The specific photo used as the hero
  frame — the one that becomes Hero's own hero image — needs a signed
  release before it ships, since that's the most prominent use. Until
  that's in hand, use a different rights-cleared real photo as the hero
  frame (roll frames that aren't the hero don't need the release).
- The roll itself (Beats 0–2) can include other real, rights-cleared
  photos — portfolio work or personal-archive shoots — for variety, even
  ones that aren't candidates for the hero frame.

## 5. Technical constraints

- Stack stays as is: Astro, GSAP + ScrollTrigger, Lenis
  (`src/scripts/lenis.ts`). No React or Vue. No new dependencies without
  asking. GSAP's own plugins (Flip, etc.) are fine since they ship in the
  `gsap` package. Three.js or OGL only if we agree on it.
- New component: `src/components/FilmRollIntro.astro`. Animation logic goes
  in its own init function(s), either in `animations.ts` or a new
  `src/scripts/filmroll.ts`, following the existing one-init-per-effect
  pattern and called from `index.astro`.
- Use colours and type from the CSS variables in `src/styles/global.css`.
  Don't hardcode new brand colours.
- Images go through Astro's `<Image>`/`<Picture>` with explicit width and
  height. The first visible frames load eagerly, with `fetchpriority="high"`
  on the LCP candidate; the rest load lazily.
- Animate `transform` and `opacity`. Filter animation only on the single
  hero frame. Never animate `width`, `height`, `top` or `left`.
- Use `gsap.matchMedia()` for three variants: desktop, mobile (shorter pin,
  fewer frames, possibly a vertical strip), and reduced motion.
- Respect the fixed header (see `CLAUDE.md`) and keep the section ids that
  `ScrollNav.astro` relies on working.

## 6. Accessibility and fallbacks — revised after Phase 0

- `prefers-reduced-motion`: no drift, no scrub, no pin. Show the final
  state — the developed hero photo positioned as Hero's own hero image,
  with Hero's real headline and CTA already visible — as a static
  composition. No simulated build to fake.
- No JavaScript: the same static final state is visible. Only hide things
  for entrance animation when a `.js` class is present on `<html>`.
- The film strip is decorative (`aria-hidden="true"`). (The mock-website
  screen-reader concern from the original brief no longer applies — there
  is no mock website; Hero's own markup was already real, accessible
  HTML.)
- The CTA is keyboard-reachable from first paint. Add a "Skip intro" link
  that jumps past the pinned section, landing directly on Hero.
- Pause the idle drift when the section is off-screen or the tab is hidden.

## 7. Performance budget

- Lighthouse mobile: LCP under 2.5s (target under 1.8s), CLS under 0.1,
  INP under 200ms.
- Total image weight for this section at or under ~1.5 MB on mobile.
- Steady 60fps on a mid-range laptop while scrubbing; no long tasks over
  50ms during scroll.
- Pin length around 250–300vh on desktop, less on mobile. If it feels like
  scroll-jacking in testing, shorten it.
- Run Lighthouse mobile before and after, and put the numbers in the commit
  message.

## 8. Don'ts

- No glowing orbs or portals, gradient blobs, glassmorphism, or fake
  dashboards.
- This is one orchestrated moment. Don't add fade-ins to every element; the
  rest of the page stays quiet.
- No text entrance animation that delays the offer or CTA.
- Don't touch other sections (Offer, Portfolio, etc.) as part of this work.
- Don't remove the old intro until I approve the new one.

## 9. How we work: phases with checkpoints

Stop at the end of each phase, summarise what changed, and wait for me.
Commit at the end of each phase with a message that explains why, not just
what.

**Phase 0 — Recon and plan (no code)**
- Read `CLAUDE.md`, `Intro.astro`, the relevant inits in `animations.ts`,
  `Layout.astro` (persist-bg) and `index.astro`.
- Report what the current intro depends on, what's safe to replace, and
  the risks.
- Propose beat timings, component structure, the mobile approach, and a
  quick ASCII sketch of each beat.
- Ask the open questions in section 10.

**Phase 1 — Static layout**
- Build `FilmRollIntro.astro` with no animation: strip, frames, wordmark,
  CTA, and the final mock-website state, fully responsive. This doubles as
  the reduced-motion and no-JS fallback. I review it in the browser.

**Phase 2 — Roll and stop**
- Idle drift, scroll-driven roll with a seamless handoff, deceleration, and
  the lock onto the hero frame. Desktop first.

**Phase 3 — Develop and build**
- Negative-to-positive develop, frame expansion, website assembly, and the
  handoff to the next section.

**Phase 4 — Mobile, reduced motion, polish**
- `matchMedia` variants, skip link, drift pausing, performance pass, and
  Lighthouse numbers.

**Phase 5 — Cleanup (only after I approve)**
- Remove the old portal intro code and assets, and update `CLAUDE.md` to
  describe the new intro and why it's built the way it is.

## 10. Open questions: ask me, don't assume

1. Which photos go on the roll, and which one is the hero frame?
2. Whose website gets built in Beat 4: a real client (with permission) or a
   fictional business?
3. Develop effect: negative to positive, a blur-to-sharp focus pull, or
   both?
4. A straight horizontal strip, or a curved/perspective spool?
5. Should some frames play short muted video clips, now or in a later
   pass?
6. What follows the intro: the current Hero section, or do Intro and Hero
   merge into one?
7. Wordmark and one-line copy for the arrival state.

## 11. Definition of done

- [ ] A first-time visitor gets "real photos, real website built around
      them" within about five seconds, without reading body copy.
- [ ] Wordmark, one-liner and CTA are visible and usable at first paint.
- [ ] Idle drift hands off to scroll with no visible jump.
- [ ] The Beat 4 website is live HTML, not an image.
- [ ] Reduced-motion and no-JS show a complete, attractive static version.
- [ ] Skip intro link works; keyboard focus is visible throughout.
- [ ] Lighthouse mobile numbers meet section 7 and are recorded.
- [ ] Works on a real phone (iOS Safari and Android Chrome), not just
      devtools emulation.
- [ ] Old intro removed and `CLAUDE.md` updated, after approval.

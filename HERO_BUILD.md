# Horizon Vantage — Hero rebuild + scroll jitter fix

Instructions for Claude Code. Read this whole file before changing anything.

## Context

- **Site:** horizonvantage.ie, a marketing agency for Irish small businesses (photography, videography, websites, local SEO).
- **Stack:** Astro + GSAP + ScrollTrigger, deployed on Netlify.
- **Repo:** `gelmisb/theOne`, working branch **`dev1`**.
- **Brand:** black background, copper / rose-gold gradient accents, thin serif wordmark. Tagline: *"See further. Show it better."* The logo is a circular aperture/lens icon with a horizon swoosh.
- **Problem:** users report the site is **jittery on tablets**, and the owner has confirmed it on a tablet. That has to be fixed before the new hero goes in.
- **Owner:** not a coder. Explain what you changed in plain language at the end of each phase.

## Ground rules

1. Work on `dev1`. **Do not merge to `main` or any production branch, and do not deploy**, unless the owner explicitly says so.
2. **One commit per feature.** Each phase below is its own commit, or several small ones. Never mix the jitter fixes and the hero in one commit.
3. Remove all debug code (`console.log`, GSAP `markers: true`, test outlines) before committing.
4. **Respect the existing `prefers-reduced-motion` handling.** Extend it; don't replace or remove it.
5. **Do not touch:** `Welcome.astro`, `.gitignore`, `package-lock.json` (except for changes `npm install` makes when you add or upgrade a package), or the `name` field in `package.json`.
6. Leave the placeholder text "Ready Frame Studio" alone unless it's inside the hero you're replacing. Tell the owner where else it still appears.
7. Keep the current hero component file. Switch the homepage to the new one, and **ask before deleting the old file**.
8. **Animate only `transform` and `opacity`.** Never animate `top/left/width/height`, `filter`, `blur`, `backdrop-filter`, `box-shadow`, `background-position`, `clip-path` or `mask`. Static clip-paths are fine; animating them is not.

---

## Phase 1 — Find and fix the tablet jitter

### 1.1 Audit (report before fixing)

Search the codebase for `gsap`, `ScrollTrigger`, `ScrollSmoother`, `Lenis`, `scroll` event listeners, `requestAnimationFrame`, `100vh`, `backdrop-filter`, `filter:` and `will-change`.

Produce a short table of every ScrollTrigger or scroll-driven animation: file, element, which properties it animates, whether it pins, its scrub value, and any `onUpdate` callbacks. Show the table to the owner, then fix the problems.

### 1.2 Checklist. Fix every item that applies

- [ ] **Mobile address bar resize:** add `ScrollTrigger.config({ ignoreMobileResize: true })` once, globally.
- [ ] **Viewport units:** replace `100vh` with `100svh` (keep `100vh` as the fallback on the line above) on pinned or full-height sections.
- [ ] **Smooth scrolling on touch:** if Lenis or ScrollSmoother is used, disable it on touch devices (`smoothTouch: false`, or don't initialise Lenis when `matchMedia('(pointer: coarse)')` matches). Touch devices get native scrolling.
- [ ] **Properties that force layout or repaint:** rewrite any animation of the properties banned in ground rule 8 to use `transform`/`opacity` with the same visual result.
- [ ] **Scrub:** replace `scrub: true` with `scrub: 0.5`–`1` on anything heavy.
- [ ] **`onUpdate` / scroll handlers:** no layout reads (`getBoundingClientRect`, `offsetTop`, etc.) per frame. Cache values, and make scroll listeners `{ passive: true }`.
- [ ] **Pins:** add `anticipatePin: 1`. Where there are several pins, consider disabling pinning on touch with `ScrollTrigger.matchMedia` / `gsap.matchMedia()`.
- [ ] **Refresh timing:** call `ScrollTrigger.refresh()` once after `document.fonts.ready` and after the window `load` event, so trigger positions aren't calculated before images and fonts arrive.
- [ ] **Layout shift:** every `<img>` has `width`/`height` (or uses Astro `<Image>`), and nothing above the fold is lazy-loaded.
- [ ] **`will-change`:** only on elements that are animating, not sprinkled everywhere.
- [ ] **Astro View Transitions:** if the site uses `<ClientRouter />` / View Transitions, initialise animations on `astro:page-load` and kill them on `astro:before-swap`, so they don't stack up across page navigations.

### 1.3 Verify

- `npm run build && npm run preview`
- Chrome DevTools → Performance, with **4× CPU throttling**. Record a full scroll of the homepage. Target: no long tasks over 50 ms while scrolling, and no layout or paint storms.
- DevTools → Rendering → **Paint flashing**: nothing large should flash green on every frame while scrolling.
- Tell the owner how to test on a real tablet: Android via `chrome://inspect`, iPad via Safari Web Inspector.

Commit: `fix(perf): remove scroll jitter on touch devices`, with a bullet list of what changed.

---

## Phase 2 — New hero component (type-first "aperture" hero)

### 2.1 Concept

A type-led hero on black. A large thin-serif headline with one rotating word, a copper aperture (iris) from the logo that opens once on load, subtle film grain, and, on desktop only, a soft copper glow that follows the cursor.

The same component will later show video or photos **behind the aperture**. When the iris opens, it reveals the media. Build it so that switching from text-only to video or stills means changing props, not rewriting code.

### 2.2 Files

```
src/components/hero/Hero.astro         ← main component
src/components/hero/hero.ts            ← animation logic (bundled by Astro)
src/components/hero/Aperture.astro     ← aperture blades markup
public/textures/grain.png              ← static noise tile (generate it, ~200×200, greyscale, under 20 KB)
```

Replace the current hero on the homepage with `<Hero mode="type" />`.

### 2.3 Props

```ts
mode: "type" | "video" | "stills"   // build all three; homepage uses "type" for now
// video mode
videoDesktop?: { webm: string; mp4: string }
videoMobile?:  { webm: string; mp4: string }
poster?: ImageMetadata                // required in video mode
aspect?: "portrait" | "wide"          // portrait = single vertical clip; wide = 3 clips pre-combined side by side
// stills mode
stills?: ImageMetadata[]              // 3–4 images
```

### 2.4 Layout and copy

- Height: `min-height: 100vh; min-height: 100svh;`
- Desktop: headline on the left, about 60% width; the aperture frame on the right, portrait ratio around 4:5. On tablet and phone, stack them with the headline first and the aperture underneath, smaller.
- Use the site's existing serif and colour tokens. If there are no copper tokens, add:
  `--hv-copper-1: #B87333; --hv-copper-2: #E3A98B;` and a gradient `linear-gradient(100deg, var(--hv-copper-1), var(--hv-copper-2))`. Tell the owner to check these against the logo.

**Copy** (put it in one object at the top of `Hero.astro` so it's easy to edit):

- Headline: **"Your [café] — shot for real."** The rotating word cycles through: café → salon → gym → clinic → shop → business, then loops.
- Subline: **"Photos, video and a website that gets found — shot on-site across Wicklow and Dublin."** *(Owner should confirm the service area.)*
- Primary CTA button: **"Book a free 15-min call"** → link to the existing contact section anchor if there is one, otherwise `mailto:info@horizonvantage.ie`.
- Secondary text link: **"See the work"** → the portfolio/work section anchor, if one exists.
- Don't write anything that frames the business as "just one person".

**Accessibility and SEO:** the `<h1>` must contain a readable static phrase for screen readers and search engines, e.g. a visually hidden "Photography, video and websites for Irish small businesses". The animated rotating text is `aria-hidden="true"`. The CTA must meet WCAG AA contrast (4.5:1).

### 2.5 Animations (`hero.ts`)

Use GSAP **≥ 3.13** (SplitText is included free in the `gsap` npm package from that version on). Upgrade if needed.

**Intro timeline.** Plays once on load. Total length about 1.6 s. No ScrollTrigger and no pinning in the hero.

1. Wait for `document.fonts.ready` before splitting text, so the text isn't split twice.
2. Headline lines reveal with `SplitText.create(el, { type: "lines", mask: "lines", autoSplit: true, onSplit: self => gsap.from(self.lines, { yPercent: 100, stagger: 0.08, duration: 0.9, ease: "expo.out" }) })`.
3. Aperture iris opens: each blade rotates outward from its pivot (about 1.2 s, `power3.inOut`), overlapping the headline reveal.
4. Subline and CTAs fade up (`opacity` + `y: 16`).

**Rotating word**

- Stack the words in an inline box with `overflow: hidden`, and animate `yPercent` (transform only). Swap every ~2.4 s.
- Pause it when the hero leaves the viewport (IntersectionObserver) and when the tab is hidden (`visibilitychange`).
- The copper gradient goes on this word only.

**Aperture construction (important for performance)**

- 6 blades. Each blade is its **own HTML element** (a `div` containing a small inline SVG blade shape, or a div with a *static* clip-path). Animate the blade **divs'** `transform: rotate()` around a pivot set with `transform-origin`. Don't animate SVG attributes or SVG-internal transforms.
- **Type mode:** blades are hairline copper outlines on black, decorative. After the intro, the whole aperture wrapper rotates very slowly (one full turn every ~90 s) via `transform` on the **wrapper div**.
- **Video and stills modes:** blades are filled solid black and fully cover the media when closed. The frame has `overflow: hidden`, so opening blades rotate out of view and reveal the media underneath. Once the blades have finished moving, set `will-change: auto`.

**Film grain**

- `grain.png` tiled on a `::after` pseudo-element over the hero at `opacity: 0.04`, with `pointer-events: none`. **Static, no animation.** No `mix-blend-mode`.

**Cursor glow (desktop only)**

- Only when `matchMedia('(pointer: fine) and (min-width: 1024px)')` matches.
- A ~600 px circle with a copper `radial-gradient` at low opacity, `position: absolute`, moved with `gsap.quickTo(el, "x")` / `quickTo(el, "y")`. No `mix-blend-mode`, no `filter: blur` (do the softness in the gradient itself).
- Hidden and inactive on touch devices.

### 2.6 Video mode (build now, used later)

- The **poster image is the LCP element**: Astro `<Image>` / `<Picture>` with AVIF + WebP, `loading="eager"`, `fetchpriority="high"`, explicit width/height.
- The `<video>` element starts **with no `src`**. After the window `load` event (use `requestIdleCallback` where available, with a `setTimeout` fallback), add the `<source>` elements (WebM first, MP4 second) based on `matchMedia('(min-width: 1024px)')`: desktop or mobile files. Attributes: `muted playsinline loop autoplay preload="none"`.
- Pause the video when it's off-screen (IntersectionObserver) and resume when it's back.
- **Don't load any video** when `prefers-reduced-motion: reduce` or `navigator.connection?.saveData` is true. Show the poster only.
- `aspect="wide"` makes the frame wider (about 1.7:1) on desktop for the three-clip layout. On mobile, always use the portrait mobile file.
- No scroll-scrubbed reveal for now. The iris opens once on load. (A desktop-only scroll-scrub can be added later behind a flag; don't build it yet.)

### 2.7 Stills mode (build now, used later)

- 3–4 images through Astro `<Image>`. The first one is eager with `fetchpriority="high"`; the rest are lazy-loaded.
- Crossfade every ~4 s (`opacity`), with a slow `scale` from 1 to 1.06 on the visible image (Ken Burns, transform only).
- Pause when off-screen or the tab is hidden.

### 2.8 Reduced motion

When `prefers-reduced-motion: reduce` matches:

- Everything renders in its final state immediately: blades open, text visible, the rotating word fixed on "business".
- No slow rotation, no cursor glow, no Ken Burns, no video (poster only).

### 2.9 Performance budget

- The hero's own JS (excluding GSAP) is under ~5 KB gzipped.
- Lighthouse mobile: **LCP < 2.0 s, CLS < 0.05, TBT < 150 ms** on the built preview.
- With 4× CPU throttling: no long tasks over 50 ms during the intro, and no dropped-frame bursts.
- Only `transform` and `opacity` are animated (check this in the Performance panel).

### 2.10 Verify and commit

- Run the Phase 1 checks again on the new hero.
- Test widths of 375, 768, 1024 and 1440 px, both orientations at 768 and 1024.
- Test with reduced motion turned on (DevTools → Rendering → Emulate CSS `prefers-reduced-motion`).
- Commits, in order:
  1. `feat(hero): type-first aperture hero`
  2. `feat(hero): video and stills modes`
- Push to `dev1`. Then tell the owner in plain language what changed, how to preview it, and how to switch modes later.

---

## Appendix — Preparing footage later (ffmpeg)

The owner will provide clips later. Target sizes: **desktop ≤ 1.5 MB, mobile ≤ 1 MB**, 6–10 s loops, no audio. Put the outputs in `public/video/` and posters in `src/assets/hero/`.

**Single vertical clip (mobile + portrait frame), 720p:**

```bash
ffmpeg -ss 0 -t 8 -i input.mov -vf "scale=720:-2,fps=30" -an \
  -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart hero-mobile.mp4
ffmpeg -ss 0 -t 8 -i input.mov -vf "scale=720:-2,fps=30" -an \
  -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 hero-mobile.webm
```

**Three vertical clips combined side by side (desktop "wide" mode), 1080 px tall:**

```bash
ffmpeg -t 8 -i a.mov -t 8 -i b.mov -t 8 -i c.mov -filter_complex \
 "[0:v]scale=-2:1080,setsar=1,fps=30[a];[1:v]scale=-2:1080,setsar=1,fps=30[b];[2:v]scale=-2:1080,setsar=1,fps=30[c];[a][b][c]hstack=inputs=3[v]" \
 -map "[v]" -an -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart hero-desktop.mp4
```

Make the WebM from that file the same way (`libvpx-vp9 -crf 38 -b:v 0`). Raise the CRF if the file is over budget.

**Poster frame** (Astro `<Image>` handles conversion to AVIF/WebP):

```bash
ffmpeg -ss 1 -i hero-desktop.mp4 -frames:v 1 src/assets/hero/poster-desktop.png
```

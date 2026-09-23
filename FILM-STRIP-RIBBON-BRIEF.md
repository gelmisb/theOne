# Film Strip Ribbon: WebGL Brief

A curling, twisting 35mm film strip rendered in WebGL, with real client
photos in its frames. As the page scrolls, the film feeds along the ribbon.
This is the rendering technique for Beats 0–2 of `FILM-ROLL-INTRO-BRIEF.md`
(arrival, roll, stop). Beats 3–4 (develop, expand into the live Horizon
Vantage site) stay in the DOM, as described in that brief.

This brief is the agreement to add Three.js that the intro brief said to
ask about first.

## Kickoff prompt (paste into Claude Code)

> Read CLAUDE.md, FILM-ROLL-INTRO-BRIEF.md and FILM-STRIP-RIBBON-BRIEF.md.
> Start with Phase A only (a throwaway spike page). Before writing code,
> tell me your approach for the curve, the ribbon geometry and the shader,
> and ask me the open questions in section 9.

---

## 1. The goal

Reference shape: the screenshot I'll give you (a film strip that enters
from the top left, curls and twists over itself, then sweeps diagonally
across the page). Use it as a **shape reference only**. It's stock clip
art, so don't ship it or trace it. Build everything from scratch.

What the visitor sees:
- A real-looking 35mm strip curling through 3D space, with real shoots
  from `src/assets/photos/portfolio/` in the frames.
- Where the strip twists, the back of the film shows (darker, mirrored),
  like real film.
- Scrolling feeds the film along the strip. With no scroll input, it
  drifts slowly on its own.
- The strip passes through one flat, camera-facing section, the "gate".
  That's where the hero frame stops before the DOM takes over.

## 2. Core technique

**The strip shape stays mostly still; the content moves along it.**
Scrolling changes a texture offset uniform, not the geometry. That makes
it cheap (one static mesh, one draw call) and makes it read like film
going through a projector.

**Curve.** A `THREE.CatmullRomCurve3` through roughly 6–8 control points,
tuned to match the reference composition. It enters off-screen, curls,
passes through the gate, and exits off-screen. During Phase A, add dev-only
controls (OrbitControls, or a small panel for the control points) so we can
tune the shape by eye. Strip all of that from production.

**Ribbon geometry.** Build the mesh on the CPU once:
- Sample the curve at ~300–400 segments.
- Use `curve.computeFrenetFrames()` for stable normals. It's
  parallel-transport style, so it avoids sudden flips.
- Add a roll (twist) angle as a function of distance along the curve, so
  the strip can deliberately twist over where the reference does. The
  twist must be zero at the gate so the gate is flat.
- The width vector is the binormal rotated by the roll angle. Emit two
  vertices per sample at ±half-width, with `u` = distance along the strip
  (in frame units) and `v` = across the strip (0–1).

**Real 35mm proportions.** This is a craft detail and it's worth getting
right:
- Strip width is 35mm; the image area is 36 × 24mm.
- 8 perforations per frame; perforation pitch is about 4.75mm.
- Derive the ribbon width and frame pitch from these ratios, and scale the
  whole thing to fit the viewport.

**Shader (ShaderMaterial, DoubleSide).** Draw the film procedurally so it
stays sharp at any size:
- Film base colour, frame gaps, and rounded-rectangle perforations using
  signed distance functions. Perforations should be real transparency
  (`discard` or alpha).
- Photos sampled from a texture atlas: `u_photo = fract((u + uOffset) /
  framesInAtlas)`, mapped into the 36 × 24 image area.
- Edge print in the margin (frame numbers and a stock name). Bake this
  into the atlas or a second small texture rather than rendering text in
  the shader. **Don't use "Kodak", "Fuji" or any real trademark.** Use
  something like "HORIZON VANTAGE 400" plus frame numbers that match the
  site's existing FRAME numbering.
- Fake lighting: darken based on the angle between the surface normal and
  the view direction, so the curl reads as 3D.
- Back side (`!gl_FrontFacing`): show the film's back — darker, lower
  contrast, image mirrored.

**Texture atlas.** Build it at runtime:
- Load the portfolio images (use the WebP output from Astro's image
  pipeline), decode with `createImageBitmap`, and draw them in sequence
  onto a canvas at roughly 512px per frame.
- Keep the atlas at or below 4096px in each dimension (safe on mobile).
- Upload once. Photos loop if there are fewer photos than visible frames.

**Scroll and motion.**
- A ScrollTrigger with `scrub` drives `uOffset`. Lenis is already synced
  to GSAP's ticker (see `src/scripts/lenis.ts`), so scroll will already be
  smoothed.
- Idle drift is time-based and adds to `uOffset` when there's no scroll
  input. The handoff between drift and scroll must not jump.
- Optional and desktop-only: subtle camera parallax on mouse move.

## 3. The gate and the DOM handoff

This is the hardest part. Get it right in Phase D.
- Design the curve so the gate section is flat, facing the camera, and
  untwisted.
- When the timeline reaches the stop (Beat 2), ease `uOffset` so the hero
  frame lands exactly in the gate.
- Project the hero frame's four corners to screen space, then position a
  real DOM `<img>` (the same photo, via Astro `<Image>`) exactly over that
  rectangle.
- Crossfade: DOM image in, the frame in the texture out (for example, a
  `uHideFrame` uniform). Then fade or move the ribbon away.
- From here the DOM takes over: the develop effect and the expansion into
  the live site, per the intro brief. The frame must not visibly jump or
  change size at the handoff; check this at several viewport sizes.

## 4. Where it lives

- The spike goes in `src/pages/lab/film-strip.astro`: not linked from
  anywhere, `noindex`, and deleted in the final cleanup.
- Production code goes in `src/scripts/film-strip/` (curve, geometry,
  shader, atlas, controller), mounted by `FilmRollIntro.astro`.
- Add `three` as a dependency. Import only the modules you need.
- Load Three.js with a **dynamic import after first paint**, so it never
  affects LCP. The static DOM version of the intro (Phase 1 of the intro
  brief) renders first; the canvas fades in once it's ready.

## 5. Performance

- Mobile Lighthouse targets from the intro brief still apply: LCP under
  2.5s, CLS under 0.1, INP under 200ms.
- Expect roughly 100–150 KB gzipped for a tree-shaken Three.js. If that
  proves too heavy in measurement, tell me and propose OGL instead. Don't
  switch without asking.
- Cap device pixel ratio at 2 on desktop and 1.5 on mobile.
- Render on demand: run the render loop only while the section is visible
  (IntersectionObserver) and the tab is visible, and stop rendering when
  nothing is changing.
- Dispose of geometry, textures and the renderer if the component is torn
  down.
- Must hold 60fps on a mid-range laptop and stay smooth on a mid-range
  Android phone. Test on real devices, not just devtools.

## 6. Fallbacks and accessibility

- `prefers-reduced-motion`: no WebGL, no drift, no scrub. Show the static
  final state from the intro brief.
- No WebGL support, WebGL context loss, or a failed dynamic import: keep
  the static DOM version and don't show errors. Handle `webglcontextlost`.
- No JavaScript: the static DOM version is already there.
- The canvas is decorative: `aria-hidden="true"`. Everything meaningful
  (the heading, CTA and photos) exists in the DOM.

## 7. Don'ts

- Don't use the reference clip art as an asset.
- No real film-brand trademarks in the edge print.
- Don't move the geometry for the scroll effect; move the texture offset.
- Don't block first paint on Three.js loading.
- Don't touch other sections or the old intro code; that's covered by the
  intro brief's phases.

## 8. Phases with checkpoints

Stop after each phase, summarise, and wait for me. Commit at the end of
each phase with a message that explains why.

**Phase A — Spike: the shape.** Lab page only. Ribbon with a solid film
base and perforations, following a curve tuned to the reference, including
the twist and the flat gate. Dev controls for tuning. No photos yet. I
review the shape in the browser.

**Phase B — Photos and details.** Texture atlas with real portfolio
photos, correct 35mm proportions, back-side rendering, fake lighting, and
edge print.

**Phase C — Motion.** Scroll-driven feed via ScrollTrigger, idle drift,
seamless handoff between them.

**Phase D — Gate and DOM handoff.** Stop on the hero frame, project it to
screen space, crossfade into the DOM image, then hand over to the intro
brief's develop and expand beats. Integrate into `FilmRollIntro.astro`.

**Phase E — Hardening.** Dynamic import, fallbacks, context loss, DPR
caps, on-demand rendering, mobile tuning, Lighthouse numbers, real-device
testing. Delete the lab page.

## 9. Open questions: ask me, don't assume

1. How many photos go on the strip, and which one is the hero frame?
2. Match the reference composition closely, or propose our own curve?
3. Film base colour: classic black, or the orange-brown of colour negative
   film? (Orange base ties in nicely with the negative-to-positive develop
   effect.)
4. Edge print text: stock name and numbering format.
5. On mobile: keep the full curl, simplify the curve, or use a flatter
   strip?
6. Does the strip appear only in the intro, or recur later (for example,
   as a portfolio divider)?

## 10. Definition of done

- [ ] The strip reads as a real, curling 35mm film strip with real photos,
      at a glance.
- [ ] Scrolling feeds the film smoothly; idle drift hands off to scroll
      with no jump.
- [ ] The hero frame hands off from WebGL to the DOM with no visible jump
      at any viewport size.
- [ ] LCP is unaffected by Three.js; the static version renders first.
- [ ] Reduced motion, no WebGL and no JS all show a complete static
      version.
- [ ] 60fps on a mid-range laptop; smooth on a real mid-range Android
      phone.
- [ ] No trademarked film branding; no clip-art assets shipped.
- [ ] Lab page removed.

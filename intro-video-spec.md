# Intro Video Background - Technical Spec

Replaces the current CSS-transform zoom (`initIntroZoomTransition` in
`src/scripts/animations.ts`) with two real video clips: an ambient idle
loop and a scroll-scrubbed "push through the portal" sequence. Written for
Google Veo generation, with implementation notes for whoever picks this up
(Claude Code or otherwise).

## Why two clips, not one

A one-directional "push toward the light" clip can't loop on its own -
its end (deep in/through the portal) looks nothing like its start (sitting
back, portal small in frame). Two purpose-built clips avoids needing
reversed-playback tricks (flaky cross-browser, especially Safari):

- **Clip A (idle loop):** plays on load, before the visitor scrolls.
  Pure ambient motion, seamlessly loopable.
- **Clip B (scroll clip):** one-way dolly push, never loops - its
  `currentTime` is driven directly by scroll position, same mechanism
  the current CSS transform already uses, just targeting video instead
  of `scale`/`z`.

Both should share an **identical first frame** so the crossfade between
them (Section 3) is invisible.

---

## 1. Clip A - Idle ambient loop

**Generation approach:** image-to-video, starting from the existing
`src/assets/photos/intro-window.png` (or its eventual higher-res
replacement) so the first frame matches Clip B exactly.

**Prompt:**

> Subtle ambient motion only, no camera movement. The glowing circular
> portal's light gently breathes and pulses in brightness, soft warm
> golden tones shifting slightly. Faint volumetric dust motes drift
> slowly through the light beams. The seated silhouette figure in the
> foreground remains completely still. Ornate mirror frame and columns
> stay static. Camera locked off, no dolly, no pan, no zoom. Loopable -
> the final frame should return to the same brightness and light
> position as the opening frame. Cinematic, 24fps, 5 seconds.

**Settings:**
- Duration: 5 seconds (shortest that reads as a deliberate breathing
  cycle rather than a flicker)
- No native audio - mute/discard whatever the model generates
- If the model insists on adding tiny camera drift despite "locked
  off," regenerate rather than accept it - any net camera movement
  breaks the loop

**Verify before using:** scrub to the very last frame and compare it
side-by-side with the very first frame. If they don't match closely
enough to hide a hard loop-cut, either regenerate or plan for a short
(200-300ms) crossfade at the loop point in code as a safety net (see
Section 4).

---

## 2. Clip B - Scroll-driven push-through

**Generation approach:** image-to-video from the same starting still as
Clip A.

**Prompt:**

> Slow, steady dolly push-in toward the center of the glowing circular
> portal. Camera moves forward smoothly and continuously, no easing
> pauses. The golden light intensifies and softly blooms as the camera
> approaches, eventually filling the frame with warm white light. The
> seated silhouette figure in the foreground stays completely static -
> camera motion only, no character movement. Ornate mirror frame and
> columns pass by at the edges of frame as the camera advances toward
> and through the light. Cinematic, 24fps, 5 seconds, subtle warm lens
> flare building as the light grows.

**Settings:**
- Duration: 5 seconds base - do not extend before confirming the base
  shot's camera path is clean; extensions compound drift
- No native audio
- If the silhouette drifts or the camera path stutters/changes
  direction mid-shot, regenerate with "static subject, camera motion
  only, single continuous dolly move" appended

**Encoding for scroll-scrubbing (important):** standard video encoding
only places keyframes every ~1-2 seconds, so seeking `currentTime`
between keyframes can show visible stutter/blockiness during fast
scrolling - the video decoder has to decode forward from the last
keyframe to reach an arbitrary frame. For a short 5-second clip, re-encode
with every frame as a keyframe (`-g 1` in ffmpeg, i.e. all-intra) before
using it for scroll-scrubbing:

```
ffmpeg -i clip-b-raw.mp4 -c:v libx264 -g 1 -crf 18 -pix_fmt yuv420p -an clip-b-scrub.mp4
ffmpeg -i clip-b-raw.mp4 -c:v libvpx-vp9 -g 1 -crf 24 -b:v 0 -pix_fmt yuv420p -an clip-b-scrub.webm
```

File size will be noticeably larger than a normally-encoded clip
(all-intra gives up interframe compression) - for 5 seconds at 1080p
this is still typically only a few MB, which is fine to preload in full.
If size becomes a problem, the fallback is a canvas + image-sequence
approach (extract ~120-150 individual frames as compressed JPEGs, draw
the correct one to a canvas per scroll position) - more implementation
work, but frame-perfect and often smaller total payload. Not needed
unless the all-intra file size proves to be an actual problem.

---

## 3. State machine / hand-off logic

Three states, mirroring how `initIntroZoomTransition`'s pin already
works - this replaces that function's transform logic, not its
ScrollTrigger pin/scrub setup.

**State 1 - Idle (scroll progress === 0):**
- Clip A: visible, `autoplay muted loop playsinline`, playing
- Clip B: hidden (`opacity: 0`), paused, `currentTime = 0`

**State 2 - Scrolling within the pinned range (0 < progress < 1):**
- Triggered once, on the first scroll movement away from progress 0
- Crossfade: Clip A `opacity` 1→0, Clip B `opacity` 0→1, over ~300ms
- Pause Clip A (stop decoding cost) once its fade-out completes
- From here on: `clipB.currentTime = progress * clipB.duration`,
  updated on every ScrollTrigger update - identical wiring to how
  `scale`/`z` are currently scrubbed, just a different target property

**State 3 - Scrolled back to the very top (progress returns to 0):**
- Crossfade back: Clip B `opacity` 1→0, Clip A `opacity` 0→1
- Restart Clip A's loop from 0 and resume `play()`
- This is the natural, expected behavior if a visitor scrolls down partway
  into the effect and then scrolls back up before continuing

**Beyond the pin range (progress === 1, intro complete):** Clip B sits on
its final frame; the section unpins into Hero exactly as today, just
handing off from a real video frame instead of the scaled/transformed
image.

## 4. Implementation notes

- **`prefers-reduced-motion`:** skip both videos entirely - show the
  static first-frame image only, no autoplay, no scroll-scrub. Same
  pattern already used everywhere else in `animations.ts`
  (`if (prefersReducedMotion) return;`).
- **Mobile autoplay:** Clip A needs `muted` and `playsinline` attributes
  or iOS Safari will refuse to autoplay it inline.
- **Preloading:** Clip A needs `preload="auto"` since it must be ready
  the instant the page loads. Clip B should also start preloading
  immediately on page load (even though it's not shown yet) so it's
  fully buffered by the time the visitor starts scrolling - Intro being
  the very first section usually gives a second or two of head start
  before any scroll input arrives.
- **Formats:** provide both `.webm` (VP9, smaller) and `.mp4` (H.264,
  universal fallback) via multiple `<source>` elements on each
  `<video>`, same pattern as any standard responsive-video setup.
- **Crossfade implementation:** two stacked `<video>` elements
  (absolutely positioned, same dimensions), animate `opacity` via GSAP
  or CSS transition - do not swap a single element's `src`, which
  causes a reload/flash.
- **Where this plugs in:** replaces the `.to(feature, { scale, z, ... })`
  line in `initIntroZoomTransition` (animations.ts) with the crossfade +
  currentTime-scrub logic above. The existing pinned `ScrollTrigger`
  (trigger/start/end/pin/scrub) setup stays as-is - only what happens
  *inside* the timeline changes.

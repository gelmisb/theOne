---
target: intro (src/components/FilmRollIntro.astro)
total_score: 21
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:D:\\Projects\\_theOneStudio\\src\\components\\FilmRollIntro.astro"
target_fingerprint: "sha256:3a2fed768f7bd12e640631f4165b8cbef1c7d2c15d70f351583fb5340d654020"
target_path: "D:\\Projects\\_theOneStudio\\src\\components\\FilmRollIntro.astro"
timestamp: 2026-09-23T11-12-42Z
slug: src-components-filmrollintro-astro
---
# Design Critique — Film-Roll Intro

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Motion tracks scroll continuously, but the develop beat (p 0.40-0.72) gives almost no visible signal that anything is happening. |
| 2 | Match Between System and Real World | 4 | Darkroom metaphor (negative to positive, contact sheet, sprockets) is unusually apt for a photographer's own site. |
| 3 | User Control and Freedom | 2 | No explicit skip; forward pace is set entirely by raw scroll distance (~280vh). |
| 4 | Consistency and Standards | 2 | Header's glass "scrolled" state fires ~3% into the pin, contradicting its own code comment ("once scrolled past hero"). |
| 5 | Error Prevention | 2 | A resize-mid-scroll edge case is explicitly unguarded in the code's own comments. |
| 6 | Recognition Rather Than Recall | 3 | Frame tags/sprockets are self-explanatory; the tiny blurred develop-beat frame doesn't read as "film developing" without prior context. |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode first-visit hero; no accelerators expected. |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and on-brand, but the ~800px near-empty-black develop stretch reads as unfinished, not minimal. |
| 9 | Error Recovery | 2 | No visible recovery path if the unguarded resize case (or slow scroll) leaves the sequence in an odd mid-state. |
| 10 | Help and Documentation | n/a | Not applicable to a hero moment. |

**Total: 21/32 (66%) - Acceptable.** Solid concept, real execution gaps.

## Design Specificity Verdict

**LLM assessment:** This isn't a stock scroll effect with photos bolted on - the mechanism IS the pitch. Roll -> lock -> develop -> expand-into-real-Hero is a literal enactment of "I shoot it, then build the site around it," and Beat 4 hands off into the actual headline/CTA, not a mock preview. No unrelated business could reuse this unchanged without the metaphor going dead. But two content facts undercut it: only 3 of 24 frames are real distinct photos (repeating i % 3 - the same barber shot and cocktail glass cycle ~8 times each), and the one photo blown up to full-bleed at the climax (Barbershops.jpg) is the exact photo PRODUCT.md already flags as dated by a visible COVID-era mask. The concept is bespoke; the content behind it is thinner than the mechanism deserves.

**Deterministic scan:** Clean on both files scanned directly (exit 0, advisory-only). One real finding inside FilmRollIntro.astro: an undocumented rgba(0,0,0,0.8) text-shadow color outside DESIGN.md's palette (line 133) - minor, a text-shadow utility value, not worth a system addition. The page-wide browser scan (injected across the whole rendered site, not just this section) caught 47 anti-patterns total, but several of the most interesting ones are confident false positives once checked against DESIGN.md: kicker-above-heading fired 8 times on exactly DESIGN.md's own documented "Frame Tag" signature component (mono label + numbered tag above every H2 - deliberate and consistent, not accidental kicker-itis), and repeating-stripes-gradient is almost certainly the Sprockets divider, DESIGN.md's other named signature texture. buried-raster at 5% opacity is very likely the film-grain overlay (.grain), a deliberate atmospheric layer - worth noting DESIGN.md doesn't currently document grain/vignette as components, which is a real documentation gap this critique surfaced, separate from the finding being a false alarm.

One page-wide finding is a genuine, adjacent concern worth flagging even though it's technically outside this target: two portfolio images are labeled "AI Concept" at 9-10px text - below the detector's 11px legibility floor. If that disclosure is the thing standing between "real photo" and "AI-generated," it needs to actually be readable; this directly touches PRODUCT.md's non-negotiable "no AI imagery presented as real" principle. That's an /impeccable audit or /impeccable clarify item for Portfolio.astro specifically, not scored against this target.

## Overall Impression

Strong open, weak middle, strong close. Arrival is confident and immediate - CTA visible with zero scroll required. The roll-to-lock has real kinetic energy. Then the develop beat - meant to be the emotional payoff - asks a first-time visitor to stare at a matchbox-sized, blurred, inverted square in a sea of black for roughly a third of the total scroll distance, which risks reading as "the page broke" rather than "film is developing." The expand-into-Hero recovery is genuinely well-crafted: because the frame and Hero's background are the same photo, the handoff reads as one continuous reveal, not a scene cut. The single biggest opportunity is fixing the void in the middle without losing the negative-to-positive payoff that makes the concept work.

## What's Working

- The handoff is real, not staged. Beat 4 expands into the actual Hero section with its actual headline and CTA - exactly what a skeptical small-business owner needs to see to trust the flashy intro isn't hiding a thin site.
- Reduced-motion is correctly implemented, verified live: no pin, no scrub, matches first paint exactly with no partial-animation artifacts.
- Clean accessible-tree hygiene on the decorative strip - all 24 frames are aria-hidden="true", so screen-reader users skip straight to the real heading/CTA content.

## Priority Issues

**[P0] The develop beat is a near-empty black screen for ~a third of the sequence**
Why it matters: From p~0.40-0.72 (~800 of 2520px of pin distance), the screen is black except one static-sized, slowly de-blurring 130px square dead center. This is the intended emotional payoff, landing instead as a stalled page - directly undercutting the brief's "capture attention within seconds" goal, and it's the single biggest risk to a first-time visitor.
Fix: Start the frame's scale-up concurrently with (or shortly after) the color development, instead of holding it at native size through the whole beat.
Suggested command: /impeccable animate

**[P1] Keyboard tab order buries the intro's own CTA behind the entire section-jump nav**
Why it matters: Verified by tracing focus: wordmark -> 5 header links -> header CTA -> all 9 ScrollNav dot-links -> only then FilmRollIntro's "Book a Founder Shoot" (16th stop). ScrollNav mounts before FilmRollIntro in index.astro.
Fix: Reorder component mount order so FilmRollIntro's content precedes ScrollNav in the DOM.
Suggested command: /impeccable audit

**[P1] Header's glass "scrolled" state fires almost immediately, not "past Hero" as its own comment intends**
Why it matters: initNavOnScroll triggers at top -80 - ~3% into a 2520px pin. Confirmed visually: already a glass pill while the strip is still rolling. Breaks DESIGN.md's own Scroll-State Glass Rule.
Fix: Gate the trigger off the pin's end / Hero's start, matching the comment's stated intent.
Suggested command: /impeccable polish

**[P2] The hero frame magnified to full-bleed shows a visible COVID-era face mask**
Why it matters: Barbershops.jpg - the one photo used for the locked/developed/expanded hero frame - is the exact shoot PRODUCT.md flags as dated for this reason. Beat 4 makes it the most scrutinized single visual on the page.
Fix: Needs a mask-free frame for this specific slot; already tracked in PRODUCT.md. No design command fixes this - requires new photography.

**[P2] Only 3 real photos stretched across 24 frames, in an obviously repeating pattern**
Why it matters: realPhotos[i % 3] visibly cycles the same two photos ~8 times each in the very first thing a visitor sees - undercutting the "not a template with stock photos" premise.
Fix: vary crop/zoom per repeat, or reduce frame count to match actual real-photo inventory.
Suggested command: /impeccable distill

**[P3] No discoverable way to skip the intro; no progress indicator**
Why it matters: ScrollNav's dot-nav is a small 7px column with no "skip" affordance, hidden entirely under 900px width.
Suggested command: /impeccable onboard

## Persona Red Flags

**Jordan (confused first-timer / non-designer small-business owner):** Hits the P0 void directly. A near-fullscreen black page with one small indistinct blurry square, with zero prior exposure to darkroom metaphors, plausibly reads as "this page is broken."

**Casey (distracted mobile user):** Correctly gets the static arrival state only (scroll mechanic is desktop-only by design) and the CTA is reachable with zero scrolling, a genuine positive. But large dead black space above/below the strip on a tall phone viewport reads as sparse.

**Sam (accessibility-dependent, keyboard user):** Directly hit by the P1 tab-order issue - 9 auxiliary section-jump links stand between focus-start and the page's actual primary CTA.

## Minor Observations

- An old, unused Intro.astro (the prior "glowing portal") still sits in src/components/, unreferenced - harmless, worth cleanup once the new intro is fully approved.
- The develop beat's filter recipe is genuinely well-crafted and photographically literal - worth preserving even while fixing the P0 pacing issue.
- Simulated wheel events don't fully replicate native trackpad momentum; worth a real trackpad-fling pass to confirm back.out(1.2) doesn't visibly overshoot past the lock point.
- DESIGN.md doesn't currently document the film-grain/vignette overlay as a component, despite it being called "signature atmosphere" in its own code comment.

## Questions to Consider

1. What if "develop" and "expand" merged into one continuous beat instead of asking visitors to stare at a matchbox-sized image in a void for a third of the sequence?
2. With only 3 real photos available today, is 24 frames the right scale, or would 8-12 make the repetition invisible?
3. Is there a lighter-weight variant that front-loads some payoff for visitors who never scroll at all?

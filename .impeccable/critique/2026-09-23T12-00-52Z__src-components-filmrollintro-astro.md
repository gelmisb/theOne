---
target: intro (src/components/FilmRollIntro.astro)
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:D:\\Projects\\_theOneStudio\\src\\components\\FilmRollIntro.astro"
target_fingerprint: "sha256:3a6323c034e9ab4fde911bb10ea5c43c55d60f997a17cbdfb87e4e0274603f11"
target_path: "D:\\Projects\\_theOneStudio\\src\\components\\FilmRollIntro.astro"
timestamp: 2026-09-23T12-00-52Z
slug: src-components-filmrollintro-astro
---
# Design Critique — Film-Roll Intro (Re-run)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No indicator of how much pin remains - more noticeable now that mobile gets the same ~2.8x viewport-height commitment with a much smaller screen. |
| 2 | Match Between System and Real World | 4 | Darkroom/negative-to-positive metaphor remains exact and well-executed. |
| 3 | User Control and Freedom | 2 | Skip-link exists but is keyboard-only - mobile visitors, who get the full pin, have no visible or tappable way out. |
| 4 | Consistency and Standards | 3 | Header timing fix verified pixel-exact against DESIGN.md's Scroll-State Glass Rule. |
| 5 | Error Prevention | 2 | The faded-out CTA stays clickable and focusable for ~92% of the pin - an unintended-activation hazard. |
| 6 | Recognition Rather Than Recall | 3 | Self-evident visual metaphor, no learned behavior required. |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode surface. |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained, on-brand, no ornamental noise. |
| 9 | Error Recovery | 3 | No true error states; accidental CTA activation is at least harmlessly recoverable. |
| 10 | Help and Documentation | n/a | Not applicable. |

**Total: 24/32 (75%) - Good.** Up from 21/32 - every original issue genuinely fixed, two new ones surfaced by fixing them.

## Design Specificity Verdict

**LLM assessment:** Still real and specific, not a generic effect with photos dropped in. The fixes themselves read as genuine engineering, not surface patches - a single continuous back.out ease instead of spliced tweens, cumulativeOffsetLeft walking the true offsetParent chain, a Hero-anchored trigger instead of a magic-number offset. Verified live: the header's .scrolled fix is pixel-exact (false through heroTop=1, flips exactly at heroTop=0), not approximately-there.

**Deterministic scan:** FilmRollIntro.astro and index.astro are both clean (exit 0, zero findings). Hero.astro carries the same two pre-existing advisory findings as before (999px radius, safelight rgba color) - unrelated to this work, already known. The page-wide browser scan (67 anti-patterns, up from 47 - the increase is almost entirely the 7 new photo filenames now appearing as undersized caption text on Portfolio's own frames, not on FilmRollIntro) found nothing that maps to .filmroll-intro, .fr-content, .fr-track, .fr-frame, or .fr-fnum by name. Notably, the detector's static DOM/CSS scan did not catch either of this pass's two real findings below (missing viewport gate, missing pointer-events) - both required reading the actual animation code, which is outside what a markup/CSS scanner can see.

## Overall Impression

The fix pass worked. All six original issues are confirmed genuinely fixed, not just superficially patched - the P0 void, both P1s, the P3 skip link, and both P2s (photo variety and the mask). Fixing the desktop experience surfaced two things that only became visible once verified properly: the pin was never actually gated to desktop, so mobile has been getting the full ~280vh scroll-jacked sequence with no adaptation and no visible way out this whole time; and the CTA's fade-out was opacity-only, leaving it clickable and focusable long after it's invisible. Neither is a regression from this pass's work - both predate it - but this is the first time either was actually checked and confirmed.

## What's Working

- The header timing fix is exact, not approximate - verified pixel-by-pixel across the handoff boundary.
- Photo variety materially changes the first impression - arrival now shows genuine variety (gym, motorcycle, car, cafe, salon) with no visible repeat pattern in the initial viewport.
- The same-photo continuity handoff is confirmed seamless - because the frozen hero frame and Hero's own background are the same photo, the pin-release-to-content window shows no visible seam or flash.

## Priority Issues

**[P1] The scroll-pin was never gated to desktop, despite the brief's own assumption that it is**
Why it matters: initFilmRollIntro has no matchMedia/viewport check anywhere - confirmed by both assessments independently via direct code read. Its sibling initIntroZoomTransition does gate with min-width: 641px, showing the pattern exists in this codebase; it just wasn't applied here. Verified live at 390x844: the full pin - position: fixed, the entire roll-lock-develop-expand sequence, full-bleed hero photo - runs identically to desktop. On a 844px-tall phone that's over 3.5 phone-screens of scroll-jacked animation before real content appears, with no visible or tappable skip affordance (the skip-link is keyboard-focus-only, invisible to a touch user).
Fix: Gate the pin behind a desktop matchMedia check the same way initIntroZoomTransition already does, or ship the documented "Phase 4" mobile variant.
Suggested command: /impeccable adapt

**[P2] The faded intro CTA stays clickable and keyboard-focusable for ~92% of the pin**
Why it matters: .fr-content's opacity fades to 0 by 8% scroll progress via a bare gsap.set(content, { opacity }) - confirmed by both assessments (Assessment B grepped the whole src/ tree: zero pointer-events references in FilmRollIntro.astro or animations.ts). For the remaining ~2300px of the pin, an invisible CTA sits at a fixed screen position a cursor is likely to cross, and a keyboard user landing there (e.g. via a mid-page deep link) gets no visible focus ring at all.
Fix: Pair the opacity fade with pointer-events: none once it reaches 0, so it can't be hit-tested or focused while invisible.
Suggested command: /impeccable harden

**[P2] The new hero/climax photo is a compositionally weaker choice for the sequence's one full-bleed payoff moment**
Why it matters: Assessment A's live full-bleed inspection found IMG_0839 (gym coaching) to be a dim, low-contrast candid - a coach pointing at someone mid-exercise, with that person's bent-over legs dominating the mid-ground. It solves the mask problem but the whole point of this specific shot is to sell the founder's photography skill at maximum magnification, and this frame doesn't clearly do that.
Fix: Consider a straighter, better-lit frame - ideally with a clear subject facing camera - for the hero/climax slot specifically; it doesn't need to leave the general rotation, just the full-bleed spot.
Suggested command: /impeccable critique (needs a human photo-quality call, not a code fix)

## Persona Red Flags

**Cafe/salon owner browsing on her phone on a break:** Hit hardest by the P1 mobile gap - forced through 3.5+ phone-screens of scroll-jacked motion with no visible way out, on the persona least likely to tolerate it.

**Gym owner evaluating this vendor's photography quality:** Would zero in on the hero/climax image specifically (P2) since it's the single most magnified "look at my work" moment on the site - and it's currently the weakest photo for that job.

**Keyboard-only visitor arriving mid-page:** Benefits from the correctly-fixed skip link and tab order, but could land on the now-invisible CTA (P2) with no visible focus indicator.

## Minor Observations

- The hero frame uses loading="lazy" despite being the climax image - likely fine since its transform brings it toward the viewport early, but not verified under network throttling.
- A code comment ("each photo now repeats 3x") is stale post hero-override - IMG_0839 actually appears 4x, IMG_1643 2x. Cosmetic only.
- The two watermarked photos held back last session (IMG_8621.jpg, IMG_8760.jpg) are confirmed still untracked/unused in the roll's explicit glob - as intended.

## Questions to Consider

1. Was Phase 4 (the documented mobile/reduced-motion variant) simply never built - meaning phone visitors have been getting the full desktop-authored pin by accident rather than by decision?
2. Was the CTA's invisible-but-clickable state during the pin a deliberate "let people click through anytime" affordance, or a side effect of doing the fade with opacity alone? If deliberate, should it be visible rather than invisible?
3. Is the current gym-floor candid actually the strongest available frame for the one moment meant to sell "they can really shoot," or was it picked mainly to dodge the mask problem?

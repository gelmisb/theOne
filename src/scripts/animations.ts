import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis, destroySmoothScroll } from './lenis';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs once per session (wired from Layout.astro's own inline script, which
 * Astro's client router treats as identical across every page and so only
 * ever executes the one time - see that file for why this lives there and
 * not per-page). Fires immediately before the outgoing page's DOM is
 * replaced on a client-side transition.
 *
 * Every init function in this module creates ScrollTriggers, GSAP tweens,
 * and (via initSmoothScroll) a Lenis instance scoped to the outgoing page's
 * elements. Without an explicit teardown, transitioning to the next page
 * would leave all of that still running against now-detached nodes -
 * pinned ScrollTriggers holding stale spacer elements, an old Lenis
 * instance still driving its own raf loop alongside the new page's - which
 * is exactly what reads as "laggy and jittery" scrolling after a few
 * client-side navigations, the same class of bug as the pre-existing "two
 * controllers fighting over one tween" note on the film-roll idle drift.
 */
export function teardownForTransition() {
  ScrollTrigger.getAll().forEach((st) => st.kill());
  gsap.globalTimeline.clear();
  destroySmoothScroll();
  // Safety net for the mobile nav panel (initMobileNav, below): its own
  // close() fires on every link click inside the panel, but the brand/logo
  // link sits outside it, and so does the browser's own back/forward
  // navigation - either would otherwise carry .nav-open (and the resulting
  // scroll lock) over onto whatever page loads next, since Header persists
  // across transitions rather than remounting.
  document.querySelector('header')?.classList.remove('nav-open');
  document.body.style.overflow = '';
}

/**
 * Fixes a real bug: loading the page directly at a URL hash (e.g. /#offer)
 * makes the browser jump there natively, often before ScrollTrigger has
 * measured the pinned FilmRollIntro section - if that jump lands past its
 * trigger range before GSAP has anything to measure against, the pin can
 * get stuck in its pinned (position: fixed) state indefinitely, leaving the
 * intro rendered fixed at the top of the viewport no matter how far down
 * the page you actually are.
 *
 * Must run before any other init function sets up a pinned ScrollTrigger.
 * Forces the page to start at the top (so every pin measures correctly),
 * then - once the rest of this module's init functions have run and the
 * page has settled - refreshes ScrollTrigger against the real layout and
 * scrolls to the original hash target.
 */
export function initScrollHashFix() {
  if (!location.hash) return;
  const hash = location.hash;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const settle = () => {
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;
      const lenis = getLenis();
      if (lenis) {
        lenis.scrollTo(target, { immediate: true });
      } else {
        target.scrollIntoView();
      }
    });
  };

  // The real window 'load' event only ever fires once per hard navigation -
  // never again on a client-side transition (ClientRouter, Layout.astro),
  // so a page arrived at via a transition (e.g. a Footer link to /#offer
  // clicked from another page) would have registered a 'load' listener
  // that then simply never fires. By the time this runs on a transition,
  // 'load' has long since happened and document.readyState is already
  // 'complete' - settle immediately in that case instead of waiting on an
  // event that's not coming again.
  if (document.readyState === 'complete') {
    settle();
  } else {
    window.addEventListener('load', settle, { once: true });
  }
}

/**
 * Scroll-triggered reveal for any element with [data-reveal].
 * Groups that share a [data-reveal-group] stagger together.
 */
export function initScrollReveals() {
  if (prefersReducedMotion) {
    gsap.set('[data-reveal]', { opacity: 1, y: 0 });
    return;
  }

  const groups = new Map<string, Element[]>();
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const group = el.dataset.revealGroup ?? el;
    const key = typeof group === 'string' ? group : (el.closest('section')?.id ?? 'ungrouped') + Math.random();
    if (!groups.has(key as string)) groups.set(key as string, []);
    groups.get(key as string)!.push(el);
  });

  groups.forEach((els) => {
    gsap.fromTo(
      els,
      { opacity: 0, y: 26 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: els[0] as Element,
          start: 'top 85%',
          once: true,
        },
      }
    );
  });
}

/**
 * Film roll intro (Phase 3): idle drift, then one scroll-scrubbed sequence
 * covering all four storyboard beats from FILM-ROLL-INTRO-BRIEF.md section 3:
 *
 *   Beat 1/2 (0 -> ROLL_LOCK_END)  roll, decelerate, lock the hero frame to
 *                                  centre, dim its neighbours.
 *   Beat 3   (-> DEVELOP_END)      the locked hero frame develops: colour
 *                                  negative + soft focus resolving to a sharp
 *                                  positive, via CSS filter only.
 *   Beat 4   (-> end)              the developed frame expands (transform
 *                                  only - scale + translate, never width/
 *                                  height) until it fills the viewport, then
 *                                  the pin releases into the real Hero
 *                                  section underneath.
 *
 * Desktop-first pass; mobile and reduced-motion variants (gsap.matchMedia())
 * are Phase 4.
 *
 * Every beat is computed as a pure function of scroll progress `p` inside one
 * onUpdate, rather than as chained GSAP tweens, for two reasons proven out
 * fixing Phase 2's roll-to-lock glitch: (1) a tween's "from" value is
 * captured at creation time, not at the moment it's actually needed - wrong
 * for the idle-to-scroll handoff, which needs .fr-track's *live* x the
 * instant the pin engages (`baseX`, read in onEnter). (2) splicing separate
 * eases at a fixed progress boundary leaves a seam where their slopes don't
 * match, which reads as a glitch right at that boundary - single continuous
 * eases per beat avoid that.
 *
 * Beat 4's expansion target is computed once in measure(): lockX already
 * guarantees the hero frame's horizontal centre lands on the viewport centre
 * once locked, and since no vertical transform is ever applied to the strip,
 * the frame's vertical position is constant and safe to read once via
 * getBoundingClientRect. From there, scaling to cover the viewport and
 * translating to viewport-centre is a standard FLIP-style delta - applied to
 * the hero frame itself, on top of the track's own x, since transforms on a
 * parent and child compose independently.
 */
export function initFilmRollIntro() {
  const section = document.querySelector<HTMLElement>('.filmroll-intro');
  const stripWrap = document.querySelector<HTMLElement>('.fr-strip-wrap');
  const stripViewport = document.querySelector<HTMLElement>('.fr-strip');
  const track = document.querySelector<HTMLElement>('.fr-track');
  const heroFrame = track?.querySelector<HTMLElement>('[data-hero-frame="true"]');
  const heroImg = heroFrame?.querySelector<HTMLElement>('.fr-photo');
  const heroFnum = heroFrame?.querySelector<HTMLElement>('.fr-fnum');
  const content = document.querySelector<HTMLElement>('.fr-content');
  const sprockets = gsap.utils.toArray<HTMLElement>('.sprockets', section ?? undefined);
  if (!section || !stripWrap || !stripViewport || !track || !heroFrame || !heroImg || !heroFnum || !content) return;

  // .fr-strip-wrap carries the "little bit diagonal" tilt (its own CSS
  // `transform: rotate(4deg)`). Read the actual applied angle off computed
  // style rather than hardcoding 4 here too - two copies of the same number
  // drifting apart is exactly how the hero frame ends up crooked again the
  // next time someone tweaks the tilt in the .astro file without knowing
  // this reads it back. Beat 4 below spins the hero frame by the negative
  // of this angle as it expands, so it visually straightens out instead of
  // ballooning into the viewport still tilted.
  function getRotationDeg(el: HTMLElement): number {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = t.match(/^matrix\(([^)]+)\)$/);
    if (!m) return 0;
    const [a, b] = m[1].split(',').map(Number);
    return Math.atan2(b, a) * (180 / Math.PI);
  }
  const stripRotationDeg = getRotationDeg(stripWrap);

  // Desktop-first pass (brief section 9, Phase 2). This never actually had a
  // gate, so mobile visitors were getting the full ~280vh scroll-jacked pin
  // with no adaptation - found via /impeccable critique intro's re-run.
  // Mobile/reduced-motion get Phase 1's static, flex-centred layout as-is;
  // a proper mobile variant (shorter pin, fewer frames) is Phase 4.
  const isDesktop = window.matchMedia('(min-width: 641px)').matches;
  if (prefersReducedMotion || !isDesktop) return;

  const otherFrames = gsap.utils.toArray<HTMLElement>('.fr-frame', track).filter((f) => f !== heroFrame);
  heroFrame.style.willChange = 'transform';
  heroImg.style.willChange = 'filter';

  const CONTENT_FADE_END = 0.08; // wordmark/tagline/CTA clear out almost immediately, per Beat 1
  const DIM_START = 0.24;
  const ROLL_LOCK_END = 0.4; // Beat 1/2 complete
  const DEVELOP_END = 0.1; // colour/focus fully resolved by here
  // Beat 4 starts partway through Beat 3 rather than waiting for it to
  // finish. Holding the frame at native size for the entire develop beat
  // (0.4 -> 0.72, ~a third of the whole pin) left the screen almost empty -
  // a small, blurred square in a sea of black for a long stretch, which
  // critique found reads as a stalled/broken page rather than film
  // developing. Starting the scale-up here means the frame is visibly
  // growing and gaining presence for the second half of the develop beat,
  // instead of sitting inert until colour finishes resolving.
  const EXPAND_START = 0.1;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  // A single ease drives the whole roll, rather than splicing a "roll" ease
  // and a "lock" ease together at a fixed progress fraction (see this
  // function's doc comment) - "back.out" overshoots past 1 and settles on
  // its own, in one continuous curve.
  const positionEase = gsap.parseEase('back.out(1.2)');
  const expandEase = gsap.parseEase('power2.inOut');

  let lockX = 0;
  let baseX = 0;
  let scaleCover = 1;
  let expandTranslateY = 0;

  // offsetLeft/getBoundingClientRect read layout position, unaffected by the
  // transforms this same element is about to receive - safe to recompute on
  // resize. (Resizing mid-scroll, while the frame is already mid-transform,
  // is a known edge case this doesn't specially guard against.)
  //
  // offsetLeft is only relative to the element's own offsetParent, not the
  // section - and a flex item's offsetParent is its flex container, even
  // when that container itself has no `position` set. .fr-frame's immediate
  // offsetParent turns out to be .fr-track, not .filmroll-intro, so reading
  // heroFrame.offsetLeft alone silently dropped .fr-track's own ~882px
  // flex-centering offset (relative to the section) - the hero frame was
  // never actually locking to centre, just to a fixed amount short of it.
  // Walking the real offsetParent chain instead of assuming one hop fixes
  // this generally, rather than hardcoding today's specific DOM depth.
  function cumulativeOffsetLeft(el: HTMLElement, stopAt: HTMLElement): number {
    let x = 0;
    let node: HTMLElement | null = el;
    while (node && node !== stopAt) {
      x += node.offsetLeft;
      node = node.offsetParent as HTMLElement | null;
    }
    return x;
  }

  function measure() {
    const center = cumulativeOffsetLeft(heroFrame!, section!) + heroFrame!.offsetWidth / 2;
    lockX = window.innerWidth / 2 - center;

    const rect = heroFrame!.getBoundingClientRect();
    // scaleCover has to be relative to the frame's own untransformed size
    // (offsetWidth/offsetHeight), not getBoundingClientRect's axis-aligned
    // box. With the strip tilted, rect.width/height are the *bounding box*
    // of a rotated square - wider and taller than the square itself - so
    // dividing by them understated the scale needed to cover the viewport,
    // which is why the frame sometimes stalled at ~90% of full width/height
    // instead of reaching true full-bleed. The frame's own size doesn't
    // change with rotation, so offsetWidth/offsetHeight are the right divisor
    // regardless of the strip's tilt.
    scaleCover = Math.max(window.innerWidth / heroFrame!.offsetWidth, window.innerHeight / heroFrame!.offsetHeight);
    // Rotation is around the frame's own center, so the bounding box's
    // center still lands on the frame's true visual center - safe to keep
    // reading this from rect.
    expandTranslateY = window.innerHeight / 2 - (rect.top + rect.height / 2);
  }
  measure();

  // Beat 0: a slow, small back-and-forth so the strip reads as alive before
  // anyone scrolls. gsap.to() plays immediately on creation, so no extra
  // "start playing" step is needed here.
  const idleTween = gsap.to(track, {
    x: '+=22',
    duration: 5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  // Tracks whether idle drift SHOULD be playing once the tab is visible
  // again - onEnter/onLeaveBack below are the single source of truth for
  // that, not a separate visibility-based ScrollTrigger. An earlier version
  // used a second ScrollTrigger (watching "is this section anywhere near
  // the viewport") that independently called idleTween.play()/.pause(),
  // racing with onEnter/onLeaveBack's own play()/pause() calls on the exact
  // same tween - on this page that second trigger had no scenario to handle
  // that onEnter/onLeaveBack didn't already cover (this section is the very
  // first thing on the page, so there's no "scrolled above it" case), it
  // just added a second, occasionally-conflicting writer. Two independent
  // controllers fighting over one tween's play state is a plausible cause
  // of the reported glitch: scrolling to a stop, then the strip visibly
  // juddering side to side for a moment before settling.
  let idleShouldPlay = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) idleTween.pause();
    else if (idleShouldPlay) idleTween.play();
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * 2.8, // ~280vh - covers all four beats (brief section 7: "250-300vh on desktop")
    pin: true,
    // Lenis already smooths raw scroll input (lenis.ts). A numeric scrub
    // value here would add GSAP's own extra lag on top of that - two
    // independent smoothing systems fighting each other, which shows up as
    // jittery, glitchy back-and-forth motion right as scroll velocity
    // approaches zero. `true` ties everything directly to Lenis's
    // already-eased position instead; the per-beat eases below provide the
    // actual deceleration feel, so no second layer of lag is needed.
    scrub: true,
    invalidateOnRefresh: true,
    onRefresh: measure,
    onEnter: () => {
      idleShouldPlay = false;
      idleTween.pause();
      baseX = Number(gsap.getProperty(track, 'x')) || 0;
    },
    onLeaveBack: () => {
      idleShouldPlay = true;
      idleTween.play();
    },
    onUpdate: (self) => {
      const p = self.progress;

      // Beat 1/2 - roll and lock
      const pRoll = clamp01(p / ROLL_LOCK_END);
      const x = gsap.utils.interpolate(baseX, lockX, positionEase(pRoll));
      gsap.set(track, { x });

      // pointerEvents rides alongside opacity - without it, the faded-out
      // wordmark/CTA stayed hit-testable and keyboard-focusable for the
      // remaining ~92% of the pin (found via /impeccable critique intro's
      // re-run), an invisible click target sitting at a fixed point on
      // screen for most of the sequence. Re-enabled on the way back up so
      // reversing the scroll restores it exactly like everything else here.
      const contentFade = gsap.parseEase('power1.in')(clamp01(p / CONTENT_FADE_END));
      gsap.set(content, { opacity: 1 - contentFade, pointerEvents: contentFade >= 1 ? 'none' : 'auto' });

      const dim = gsap.parseEase('power1.out')(clamp01((p - DIM_START) / (ROLL_LOCK_END - DIM_START)));
      gsap.set(otherFrames, { opacity: 1 - dim });
      if (sprockets.length) gsap.set(sprockets, { opacity: 1 - dim });

      // Beat 3 - develop: colour negative + soft focus resolving to a sharp
      // positive. Only touches the filter once the frame is actually locked
      // (p >= ROLL_LOCK_END) - clamp01() alone would floor the (p -
      // ROLL_LOCK_END) fraction to 0 for the entire roll, meaning the hero
      // frame would render fully inverted and blurred from the very first
      // frame, while it's still rolling past among 23 normal-looking
      // neighbours. Left unfiltered (matching every other frame) until then.
      if (p < ROLL_LOCK_END) {
        gsap.set(heroImg, { filter: 'none' });
      } 

      // Beat 4 - expand into Hero, then the pin releases. Starts at
      // EXPAND_START (mid-develop), not DEVELOP_END - see that constant's
      // comment above.
      const te = expandEase(clamp01((p - EXPAND_START) / (1 - DEVELOP_END)));
      gsap.set(heroFrame, {
        scale: 1 + (scaleCover - 1) * te,
        y: expandTranslateY * te,
        // Counter-rotate the hero frame against the strip's own tilt as it
        // expands, so by te=1 (full-bleed) it's dead straight instead of
        // ballooning into the viewport still carrying the strip's diagonal.
        rotation: -stripRotationDeg * te,
        transformOrigin: '50% 50%',
        borderColor: te > 0.02 ? 'transparent' : 'var(--line)',
      });
      gsap.set(heroFnum, { opacity: 1 - te });
      // The strip's clipping boundaries are only frame-row-tall - without
      // this, the expanding hero frame would get clipped the moment it grows
      // past that height instead of filling the viewport.
      gsap.set([section, stripViewport], { overflow: te > 0 ? 'visible' : 'hidden' });
    },
  });
}

/**
 * Mobile-only video background for FilmRollIntro, founder-supplied clip
 * (src/assets/videos/intro-bg.mp4) - swaps in for the static film strip
 * below the desktop breakpoint. Mirrors initFilmRollIntro's own
 * isDesktop/reduced-motion gate exactly, rather than sharing state with
 * it, since the two are deliberately mutually exclusive: this is what
 * mobile gets *instead of* the pinned roll, not alongside it.
 *
 * The video itself ships with no `autoplay` and `preload="none"` in the
 * markup - nothing is fetched until this function actually decides to add
 * .fr-video-mode and call play(), so a no-JS or reduced-motion mobile
 * visitor never downloads it and keeps the static strip (this component's
 * documented fallback contract).
 */
export function initMobileIntroVideo() {
  const section = document.querySelector<HTMLElement>('.filmroll-intro');
  const video = document.querySelector<HTMLVideoElement>('.fr-mobile-video');
  const content = document.querySelector<HTMLElement>('.fr-content');
  if (!section || !video || !content) return;

  if (prefersReducedMotion) return;
  const isDesktop = window.matchMedia('(min-width: 641px)').matches;
  if (isDesktop) return;

  section.classList.add('fr-video-mode');
  video.play().catch(() => {
    // Autoplay can still be rejected on some browsers even when muted -
    // the poster-less video just stays on its first frame, which is a
    // harmless degrade (the scrim + heading still read fine over black).
  });

  // A livelier entrance than the plain "just there" static reveal the
  // desktop-gated Phase 1 fallback used to leave mobile with - back.out
  // overshoots slightly past full size before settling, the same ease
  // family initFilmRollIntro uses for the desktop roll (see its own
  // positionEase), so this reads as a variation on the site's existing
  // motion language rather than a new one.
  gsap.fromTo(
    content.children,
    { opacity: 0, y: 18, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, ease: 'back.out(1.6)' }
  );
}

/**
 * Fades Layout.astro's persistent journey background (visible through Hero,
 * which has no background image of its own) out as Gap scrolls through the
 * viewport, scrubbed to scroll position - fully faded by the time Gap has
 * passed, handing off cleanly to Gap's own background photo.
 */
export function initPersistBgFade() {
  const bg = document.querySelector<HTMLElement>('[data-persist-bg]');
  const gap = document.getElementById('offer-intro');
  if (!bg || !gap) return;

  if (prefersReducedMotion) return;

  gsap.to(bg, {
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: gap,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
}

/**
 * Wraps every word of an element's text content in a `.split-word` span,
 * recursing into child elements (e.g. an `<i>` accent span) so their own
 * styling still applies per-word. Whitespace is preserved as plain text
 * nodes between words so normal line-wrapping still works. Shared by the
 * Hero entrance timeline and the generic scroll-triggered heading reveal
 * below, rather than duplicated per component.
 */
export function splitIntoWordSpans(el: HTMLElement): HTMLElement[] {
  function walk(node: Node) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? '').split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'split-word';
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  }
  walk(el);
  return Array.from(el.querySelectorAll<HTMLElement>('.split-word'));
}

/** Hero entrance timeline - plays once on load, not on scroll. */
export function initHeroTimeline() {
  const heading = document.querySelector<HTMLElement>('.hero-h');
  // Homepage-only section - since this now runs unconditionally on every
  // page (see the shared astro:page-load handler in Layout.astro), guard
  // against the standalone pages the same way every other init function
  // here already does, rather than spamming "GSAP target not found"
  // warnings for a whole timeline of selectors that only exist on Hero.astro.
  if (!heading) return;
  const words = splitIntoWordSpans(heading);

  if (prefersReducedMotion) {
    gsap.set(
      '.hero-eyebrow, .hero-sub, .hero-ctas, .vf-corner, .hero-strip > div',
      { opacity: 1, y: 0 }
    );
    gsap.set('.vf-corner', { opacity: 0.35 });
    gsap.set(words, { opacity: 1, y: 0 });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.fromTo('.hero-eyebrow', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 })
    .fromTo(words, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 }, '-=0.35')
    .fromTo('.hero-sub', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.3')
    .fromTo('.hero-ctas', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.45')
    .fromTo('.vf-corner', { opacity: 0 }, { opacity: 0.35, duration: 1, stagger: 0.08 }, '-=0.6')
    .fromTo(
      '.hero-strip > div',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
      '-=0.3'
    );
}

/**
 * Generic scroll-triggered word-by-word reveal for any heading marked
 * [data-split-reveal] (Offer's headline to start). Snappier stagger than the
 * block-level [data-reveal] fade, matching the existing contact-sheet
 * sequential-reveal pacing convention.
 */
export function initHeadingSplitReveal() {
  const headings = document.querySelectorAll<HTMLElement>('[data-split-reveal]');
  if (!headings.length) return;

  if (prefersReducedMotion) return; // untouched text, nothing to reveal

  headings.forEach((heading) => {
    const words = splitIntoWordSpans(heading);
    gsap.fromTo(
      words,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          once: true,
        },
      }
    );
  });
}

/** Subtle parallax drift on the viewfinder brackets as the hero scrolls out. */
export function initHeroParallax() {
  if (prefersReducedMotion) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;

  gsap.to('.viewfinder', {
    yPercent: 18,
    opacity: 0.4,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  });
}

/** Contact-sheet frames light up in sequence, like a strip developing. */
export function initContactSheetReveal() {
  const frames = gsap.utils.toArray<HTMLElement>('.frame');
  if (!frames.length) return;

  if (prefersReducedMotion) {
    gsap.set(frames, { opacity: 1 });
    return;
  }

  gsap.fromTo(
    frames,
    { opacity: 0, filter: 'brightness(0.3)' },
    {
      opacity: 1,
      filter: 'brightness(1)',
      duration: 0.6,
      stagger: { each: 0.06, from: 'start' },
      ease: 'power1.out',
      scrollTrigger: {
        trigger: '.contact-sheet',
        start: 'top 80%',
        once: true,
      },
    }
  );
}

/**
 * Mobile nav toggle (the hamburger button, [data-nav-toggle]) - below
 * Header's 860px breakpoint its primary links are hidden with nothing to
 * replace them (a real bug found during the pre-launch shakedown: mobile
 * visitors had no way to reach Photography/Videography/Local SEO/Websites/
 * About at all). Toggles .nav-open on <header> itself, not on the button or
 * panel, because Header persists across client-side page transitions
 * (transition:persist, Layout.astro) while everything else on the page
 * doesn't - <header> is the one stable element to key the open/closed state
 * off across navigations.
 *
 * Guarded with a dataset flag rather than being safe-to-call-repeatedly
 * like most init functions here: Header persisting means this only ever
 * needs to wire its listeners once for the whole session (re-attaching on
 * every astro:page-load, the way the other init calls in this file's
 * shared caller do, would stack duplicate listeners on the same persisted
 * button and panel forever).
 */
export function initMobileNav() {
  const header = document.querySelector<HTMLElement>('header');
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const panel = document.querySelector<HTMLElement>('[data-nav-panel]');
  if (!header || !toggle || !panel) return;
  if (toggle.dataset.wired) return;
  toggle.dataset.wired = 'true';

  const close = () => {
    header.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  const open = () => {
    header.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  toggle.addEventListener('click', () => {
    if (header.classList.contains('nav-open')) close();
    else open();
  });
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) close();
  });
}

/**
 * Nav background solidifies once the user scrolls past the hero. Triggers
 * off Hero's own top reaching the viewport top, not a fixed scroll offset -
 * with FilmRollIntro's ~280vh pin now occupying the very top of the page,
 * a bare `start: 'top -80'` (no `trigger`, so it measures from the
 * document body) fired within the first 80px of scroll - a glass header
 * appearing while the intro was still mid-roll, before Hero was anywhere
 * near the viewport. Confirmed via critique (/impeccable critique intro):
 * this broke DESIGN.md's Scroll-State Glass Rule (glass = floating/active
 * signal, not a timing accident) and made the intro's pinned scene feel
 * interrupted by chrome that belonged to the next section.
 */
export function initNavOnScroll() {
  const header = document.querySelector('header');
  const hero = document.getElementById('hero');
  if (!header) return;
  // Header persists across client-side page transitions (transition:persist,
  // see Layout.astro) so its DOM node - and whatever class was on it - is
  // whatever the *previous* page left behind. Reset to the default
  // (non-scrolled) state on every page entry; the ScrollTrigger below (when
  // this page actually has a #hero to measure against) immediately
  // re-evaluates the real position from there, same as a fresh full load.
  header.classList.remove('scrolled');
  if (!hero) return;
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 99999,
    toggleClass: { targets: header, className: 'scrolled' },
  });
}

/** Buttons pull gently toward the cursor on hover - fine-pointer devices only. */
export function initMagneticButtons() {
  if (prefersReducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll<HTMLElement>('.btn').forEach((btn) => {
    const strength = 0.3;
    const moveX = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
    const moveY = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      moveX((e.clientX - rect.left - rect.width / 2) * strength);
      moveY((e.clientY - rect.top - rect.height / 2) * strength);
    });
    btn.addEventListener('mouseleave', () => {
      moveX(0);
      moveY(0);
    });
  });
}

/**
 * Web Projects' wireframe browser mockup ([data-mock-tilt]) tilts gently
 * toward the cursor - a 3D perspective rotation driven by pointer position
 * within the card, same quickTo-per-axis recipe as initMagneticButtons
 * above. Only one such element exists on the site today, so this stays a
 * single-element lookup rather than a querySelectorAll loop.
 */
export function initWebMockTilt() {
  if (prefersReducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const mock = document.querySelector<HTMLElement>('[data-mock-tilt]');
  if (!mock) return;

  const strength = 10;
  const rotateX = gsap.quickTo(mock, 'rotationX', { duration: 0.5, ease: 'power3.out' });
  const rotateY = gsap.quickTo(mock, 'rotationY', { duration: 0.5, ease: 'power3.out' });

  mock.addEventListener('mousemove', (e) => {
    const rect = mock.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY(px * strength);
    rotateX(py * -strength);
  });
  mock.addEventListener('mouseleave', () => {
    rotateX(0);
    rotateY(0);
  });
}

/** Portfolio lightbox - click a developed frame to view it full-size, arrow/keyboard navigable. */
export function initPortfolioLightbox() {
  const lightbox = document.querySelector<HTMLElement>('[data-lightbox]');
  const data = (window as any).__portfolioPhotos as { photoUrls: string[]; captions: string[] } | undefined;
  if (!lightbox || !data) return;

  const triggers = gsap.utils.toArray<HTMLElement>('[data-lightbox-trigger]');
  const img = lightbox.querySelector<HTMLImageElement>('[data-lightbox-img]');
  const caption = lightbox.querySelector<HTMLElement>('[data-lightbox-caption]');
  if (!img || !caption) return;

  let index = 0;

  const show = (i: number) => {
    index = (i + data.photoUrls.length) % data.photoUrls.length;
    img.src = data.photoUrls[index];
    img.alt = data.captions[index];
    caption.textContent = data.captions[index];
  };

  const open = (i: number) => {
    show(i);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  };

  triggers.forEach((trigger, i) => {
    trigger.addEventListener('click', () => open(i));
  });

  lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
  lightbox.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
  lightbox.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
}

/**
 * Numbered scroll-nav dots - one ScrollTrigger per tracked section, toggling
 * the matching dot's .active class as that section becomes the current one
 * in view. Clicking a dot is a plain anchor href - Lenis's own click handler
 * (src/scripts/lenis.ts) intercepts it and animates the scroll; if that
 * script fails to load, it falls back to a plain instant jump rather than
 * native smooth-scroll, since `scroll-behavior: smooth` is intentionally
 * disabled globally to avoid fighting Lenis's own easing.
 */
export function initScrollNav() {
  const nav = document.querySelector<HTMLElement>('[data-scroll-nav]');
  if (!nav) return;

  const links = gsap.utils.toArray<HTMLAnchorElement>('[data-scroll-nav-link]', nav);
  if (!links.length) return;

  links.forEach((link) => {
    const id = link.dataset.target;
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    ScrollTrigger.create({
      trigger: target,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (self.isActive) link.classList.add('active');
        else link.classList.remove('active');
      },
    });
  });
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, iframe, video, [tabindex]:not([tabindex="-1"])';

/**
 * Portfolio video grid - click a poster tile to open a modal playing either
 * a YouTube embed or a local file, fading/scaling in with GSAP, closing on
 * backdrop click or Escape, and trapping focus while open. Closing removes
 * the player element entirely (rather than pausing) so audio/video reliably
 * stops, including for the YouTube iframe case with no postMessage API.
 */
export function initVideoLightbox() {
  const lightbox = document.querySelector<HTMLElement>('[data-video-lightbox]');
  const wrap = document.querySelector<HTMLElement>('[data-video-lightbox-wrap]');
  const closeBtn = document.querySelector<HTMLElement>('[data-video-lightbox-close]');
  const triggers = gsap.utils.toArray<HTMLElement>('[data-video-trigger]');
  if (!lightbox || !wrap || !closeBtn || !triggers.length) return;

  let lastFocused: HTMLElement | null = null;

  function buildPlayer(type: string | undefined, src: string | undefined, title: string | undefined) {
    wrap!.innerHTML = '';
    if (!src) return;
    if (type === 'youtube') {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${src}?autoplay=1&rel=0`;
      iframe.title = title ?? 'Video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      wrap!.appendChild(iframe);
    } else {
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.setAttribute('playsinline', '');
      wrap!.appendChild(video);
    }
  }

  function open(trigger: HTMLElement) {
    lastFocused = document.activeElement as HTMLElement | null;
    buildPlayer(trigger.dataset.videoType, trigger.dataset.videoSrc, trigger.dataset.videoTitle);

    lightbox!.classList.add('open');
    lightbox!.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (prefersReducedMotion) {
      gsap.set(lightbox, { opacity: 1 });
      gsap.set(wrap, { opacity: 1, scale: 1 });
    } else {
      gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.fromTo(wrap, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });
    }

    closeBtn!.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    document.removeEventListener('keydown', onKeydown);

    const finish = () => {
      wrap!.innerHTML = ''; // stops playback - iframe/video removed, not just hidden
      lightbox!.classList.remove('open');
      lightbox!.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lastFocused?.focus();
    };

    if (prefersReducedMotion) {
      finish();
    } else {
      gsap.to(wrap, { opacity: 0, scale: 0.94, duration: 0.2, ease: 'power1.in' });
      gsap.to(lightbox, { opacity: 0, duration: 0.25, ease: 'power1.in', onComplete: finish });
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(lightbox!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => open(trigger));
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
}

/**
 * Section-to-section flowing transition: each section gently dims and
 * scales down as it's scrolled past, so moving between sections reads as a
 * continuous flow rather than a hard cut. Scroll-scrubbed (tied directly to
 * scroll position, not a fixed-duration tween), so it never scroll-jacks.
 * Intro is excluded - it already has its own bespoke exit parallax
 * (initIntroParallax) covering essentially its whole visible content, so a
 * second wrapper-level effect there would just compound rather than add.
 */
export function initSectionTransitions() {
  if (prefersReducedMotion) return;

  const sections = gsap.utils.toArray<HTMLElement>('section').filter((s) => s.id !== 'intro');

  sections.forEach((section) => {
    gsap.set(section, { transformOrigin: '50% 100%' });
    gsap.to(section, {
      opacity: 0.5,
      scale: 0.96,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'bottom 88%',
        end: 'bottom 8%',
        scrub: 0.6,
      },
    });
  });
}

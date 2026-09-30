import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance: Lenis | null = null;
let rafCallback: ((time: number) => void) | null = null;

/** Exposed so other modules (e.g. the hash-fix in animations.ts) can route
 *  programmatic jumps through Lenis instead of the native scrollIntoView,
 *  avoiding the two scroll systems fighting each other on load. */
export function getLenis(): Lenis | null {
  return lenisInstance;
}

/**
 * Tears down the current Lenis instance and its gsap.ticker raf callback.
 * With Astro's client-side page transitions (ClientRouter, wired in
 * Layout.astro), initSmoothScroll() runs again on every navigation - without
 * this, each transition would leave the previous page's Lenis instance
 * still driving its own raf loop forever (an accumulating, ever-faster-
 * compounding scroll feel is exactly the kind of "jitter" a leaked Lenis
 * instance produces) instead of being replaced by a fresh one bound to the
 * new page's DOM.
 */
export function destroySmoothScroll() {
  if (rafCallback) {
    gsap.ticker.remove(rafCallback);
    rafCallback = null;
  }
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
}

/**
 * Smooth (inertia) scrolling, synced to GSAP's ticker so every existing
 * scrub-tied ScrollTrigger animation (hero parallax, section fades, the
 * pinned intro zoom) reads from an eased scroll position instead of the
 * raw, discretely-stepped native wheel/trackpad delta - this is what
 * actually removes the "choppy" feel; CSS `scroll-behavior: smooth` only
 * ever affected anchor-jump scrolling, never manual scrolling.
 *
 * Skipped entirely under prefers-reduced-motion, consistent with every
 * other animation in this codebase - inertia scrolling is exactly the kind
 * of motion that setting is meant to suppress.
 */
export function initSmoothScroll() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Defensive: a stray double-call (e.g. a transition firing before the
  // previous page's instance was torn down) must not stack two Lenis
  // instances/raf loops on top of each other.
  destroySmoothScroll();

  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  rafCallback = (time) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(rafCallback);
  // Lenis now drives the raf loop; let it own frame timing rather than GSAP's
  // own lag-smoothing compensation, per GSAP's documented Lenis integration.
  gsap.ticker.lagSmoothing(0);

  // Route in-page anchor links (nav, scroll-nav dots, CTA buttons) through
  // Lenis so they animate at the same eased rate as everything else, rather
  // than native-jumping while the rest of the page scrolls smoothly.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
    });
  });

  lenisInstance = lenis;
}

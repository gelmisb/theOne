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
/**
 * Touch-primary devices (phones, tablets) keep their own native scrolling: the
 * platform's momentum scrolling is already smooth, and re-easing it in
 * JavaScript only adds lag and a second per-frame loop. Same test the CSS uses.
 */
const isTouchPrimary = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * The `scrub` value for a scroll-linked animation. With Lenis running its easing
 * is the smoothing, so `true` ties the animation straight to it (a numeric value
 * would stack GSAP's own lag on top - see the pinned intro's comment). Without
 * Lenis (touch devices) nothing smooths the raw scroll position, which arrives
 * in coarse, slightly late steps, so give the animation a short catch-up.
 */
export const scrubValue = (): true | number => (lenisInstance ? true : 0.6);

let anchorsBound = false;

/**
 * Smooth in-page anchor jumps. ONE listener for the whole session, reading the
 * current Lenis instance when clicked: this used to attach a fresh handler to
 * every link on every page navigation, and since the header persists across
 * navigations its links collected a new handler each time (bound to an
 * already-destroyed Lenis instance).
 */
function bindAnchors() {
  if (anchorsBound) return;
  anchorsBound = true;
  // Capture phase so we run before the client router's own click handling.
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const id = link?.getAttribute('href');
      if (!link || !id || id.length < 2) return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      e.preventDefault();
      const lenis = getLenis();
      if (lenis) {
        lenis.scrollTo(target, { offset: 0 });
      } else {
        // Touch devices / reduced motion: no Lenis. Native smooth scroll unless the
        // visitor asked for less motion.
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    },
    true,
  );
}

export function initSmoothScroll() {
  bindAnchors();

  // Defensive: a stray double-call (e.g. a transition firing before the
  // previous page's instance was torn down) must not stack two Lenis
  // instances/raf loops on top of each other.
  destroySmoothScroll();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion || isTouchPrimary()) return;

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

  lenisInstance = lenis;
}

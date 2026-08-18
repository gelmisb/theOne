import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** Hero entrance timeline — plays once on load, not on scroll. */
export function initHeroTimeline() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (prefersReducedMotion) return;

  tl.fromTo('.hero-eyebrow', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 })
    .fromTo('.hero-h', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.35')
    .fromTo('.hero-sub', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.5')
    .fromTo('.hero-ctas', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.45')
    .fromTo('.vf-corner', { opacity: 0 }, { opacity: 0.35, duration: 1, stagger: 0.08 }, '-=0.6')
    .fromTo(
      '.hero-strip > div',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
      '-=0.3'
    );
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

/** Nav background solidifies once the user scrolls past the hero. */
export function initNavOnScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  ScrollTrigger.create({
    start: 'top -80',
    end: 99999,
    toggleClass: { targets: header, className: 'scrolled' },
  });
}

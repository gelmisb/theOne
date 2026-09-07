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

/** Intro reveal — plays once on load. The grid materializes, then the iris opens onto the wordmark. */
export function initIntroTimeline() {
  const intro = document.querySelector('.intro');
  if (!intro) return;

  if (prefersReducedMotion) {
    gsap.set('.intro-reveal', { clipPath: 'circle(150% at 50% 50%)' });
    return;
  }

  gsap.set('.intro-reveal', { clipPath: 'circle(0% at 50% 50%)' });

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

  tl.to('.intro-reveal', { clipPath: 'circle(140% at 50% 50%)', duration: 1.1, ease: 'power3.inOut' }, 0.6)
    .fromTo('[data-intro-el]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 1.05)
    .fromTo('.intro-word', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 1.05)
    .fromTo('.intro-scroll', { opacity: 0 }, { opacity: 0.7, duration: 0.6 }, 1.65);
}

/**
 * Pinned "fly into the photo" scroll transition, ported from GreenSock's
 * official pinned-zoom demo (codepen.io/GreenSock/pen/YzbPYMx): the intro
 * photo scales up and pushes toward the viewer via 3D perspective while the
 * section stays pinned for a fixed scroll distance, before releasing into
 * Hero. Replaces the old mosaic-lens effect, which didn't read well here.
 */
export function initIntroZoomTransition() {
  const intro = document.querySelector<HTMLElement>('.intro');
  const bg = document.querySelector<HTMLElement>('.intro-bg');
  if (!intro || !bg) return;

  if (prefersReducedMotion) return; // no pin, no zoom — plain scroll past

  gsap
    .timeline({
      scrollTrigger: {
        trigger: intro,
        start: 'top top',
        end: '+=150%',
        pin: true,
        scrub: true,
      },
    })
    .to('.intro-reveal, .intro-frame, .intro-scroll', { opacity: 0, ease: 'power1.inOut' }, 0)
    .to(bg, { scale: 2, z: 350, transformOrigin: 'center center', ease: 'power1.inOut' }, 0);
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

/** Hero entrance timeline — plays once on load, not on scroll. */
export function initHeroTimeline() {
  const heading = document.querySelector<HTMLElement>('.hero-h');
  const words = heading ? splitIntoWordSpans(heading) : [];

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

/** Buttons pull gently toward the cursor on hover — fine-pointer devices only. */
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

/** Portfolio lightbox — click a developed frame to view it full-size, arrow/keyboard navigable. */
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
 * Numbered scroll-nav dots — one ScrollTrigger per tracked section, toggling
 * the matching dot's .active class as that section becomes the current one
 * in view. Clicking a dot relies on the plain anchor href + the existing
 * global `html{scroll-behavior:smooth}` (already reduced-motion-safe) rather
 * than a bespoke scroll routine, so it still works if this script fails.
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
 * Portfolio video grid — click a poster tile to open a modal playing either
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
      wrap!.innerHTML = ''; // stops playback — iframe/video removed, not just hidden
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
 * Intro is excluded — it already has its own bespoke exit parallax
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

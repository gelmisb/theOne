import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis } from './lenis';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fixes a real bug: loading the page directly at a URL hash (e.g. /#offer)
 * makes the browser jump there natively, often before ScrollTrigger has
 * measured the pinned Intro section - if that jump lands past Intro's
 * trigger range before GSAP has anything to measure against, the pin can
 * get stuck in its pinned (position: fixed) state indefinitely, leaving
 * Intro's portal artwork rendered fixed at the top of the viewport no
 * matter how far down the page you actually are.
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

  window.addEventListener('load', () => {
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
  });
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
 * Intro reveal - plays once on load. The grid materializes, then the iris
 * opens onto the wordmark.
 *
 * The hidden starting state (clip-path, opacity, y) is set in Intro.astro's
 * CSS, not here - CSS paints hidden before this script even runs, so there's
 * no flash of the fully-visible heading followed by a JS-driven snap to
 * hidden. This function only needs to animate back *out* of that state.
 */
export function initIntroTimeline() {
  const intro = document.querySelector('.intro');
  if (!intro) return;

  if (prefersReducedMotion) {
    gsap.set('.intro-reveal', { clipPath: 'circle(150% at 50% 50%)' });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

  tl.to('.intro-reveal', { clipPath: 'circle(140% at 50% 50%)', duration: 1.1, ease: 'power3.inOut' }, 0.6)
    .fromTo('[data-intro-el]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 1.05)
    .fromTo('.intro-word', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 1.05)
    .fromTo('.intro-scroll', { opacity: 0 }, { opacity: 0.7, duration: 0.6 }, 1.65);
}

/**
 * Pinned "fly through the window" scroll transition, ported from GreenSock's
 * official pinned-zoom demo (codepen.io/GreenSock/pen/YzbPYMx): a foreground
 * "porthole" photo (a dark window opening) scales up and pushes toward the
 * viewer via CSS 3D perspective while the section stays pinned for a fixed
 * scroll distance, its opening growing to reveal the persistent site
 * background (Layout.astro's .persist-bg, fixed behind every section)
 * underneath, before releasing into Hero. Replaces the old mosaic-lens
 * effect, which didn't read well here.
 *
 * `end` is a function (not a fixed string) so the pin covers a consistent
 * 0.15 viewport-heights of scroll regardless of the visitor's screen height -
 * a fixed "+=15%" would otherwise scale off the section's own height
 * instead, behaving inconsistently on very short or very tall viewports.
 *
 * Video is desktop-only (see the matching `min-width: 641px` breakpoint on
 * both the CSS in Intro.astro and the <source media> query that stops
 * mobile from ever fetching the file) - below that, this always takes the
 * image-transform path below, even when a video element exists in the DOM,
 * since on mobile it has no loaded source to play.
 */
export function initIntroZoomTransition() {
  const intro = document.querySelector<HTMLElement>('.intro');
  if (!intro) return;

  const isDesktop = window.matchMedia('(min-width: 641px)').matches;
  const video = isDesktop ? document.querySelector<HTMLVideoElement>('[data-intro-video]') : null;
  if (video) {
    initIntroVideoZoomTransition(intro, video);
    return;
  }

  const feature = document.querySelector<HTMLElement>('[data-intro-feature]');
  if (!feature) return;

  if (prefersReducedMotion) return; // no pin, no zoom - plain scroll past

  gsap
    .timeline({
      scrollTrigger: {
        trigger: intro,
        start: 'top top',
        end: () => '+=' + window.innerHeight * 0.9,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
      },
    })
    .to('.intro-reveal, .intro-frame, .intro-scroll', { opacity: 0, ease: 'power1.inOut' }, 0)
    // scale + z (via the 500px perspective) compound multiplicatively -
    // at scale:6 / z:350 that was ~6 × (500/(500-350)) ≈ 20x total
    // magnification, far beyond what the 1456px-wide source image
    // (src/assets/photos/intro-window.png) can hold up to, hence the
    // blocky/blurred look. Dialed back to a combined ~3.4x (2 × 500/300)
    // - still a real "push toward camera" zoom, just within what this
    // source resolution can render cleanly. Raise this again if a
    // higher-resolution source image is swapped in.
    .to(feature, { scale: 2, z: 200, transformOrigin: 'center center', ease: 'power1.inOut' }, 0)
    .to(feature, { opacity: 0, ease: 'power1.in' }, 0.5);
}

/**
 * Single-clip video porthole: plays once, unlooped, the moment the page
 * loads - no `loop` attribute, so it naturally holds its last frame once
 * done. If the visitor scrolls into the pinned range (whether or not that
 * initial play has finished), scroll takes over: `currentTime` is driven
 * directly by scroll progress, same mechanism the pin/scrub setup already
 * uses. Scrolling back up past the start just pauses on the first frame -
 * this is a one-shot intro, not a loop, so it doesn't replay itself.
 * Reuses the same pin/start/end/scrub ScrollTrigger shape as the
 * image-transform version above - only what happens inside differs.
 */
function initIntroVideoZoomTransition(intro: HTMLElement, video: HTMLVideoElement) {
  if (prefersReducedMotion) return; // sits on its poster (first) frame, unplayed

  video.play().catch(() => {});

  let scrubbing = false;

  gsap
    .timeline({
      scrollTrigger: {
        trigger: intro,
        start: 'top top',
        end: () => '+=' + window.innerHeight * 0.9,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (self.progress <= 0) {
            if (!scrubbing) return;
            scrubbing = false;
            video.pause();
            video.currentTime = 0;
            return;
          }
          if (!scrubbing) {
            scrubbing = true;
            video.pause();
          }
          if (video.readyState >= 1 && video.duration) {
            video.currentTime = self.progress * video.duration;
          }
        },
      },
    })
    .to('.intro-reveal, .intro-frame, .intro-scroll', { opacity: 0, ease: 'power1.inOut' }, 0);
}

/**
 * Film roll intro (Phase 2): idle drift before scroll, then a scroll-scrubbed
 * roll that decelerates and locks the designated hero frame to centre while
 * its neighbours dim - the "picking a frame off a contact sheet" moment from
 * FILM-ROLL-INTRO-BRIEF.md's Beat 1/2. Desktop-first pass; mobile and
 * reduced-motion variants (gsap.matchMedia()) land in Phase 4. Beat 3/4
 * (develop + expand into Hero) aren't built yet, so the pin only spans
 * Beats 0-2 for now - it'll grow once Phase 3 adds the rest.
 *
 * The idle-to-scroll handoff is the one piece that has to be seamless (brief
 * Beat 1: "no jump in position or speed"). Rather than a second GSAP tween
 * with its own "from" value - which GSAP would capture at creation time, not
 * at the actual moment scrolling starts - the roll is computed by hand in a
 * single onUpdate callback, using `baseX`: .fr-track's live x position, read
 * the instant the pin engages (onEnter). That guarantees no position jump
 * regardless of where idle drift happened to be mid-oscillation.
 */
export function initFilmRollIntro() {
  const section = document.querySelector<HTMLElement>('.filmroll-intro');
  const track = document.querySelector<HTMLElement>('.fr-track');
  const heroFrame = track?.querySelector<HTMLElement>('[data-hero-frame="true"]');
  const content = document.querySelector<HTMLElement>('.fr-content');
  if (!section || !track || !heroFrame || !content) return;

  if (prefersReducedMotion) return; // Phase 1's static, flex-centred layout stands as the fallback as-is

  const otherFrames = gsap.utils.toArray<HTMLElement>('.fr-frame', track).filter((f) => f !== heroFrame);

  const ROLL_END = 0.65; // fraction of this section's pin where the roll gives way to the stop/lock
  const CONTENT_FADE_END = 0.18; // wordmark/tagline/CTA clear out early, per Beat 1
  const OVERSHOOT_PX = 220; // roll past the lock point, then ease back - reads as a reel settling, not a hard stop

  let lockX = 0;
  let rollX = 0;
  let baseX = 0;

  // offsetLeft is layout position, unaffected by the transform this same
  // element is about to receive - safe to recompute on resize.
  function measure() {
    const center = heroFrame!.offsetLeft + heroFrame!.offsetWidth / 2;
    lockX = window.innerWidth / 2 - center;
    rollX = lockX - OVERSHOOT_PX;
  }
  measure();

  // Beat 0: a slow, small back-and-forth so the strip reads as alive before
  // anyone scrolls. Paused off-screen and when the tab is hidden.
  const idleTween = gsap.to(track, {
    x: '+=22',
    duration: 5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  const idleVisibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive) idleTween.play();
      else idleTween.pause();
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) idleTween.pause();
    else if (idleVisibility.isActive) idleTween.play();
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * 1.6,
    pin: true,
    scrub: 0.4,
    invalidateOnRefresh: true,
    onRefresh: measure,
    onEnter: () => {
      idleTween.pause();
      baseX = Number(gsap.getProperty(track, 'x')) || 0;
    },
    onLeaveBack: () => idleTween.play(),
    onUpdate: (self) => {
      const p = self.progress;
      let x: number;

      if (p <= ROLL_END) {
        const t = gsap.parseEase('power2.in')(p / ROLL_END);
        x = gsap.utils.interpolate(baseX, rollX, t);
        gsap.set(content, { opacity: 1 - gsap.parseEase('power1.in')(Math.min(p / CONTENT_FADE_END, 1)) });
        gsap.set(otherFrames, { opacity: 1 });
      } else {
        const t = gsap.parseEase('power3.out')((p - ROLL_END) / (1 - ROLL_END));
        x = gsap.utils.interpolate(rollX, lockX, t);
        gsap.set(otherFrames, { opacity: 1 - t * 0.75 });
      }

      gsap.set(track, { x });
    },
  });
}

/**
 * Fades Layout.astro's persistent journey background (revealed through
 * Intro's portal, visible through Hero) out as Gap scrolls through the
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

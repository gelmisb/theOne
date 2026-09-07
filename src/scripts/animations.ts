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
 * Interactive mosaic-pixelation lens, ported from a reference CodePen (Tom
 * Miller / creativeocean, "Canvas Grid Mouse Effect"): a grid of boxes near
 * the cursor gets overdrawn with a zoomed-in crop of the source image,
 * fading out with distance — like a photo resolving into focus around the
 * cursor. The effect radius itself is driven by how far the eased cursor
 * still lags the raw one, so a quick flick opens a big reveal that settles.
 *
 * The "image" here is the same hero photo used in the section right below —
 * drawn dim and desaturated behind the real, always-crisp DOM wordmark, so
 * legibility never depends on it. It's the same photo the visitor sees in
 * full a moment later in Hero, just foggy here until the cursor resolves it.
 * GSAP-ticker driven (matching the reference), fine-pointer only, paused
 * off-screen.
 */
export function initIntroGrid() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-intro-canvas]');
  const section = document.querySelector<HTMLElement>('.intro');
  const bgImg = document.querySelector<HTMLImageElement>('[data-intro-bg]');
  if (!canvas || !section || !bgImg) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const BOX = 48;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let source: HTMLCanvasElement | null = null;
  let boxes: { x: number; y: number }[] = [];

  const m = { x: 0, y: 0, s: 1.5, x2: 0, y2: 0 };
  const xTo = gsap.quickTo(m, 'x', { duration: 1, ease: 'expo' });
  const yTo = gsap.quickTo(m, 'y', { duration: 1, ease: 'expo' });
  const sTo = gsap.quickTo(m, 's', { duration: 2, ease: 'power2' });

  function renderSource() {
    if (!bgImg!.naturalWidth) return;
    source = document.createElement('canvas');
    source.width = width * dpr;
    source.height = height * dpr;
    const sctx = source.getContext('2d');
    if (!sctx) return;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // matches Hero's own .hero-bg color treatment, dimmer since this is the "before" state
    sctx.filter = 'grayscale(0.25) sepia(0.3) hue-rotate(155deg) saturate(1.3) brightness(0.9) contrast(1.05)';

    const iw = bgImg!.naturalWidth;
    const ih = bgImg!.naturalHeight;
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    sctx.drawImage(bgImg!, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }

  function buildGrid() {
    const rect = section!.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas!.width = width * dpr;
    canvas!.height = height * dpr;
    canvas!.style.width = `${width}px`;
    canvas!.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    m.x = m.x2 = width / 2;
    m.y = m.y2 = height / 2;

    renderSource();

    boxes = [];
    for (let y = 0; y <= height; y += BOX) {
      for (let x = 0; x <= width; x += BOX) boxes.push({ x, y });
    }
  }

  function draw() {
    if (!source) return;

    const d = Math.hypot(m.x - m.x2, m.y - m.y2);
    sTo(gsap.utils.clamp(0, 1.6, (d / Math.max(width, height)) * 2));

    const radius = Math.max(width, height) * m.s;

    ctx!.clearRect(0, 0, width, height);
    ctx!.globalAlpha = 0.12;
    ctx!.drawImage(source!, 0, 0, width, height, 0, 0, width, height);

    for (const b of boxes) {
      const dist = Math.hypot(b.x - m.x, b.y - m.y);
      const s = 1 - gsap.utils.clamp(0, 1, dist / radius);
      if (s < 0.02) continue;
      const boxScaled = BOX * s;
      const srcSize = Math.max(BOX - boxScaled, 1);
      ctx!.globalAlpha = 0.12 + s * 0.45;
      ctx!.drawImage(
        source!,
        b.x + boxScaled / 2, b.y + boxScaled / 2, srcSize, srcSize,
        b.x, b.y, BOX, BOX
      );
    }

    ctx!.fillStyle = 'rgba(79, 168, 222, 1)';
    for (const b of boxes) {
      const dist = Math.hypot(b.x - m.x, b.y - m.y);
      const s = 1 - gsap.utils.clamp(0, 1, dist / radius);
      if (s < 0.05) continue;
      ctx!.globalAlpha = s * 0.5;
      ctx!.beginPath();
      ctx!.arc(b.x, b.y, BOX * 0.12 * s, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  let running = false;
  function start() {
    if (running) return;
    running = true;
    gsap.ticker.add(draw);
  }
  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(draw);
  }

  function init() {
    buildGrid();
    draw();

    if (prefersReducedMotion) {
      gsap.set(canvas!, { opacity: 0.4 });
      return;
    }

    gsap.to(canvas!, { opacity: 1, duration: 1, delay: 0.15, ease: 'power2.out' });

    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    section!.addEventListener('pointermove', (e) => {
      const rect = section!.getBoundingClientRect();
      m.x2 = e.clientX - rect.left;
      m.y2 = e.clientY - rect.top;
      xTo(m.x2);
      yTo(m.y2);
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.05 }
    );
    observer.observe(section!);

    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildGrid, 200);
    });
  }

  if (bgImg.complete && bgImg.naturalWidth) {
    init();
  } else {
    bgImg.addEventListener('load', init, { once: true });
  }
}

/** Subtle parallax fade as the intro scrolls out beneath the hero. */
export function initIntroParallax() {
  if (prefersReducedMotion) return;
  const intro = document.querySelector('.intro');
  if (!intro) return;

  gsap.to('.intro-reveal, .intro-frame, .intro-canvas', {
    yPercent: -12,
    opacity: 0.25,
    ease: 'none',
    scrollTrigger: {
      trigger: intro,
      start: 'top top',
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

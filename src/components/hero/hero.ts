// Hero animation logic. Browser only. Called from Layout.astro's shared
// `astro:page-load` handler (the one place every init lives - see the comment there)
// and torn down on `astro:before-swap`.
//
// Rules this file keeps (HERO_BUILD.md): only transform and opacity are animated, no
// ScrollTrigger and no pinning in the hero, and everything that loops (rotating word,
// slow iris spin) pauses when the hero is off-screen or the tab is hidden. Under
// prefers-reduced-motion nothing moves.
//
// One deliberate difference from "play once on load": the hero sits BELOW the film-roll
// intro on the homepage, so an intro that played at page load would be over before
// anyone scrolled here. It plays the first time the hero comes into view instead - on
// a page where the hero is the first thing you see, that is immediately.
import { gsap } from 'gsap';
// SplitText is loaded on demand inside the intro (below), not here: this file is part of
// the shared bundle every page downloads, and only the homepage ever needs it.

const WORD_HOLD = 1.7; // seconds a word stays before the next rolls in
const WORD_ROLL = 0.7;

let cleanups: Array<() => void> = [];

/** Undo everything initHero set up: listeners, observers, tweens. Safe to call twice. */
export function destroyHero() {
  const fns = cleanups;
  cleanups = [];
  fns.forEach((fn) => {
    try {
      fn();
    } catch {
      // a teardown step must never stop the others
    }
  });
}

export function initHero() {
  destroyHero();
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;

  document.addEventListener('astro:before-swap', destroyHero, { once: true });
  cleanups.push(() => document.removeEventListener('astro:before-swap', destroyHero));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const headline = root.querySelector<HTMLElement>('[data-hl]');
  const statics = gsap.utils.toArray<HTMLElement>('[data-hl-static]', root);
  const rotReveal = root.querySelector<HTMLElement>('[data-rot-reveal]');
  const track = root.querySelector<HTMLElement>('[data-rot-track]');
  const fades = gsap.utils.toArray<HTMLElement>('[data-hero-fade]', root);
  const blades = gsap.utils.toArray<HTMLElement>('[data-blade]', root);
  const aperture = root.querySelector<HTMLElement>('[data-aperture]');
  const open = Number(aperture?.dataset.open ?? 0);

  // The markup holds the words plus a copy of the first (so the loop is seamless);
  // data-count is that total, so editing the word list in Hero.astro is enough.
  const wordCount = Number(track?.dataset.count ?? 7);

  // The final state is pure CSS under this media query (Hero.astro / Aperture.astro), so
  // there is nothing to set here. Setting it again from script would stack GSAP's
  // offset on top of the CSS one (the word track ended up two positions too far).
  if (reduced) return;

  // ------------------------------------------------------------------ run / pause
  // One switch for every looping thing. Runs only while the intro is done, the hero is
  // on screen and the tab is visible.
  let introDone = false;
  let inView = false;
  let started = false;
  const pausables: Array<{ pause: () => void; resume: () => void }> = [];
  const apply = () => {
    const run = introDone && inView && !document.hidden;
    pausables.forEach((p) => (run ? p.resume() : p.pause()));
  };
  // `el` gets will-change: transform only while its loop is actually running.
  const tween = (t: gsap.core.Animation, el?: HTMLElement) => {
    t.pause();
    pausables.push({
      pause: () => {
        t.pause();
        if (el) el.style.willChange = 'auto';
      },
      resume: () => {
        if (el) el.style.willChange = 'transform';
        t.resume();
      },
    });
    return t;
  };

  // ------------------------------------------------------------------ rotating word
  if (track) {
    const tl = gsap.timeline({ repeat: -1 });
    for (let k = 1; k < wordCount; k++) {
      tl.to(track, { yPercent: -(100 / wordCount) * k, duration: WORD_ROLL, ease: 'power3.inOut' }, k === 1 ? WORD_HOLD : '+=' + WORD_HOLD);
    }
    tl.to({}, { duration: WORD_HOLD }); // hold on the copy of the first word...
    tl.set(track, { yPercent: 0 }); // ...then jump back to the real one (identical, so unseen)
    tween(tl, track);
  }

  // ----------------------------------------------------------- slow iris spin (type)
  if (aperture) {
    tween(gsap.to(aperture, { rotation: 360, duration: 90, ease: 'none', repeat: -1, force3D: true }), aperture);
  }

  // -------------------------------------------------------------------- cursor glow
  const glow = root.querySelector<HTMLElement>('[data-glow]');
  if (glow && window.matchMedia('(pointer: fine) and (min-width: 1024px)').matches) {
    const gx = gsap.quickTo(glow, 'x', { duration: 0.7, ease: 'power3.out' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.7, ease: 'power3.out' });
    let raf = 0;
    let px = 0;
    let py = 0;
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = root.getBoundingClientRect(); // one read per frame, only while the pointer moves
        gx(px - r.left);
        gy(py - r.top);
        glow.style.opacity = '1';
      });
    };
    const leave = () => {
      glow.style.opacity = '0';
    };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave, { passive: true });
    cleanups.push(() => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  // ------------------------------------------------------------------ the intro
  const intro = async () => {
    if (started) return;
    started = true;
    // Split text only once the real font is in, and fetch the SplitText plugin only now.
    const [{ SplitText }] = await Promise.all([import('gsap/SplitText'), document.fonts?.ready ?? Promise.resolve()]);
    if (!root.isConnected) return;
    gsap.registerPlugin(SplitText);

    if (headline) gsap.set(headline, { visibility: 'visible' });
    if (statics.length) {
      const split = SplitText.create(statics, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 100, stagger: 0.08, duration: 0.9, ease: 'expo.out' }),
      });
      cleanups.push(() => split.revert());
    }

    const tl = gsap.timeline({
      onComplete: () => {
        introDone = true;
        blades.forEach((b) => (b.style.willChange = 'auto'));
        apply();
      },
    });
    if (rotReveal) tl.fromTo(rotReveal, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0.08);
    if (blades.length) {
      blades.forEach((b) => (b.style.willChange = 'transform'));
      tl.to(blades, { rotation: -open, duration: 1.2, ease: 'power3.inOut', stagger: 0.04 }, 0.1);
    }
    if (fades.length) tl.fromTo(fades, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.12 }, 0.8);
    cleanups.push(() => tl.kill());
  };

  // ------------------------------------------------------- visibility + tab hidden
  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) void intro();
      apply();
    },
    { threshold: 0.2 },
  );
  io.observe(root);
  const onVisibility = () => apply();
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  });
}

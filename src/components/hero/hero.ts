// Hero animation logic. Browser only. Called from Layout.astro's shared
// `astro:page-load` handler (the one place every init lives - see the comment there)
// and torn down on `astro:before-swap`.
//
// Rules this file keeps (HERO_BUILD.md): only transform and opacity are animated, no
// ScrollTrigger and no pinning in the hero, and everything that loops (rotating word,
// slow iris spin, Ken Burns, video) pauses when the hero is off-screen or the tab is
// hidden. Under prefers-reduced-motion nothing moves and no video is loaded.
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
const STILL_HOLD = 4; // seconds per still
const STILL_FADE = 1.1;

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

const idle = (cb: () => void) => {
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb);
  else setTimeout(cb, 200);
};

export function initHero() {
  destroyHero();
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;

  document.addEventListener('astro:before-swap', destroyHero, { once: true });
  cleanups.push(() => document.removeEventListener('astro:before-swap', destroyHero));

  const mode = (root.dataset.mode ?? 'type') as 'type' | 'video' | 'stills';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

  const headline = root.querySelector<HTMLElement>('[data-hl]');
  const statics = gsap.utils.toArray<HTMLElement>('[data-hl-static]', root);
  const rotReveal = root.querySelector<HTMLElement>('[data-rot-reveal]');
  const track = root.querySelector<HTMLElement>('[data-rot-track]');
  const fades = gsap.utils.toArray<HTMLElement>('[data-hero-fade]', root);
  const blades = gsap.utils.toArray<HTMLElement>('[data-blade]', root);
  const aperture = root.querySelector<HTMLElement>('[data-aperture]');
  const open = Number(aperture?.dataset.open ?? 0);
  const video = root.querySelector<HTMLVideoElement>('[data-hero-video]');
  const stills = gsap.utils.toArray<HTMLElement>('[data-still]', root);

  // ---------------------------------------------------------------- reduced motion
  // Everything is in its final state already (CSS, under the same media query): blades
  // open, text visible, the word fixed on "business", poster only. Nothing to run.
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
    if (video && videoLoaded) {
      if (inView && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    }
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
  if (mode === 'type' && aperture) {
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

  // ---------------------------------------------------------------------- stills
  let stillTimer: gsap.core.Tween | null = null;
  if (mode === 'stills' && stills.length > 1) {
    let current = 0;
    gsap.set(stills, { opacity: 0 });
    gsap.set(stills[0], { opacity: 1 });
    const kenBurns = (i: number) => {
      const img = stills[i].querySelector('img');
      if (img) gsap.fromTo(img, { scale: 1 }, { scale: 1.06, duration: STILL_HOLD + STILL_FADE + 0.5, ease: 'none' });
    };
    const step = () => {
      const next = (current + 1) % stills.length;
      gsap.to(stills[current], { opacity: 0, duration: STILL_FADE, ease: 'power1.inOut' });
      gsap.to(stills[next], { opacity: 1, duration: STILL_FADE, ease: 'power1.inOut' });
      kenBurns(next);
      current = next;
      stillTimer = gsap.delayedCall(STILL_HOLD, step);
    };
    kenBurns(0);
    stillTimer = gsap.delayedCall(STILL_HOLD, step);
    stillTimer.pause();
    pausables.push({
      pause: () => stillTimer?.pause(),
      resume: () => stillTimer?.resume(),
    });
  }

  // ----------------------------------------------------------------------- video
  let videoLoaded = false;
  let windowLoaded = document.readyState === 'complete';
  let nearViewport = false;
  const loadVideo = () => {
    if (!video || videoLoaded || saveData) return;
    videoLoaded = true;
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    const files = desktop
      ? ([[video.dataset.desktopWebm, 'video/webm'], [video.dataset.desktopMp4, 'video/mp4']] as const)
      : ([[video.dataset.mobileWebm, 'video/webm'], [video.dataset.mobileMp4, 'video/mp4']] as const);
    for (const [src, type] of files) {
      if (!src) continue;
      const s = document.createElement('source');
      s.src = src;
      s.type = type;
      video.appendChild(s);
    }
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.load();
    void video.play().catch(() => {});
  };
  // Not before the window has loaded and the browser is idle (the poster is what the
  // page waits for), and - because the hero can sit far down the page - not until it is
  // within a screen of the viewport, so nobody downloads a video they never reach.
  const tryLoadVideo = () => {
    if (windowLoaded && nearViewport) idle(loadVideo);
  };
  if (video && !saveData) {
    if (!windowLoaded) {
      const onLoad = () => {
        windowLoaded = true;
        tryLoadVideo();
      };
      window.addEventListener('load', onLoad, { once: true });
      cleanups.push(() => window.removeEventListener('load', onLoad));
    }
    const near = new IntersectionObserver(
      ([entry]) => {
        nearViewport = entry.isIntersecting;
        tryLoadVideo();
      },
      { rootMargin: '100% 0px' },
    );
    near.observe(root);
    cleanups.push(() => near.disconnect());
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
    stillTimer?.kill();
  });
}

// The homepage intro's glass lens: a loupe of liquid glass resting on the statue photo that you
// can drag around. Where it sits it bends the photo (and the film strip, if you slide it over
// that) like a real lens - a photography object, which is why it replaced the cubes here.
//
// Only runs where the glass can actually refract (see glassSupport in liquidGlass.ts): on
// Safari, Firefox and under prefers-reduced-transparency the lens never appears and the intro is
// the plain static photo. Under prefers-reduced-motion it is still draggable but has no
// "lift" while held, no momentum and no opening nudge.
//
// DESIGN.md: glass is a floating-surface signal, never a decoration on resting content. This
// lens is exactly that - it floats above the page and answers a finger - so it fits the rule.
import { glassSupport, mountLiquidGlass } from './liquidGlass';

// Lens look, tuned for a 200px lens (the original's demo numbers); smaller lenses scale them.
const BASE_SIZE = 200;
const SCALE = 48;
const ABERRATION = 14;
const BEVEL = 37;
const FROST = 0.4;
const TINT = 0.12;

const MIN_SIZE = 132;
const MAX_SIZE = BASE_SIZE;
const SIZE_FRACTION = 0.34; // lens width as a share of the intro's width
// Where the lens first rests, as a fraction of the intro (on the statue's head).
const START_X = 0.64;
const START_Y = 0.3;
const MOMENTUM_FRICTION = 4.2; // per second; higher stops sooner
const NUDGE_AFTER_MS = 1800;

let current: { dispose: () => void } | null = null;

export function destroyLens() {
  current?.dispose();
  current = null;
}

export function initIntroLens() {
  destroyLens();
  const wrap = document.querySelector<HTMLElement>('[data-lens]');
  const glass = wrap?.querySelector<HTMLElement>('[data-lens-glass]');
  const section = wrap?.closest<HTMLElement>('.filmroll-intro');
  if (!wrap || !glass || !section) return;
  if (glassSupport() !== 'refract') return; // the plain photo stays; the lens never appears

  document.addEventListener('astro:before-swap', destroyLens, { once: true });
  current = start(wrap, glass, section);
}

function start(wrap: HTMLElement, glassEl: HTMLElement, section: HTMLElement) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Lens centre, kept as a fraction of the intro so it survives resizes and rotation.
  let fx = START_X;
  let fy = START_Y;
  let size = 0;
  let w = 0;
  let h = 0;

  const place = () => {
    const x = clamp(fx * w - size / 2, 0, Math.max(0, w - size));
    const y = clamp(fy * h - size / 2, 0, Math.max(0, h - size));
    wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    return { x, y };
  };
  const setCentre = (x: number, y: number) => {
    fx = (x + size / 2) / w;
    fy = (y + size / 2) / h;
  };
  const position = () => {
    const m = /translate3d\(([-\d.e]+)px, ([-\d.e]+)px/.exec(wrap.style.transform);
    return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
  };

  const layout = () => {
    w = section.clientWidth;
    h = section.clientHeight;
    if (!w || !h) return;
    size = Math.round(clamp(w * SIZE_FRACTION, MIN_SIZE, MAX_SIZE));
    wrap.style.width = wrap.style.height = `${size}px`;
    place();
  };

  // ---- glass. The lens is laid out (invisible) first so the glass can measure it; it fades in
  // once its first refraction map is ready, so there is never a flash of plain blur.
  const mountGlass = () => {
    const ratio = size / BASE_SIZE;
    return mountLiquidGlass(
      glassEl,
      {
        radius: size / 2,
        bevelDepth: BEVEL * ratio,
        scale: SCALE * ratio,
        aberration: ABERRATION * ratio,
        frost: FROST,
        tint: TINT,
      },
      () => {
        // next frame, so the opacity transition actually runs
        requestAnimationFrame(() => wrap.classList.add('is-on'));
        scheduleNudge();
      },
    );
  };
  layout();
  let glass = mountGlass();

  const ro = new ResizeObserver(() => {
    const before = size;
    layout();
    // The lens's radius, bevel and bend are all in px, so a resized lens needs a fresh glass.
    if (size !== before) {
      glass.dispose();
      glass = mountGlass();
    }
  });
  ro.observe(section);

  // ---- drag, with a little momentum
  let dragging = false;
  let pointerId = -1;
  let startPX = 0;
  let startPY = 0;
  let originX = 0;
  let originY = 0;
  let vx = 0;
  let vy = 0;
  let lastT = 0;
  let lastX = 0;
  let lastY = 0;
  let glide = 0;
  let nudge: Animation | null = null;
  let nudgeTimer = 0;

  const stopGlide = () => {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    stopGlide();
    cancelNudge();
    dragging = true;
    pointerId = e.pointerId;
    try {
      wrap.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-gone pointer: the window listeners below still follow it
    }
    const p = position();
    originX = p.x;
    originY = p.y;
    startPX = lastX = e.clientX;
    startPY = lastY = e.clientY;
    lastT = performance.now();
    vx = vy = 0;
    wrap.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const x = clamp(originX + (e.clientX - startPX), 0, Math.max(0, w - size));
    const y = clamp(originY + (e.clientY - startPY), 0, Math.max(0, h - size));
    wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    setCentre(x, y);
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    // smoothed velocity in px per second
    vx = vx * 0.6 + ((e.clientX - lastX) / dt) * 1000 * 0.4;
    vy = vy * 0.6 + ((e.clientY - lastY) / dt) * 1000 * 0.4;
    lastT = now;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    wrap.classList.remove('is-dragging');
    try {
      wrap.releasePointerCapture(e.pointerId);
    } catch {
      // nothing held
    }
    // A fling that was held still before release carries no momentum.
    if (performance.now() - lastT > 90 || reduceMotion.matches) return;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const decay = Math.exp(-MOMENTUM_FRICTION * dt);
      vx *= decay;
      vy *= decay;
      const p = position();
      let x = p.x + vx * dt;
      let y = p.y + vy * dt;
      // stop against the edges instead of sliding along them
      if (x <= 0 || x >= w - size) vx = 0;
      if (y <= 0 || y >= h - size) vy = 0;
      x = clamp(x, 0, Math.max(0, w - size));
      y = clamp(y, 0, Math.max(0, h - size));
      wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      setCentre(x, y);
      glide = Math.hypot(vx, vy) > 12 ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  };

  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // ---- a one-time nudge, so it is clear the lens moves
  function scheduleNudge() {
    if (reduceMotion.matches || nudgeTimer) return;
    nudgeTimer = window.setTimeout(() => {
      if (dragging) return;
      const d = Math.round(size * 0.22);
      nudge = wrap.animate(
        [{ translate: '0 0' }, { translate: `${-d}px ${Math.round(d * 0.3)}px` }, { translate: '0 0' }],
        { duration: 1500, easing: 'ease-in-out' },
      );
    }, NUDGE_AFTER_MS);
  }
  function cancelNudge() {
    window.clearTimeout(nudgeTimer);
    nudgeTimer = 1; // never schedule again once the visitor has touched it
    nudge?.cancel();
    nudge = null;
  }

  function dispose() {
    stopGlide();
    window.clearTimeout(nudgeTimer);
    nudge?.cancel();
    ro.disconnect();
    glass.dispose();
    wrap.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    wrap.classList.remove('is-on', 'is-dragging');
  }
  return { dispose };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

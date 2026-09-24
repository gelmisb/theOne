import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Mouse-reactive WebGL shader (founder-supplied sample_bg.html, adapted
 * in place - same shader, same Three.js APIs, just wired into this
 * codebase's module/init-function conventions instead of a standalone
 * <script type="module"> page) as an ambient layer over Layout.astro's
 * persist-bg photo.
 *
 * Layered, not swapped in for the photo: the whole site's identity is
 * "real on-site photography, not generic visuals" (Gap.astro pitches
 * directly against exactly the kind of templated/generic look a bare
 * animated backdrop risks reading as) - replacing the photo outright would
 * cut against that. `mix-blend-mode: screen` on the canvas (see
 * Layout.astro) lets the shader's mostly-black base + glowing highlights
 * sit over the photo without hiding it: screen blending only ever
 * brightens, so dark shader regions let the photo show through untouched
 * and only the glow itself adds atmosphere on top. Try dev3 first before
 * deciding whether this belongs on the actual site - it's a real, fairly
 * heavy per-pixel shader running continuously, which is a legitimate
 * trade-off against the site's own established "cinematic but disciplined"
 * motion budget.
 *
 * Three.js is dynamically imported inside this module's setup rather than
 * statically at top level - it's a ~600KB dependency used by nothing else
 * on the site, no reason to add it to every page's JS bundle for visitors
 * whose browser can't even run this (reduced-motion, no WebGL) or who
 * never reach the code path.
 */

let start: () => void = () => {};
let stop: () => void = () => {};
let pausedByScroll = false;
let setupPromise: Promise<void> | null = null;

async function setupOnce(canvas: HTMLCanvasElement) {
  const THREE = await import('three');

  const scene = new THREE.Scene();
  // Timer, not the older Clock (deprecated since three r183, and noisily
  // logs a console warning on every construction) - same getElapsed()-style
  // API, just needs an explicit .update() call each frame first.
  const timer = new THREE.Timer();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const mouse = new THREE.Vector2(0.5, 0.5);
  const targetMouse = new THREE.Vector2(0.5, 0.5);
  const uniforms = {
    t: { value: 0 },
    r: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    mouse: { value: new THREE.Vector2(0.5, 0.5) },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    // Unmodified from sample_bg.html - flowing glow lines + starfield +
    // noise-driven colour drift, mouse/touch-reactive via the `mouse`
    // uniform.
    fragmentShader: `
      uniform vec2 r;
      uniform float t;
      uniform vec2 mouse;
      varying vec2 vUv;
      #define PI 3.14159265359
      mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }
      float wave(vec2 p, float phase, float freq) {
        return sin(p.x * freq + phase) * 0.3 * sin(p.y * freq * 0.5 + phase * 0.7);
      }
      float glowLine(float dist, float thickness, float intensity) {
        return intensity * thickness / (abs(dist) + thickness * 0.5);
      }
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= (1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h));
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float starfield(vec2 uv, float time) {
        vec2 grid = floor(uv * 150.0);
        vec2 frac = fract(uv * 150.0) - 0.5;
        float star = hash(grid);
        if (star < 0.985) return 0.0;
        float twinkle = sin(time * 2.0 + grid.x + grid.y) * 0.5 + 0.5;
        float dist = length(frac);
        float sparkle = smoothstep(0.08, 0.0, dist) * twinkle;
        return sparkle * (star - 0.985) * 100.0;
      }
      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= r.x / r.y;
        vec2 uv0 = uv;
        vec3 col = vec3(0.0);
        float time = t * 0.4;
        float noise = (snoise(uv * 0.5 + time * 0.02) + 1.0) * 0.5;
        col += noise * vec3(0.05, 0.0, 0.1) * 0.3;
        vec2 mouse_uv = (mouse - 0.5) * 2.0;
        mouse_uv.x *= r.x / r.y;
        float mouseDist = length(uv - mouse_uv);
        uv += (mouse_uv - uv) * (0.3 / (mouseDist + 0.5));
        float mouseGlow = 0.1 / (mouseDist + 0.1);
        mouseGlow *= (sin(t * 1.5) * 0.5 + 0.5) * 0.7 + 0.3;
        col += mouseGlow * vec3(1.0, 0.8, 1.0) * 0.15;
        uv *= rot(time * 0.05);
        float waveNoise = snoise(uv * 2.0 + time * 0.2) * 0.1;
        float c1 = sin(time * 0.3 + 0.0) * 0.5 + 0.5;
        float c2 = sin(time * 0.3 + 2.0) * 0.5 + 0.5;
        float c3 = sin(time * 0.3 + 4.0) * 0.5 + 0.5;
        float y1 = uv.y - wave(uv, time * 1.5, 2.0) + waveNoise;
        float line1 = glowLine(y1, 0.03, 0.8);
        vec3 color1 = vec3(1.0, c1 * 0.5 + 0.1, c2 * 0.7 + 0.3);
        col += color1 * line1;
        float y2 = uv.y + 0.4 - wave(uv + vec2(1.0, 0.5), time * 1.2, 2.5) + waveNoise * 0.8;
        float line2 = glowLine(y2, 0.03, 0.8);
        vec3 color2 = vec3(c2 * 0.3 + 0.1, c3 * 0.7 + 0.3, 1.0);
        col += color2 * line2;
        float y3 = uv.y - 0.4 - wave(uv + vec2(-0.5, 1.0), time * 1.8, 1.8) + waveNoise * 1.2;
        float line3 = glowLine(y3, 0.03, 0.8);
        vec3 color3 = vec3(c1 * 0.7 + 0.3, c3 * 0.5 + 0.1, 1.0);
        col += color3 * line3;
        float dist = length(uv0);
        float circle = abs(sin(dist * 4.0 - time * 2.0)) * exp(-dist * 0.5);
        col += vec3(0.5, 0.7, 1.0) * circle * 0.3;
        col += starfield(uv0 * 2.0 + time * 0.01, t) * vec3(1.0, 0.9, 0.8) * 0.7;
        float centerGlow = exp(-dist * 1.0) * 0.3;
        col += centerGlow * vec3(0.4, 0.5, 0.8);
        float vignette = 1.0 - dist * 0.5;
        vignette = smoothstep(0.0, 1.0, vignette);
        col *= vignette;
        col = pow(col, vec3(0.95));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(geometry, material));

  function onPointerMove(clientX: number, clientY: number) {
    targetMouse.x = clientX / window.innerWidth;
    targetMouse.y = 1 - clientY / window.innerHeight;
  }
  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.r.value.set(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  let rafId = 0;
  let running = false;
  function renderTick(timestamp: number) {
    rafId = requestAnimationFrame(renderTick);
    timer.update(timestamp);
    uniforms.t.value = timer.getElapsed();
    mouse.lerp(targetMouse, 0.05);
    uniforms.mouse.value.copy(mouse);
    renderer.render(scene, camera);
  }
  start = () => {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(renderTick);
  };
  stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      stop();
    },
    { once: true }
  );

  start();
}

/**
 * Called from Layout.astro's shared astro:page-load handler, same as every
 * other init function in this codebase - but unlike most of them, its
 * one-time WebGL setup (setupOnce above) genuinely only runs once per
 * session (guarded via the canvas' own dataset flag, since the canvas
 * itself is transition:persist and survives every client-side navigation).
 *
 * The scroll-based pause/resume boundary below is different: it has to be
 * re-created on *every* call, not just the first, because
 * teardownForTransition (animations.ts) kills every ScrollTrigger on the
 * page - this one included - before each transition. A page with no
 * #offer-intro (anything but the homepage) simply doesn't get a pause
 * boundary at all and keeps rendering continuously, which matches how
 * persist-bg's own photo already behaves on those pages: initPersistBgFade
 * has the identical #offer-intro dependency, so the photo never fades
 * there either.
 */
export async function initAmbientBackground() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-ambient-bg]');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  if (!canvas.dataset.wired) {
    const probe = document.createElement('canvas');
    const hasWebGL = !!(probe.getContext('webgl') || probe.getContext('experimental-webgl'));
    if (!hasWebGL) return;

    canvas.dataset.wired = 'true';
    setupPromise = setupOnce(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (!pausedByScroll) start();
    });
  }

  await setupPromise;

  // Default to running on every page - only overridden below if this page
  // actually has a #offer-intro to measure against.
  pausedByScroll = false;
  if (!document.hidden) start();

  const gap = document.getElementById('offer-intro');
  if (!gap) return;

  // initPersistBgFade fades the photo continuously across this whole
  // start->end scrub range - it's only fully invisible right at the very
  // end, so the shader should keep running for onEnter/onEnterBack/
  // onLeaveBack (all still at least partially visible) and only actually
  // stop on onLeave, where the fade has just finished.
  const resume = () => {
    pausedByScroll = false;
    if (!document.hidden) start();
  };
  ScrollTrigger.create({
    trigger: gap,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: resume,
    onEnterBack: resume,
    onLeaveBack: resume,
    onLeave: () => {
      pausedByScroll = true;
      stop();
    },
    onRefresh: (self) => {
      // Sync to whatever the actual current scroll position is at creation
      // time - the callbacks above only fire on a boundary *crossing*
      // during scroll, not just because the trigger already matches that
      // state the moment it's created (e.g. landing back on the homepage
      // already scrolled past Gap, via browser back/forward).
      if (self.progress >= 1) {
        pausedByScroll = true;
        stop();
      } else {
        resume();
      }
    },
  });
}

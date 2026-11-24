// Cubes background for the homepage intro: a field of isometric cubes that ripples
// under a finger (or pointer) and drops idle ripples when left alone, with each cube
// showing its own piece of the statue photo instead of a flat colour. At rest it reads
// as the same photo as before, cut into a lattice; a ripple lifts and sinks the tiles
// and lights the crests with a soft brass glow.
//
// Based on Aceternity UI's "Background Cubes Grid" (isometric variant): the same wave
// simulation, tile maths and shading ideas, re-written as a small raw WebGL2 renderer.
// The original needs Three.js, React and Motion - about 200 KB more on a phone's first
// load for one background - so this is ~8 KB instead.
//
// How it works
// - A grid of N x N tiles in world space, seen through an orthographic camera on the
//   (1,1,1) diagonal (true isometric). One instanced draw call; per tile: its offset,
//   its current height and its glow (the last two are re-uploaded each frame).
// - Height is a 2-D wave equation (nine-point Laplacian, damping, a pull back to rest)
//   stepped at a fixed 120 Hz and blended between steps, so motion is smooth at any
//   refresh rate. A finger drags a Gaussian brush through it; idle ripples start after
//   a quiet moment. Rendering stops entirely once the surface has settled.
// - The photo is sampled in the fragment shader at each tile's REST screen position,
//   with the same "cover" cropping as the <img> it replaces. So a tile carries its
//   part of the picture with it as it rises and falls.
//
// Runs only where it should: phones/touch screens for now (CUBES_ON_DESKTOP), never
// under prefers-reduced-motion, and only while the intro is on screen. If WebGL2 is
// missing or the context is lost, the plain <img> underneath simply stays.
const CUBES_ON_DESKTOP = false;

// ----- tuning ---------------------------------------------------------------------
const SIM_HZ = 120;
const STEP = 1 / SIM_HZ;
const BRUSH_RADIUS = 1.5;
const PUSH_PER_CELL = 0.17;
// Tiles are small on a phone (~44px, the original uses 150px), so the numbers below are
// scaled up from the original's so the effect reads at the same size on screen.
const GAP = 0.07; // seam between tiles, as a fraction of a tile
const AMPLITUDE = 1.0; // wave height, in tiles
const SPEED = 13; // tiles per second
const DAMPING = 0.08; // fraction of wave energy kept per second
const IDLE_DELAY = 1.2; // seconds of stillness before idle ripples
const IDLE_EVERY = 2.2; // seconds between idle ripples
const GLOW = 0.45;
const GLOW_COLOR: [number, number, number] = [0.9, 0.77, 0.41]; // brand brass
const SHADE_LEFT = 0.72; // side faces, as a share of the top face's brightness
const SHADE_RIGHT = 0.5;
const COLUMN_DEPTH = 4; // how far each tile extends below its top
const MAX_PIXEL_RATIO = 1.5;

type M4 = Float32Array;

function lookAt(eye: number[], target: number[], up: number[]): M4 {
  const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}
function ortho(l: number, r: number, b: number, t: number, n: number, f: number): M4 {
  return new Float32Array([
    2 / (r - l), 0, 0, 0,
    0, 2 / (t - b), 0, 0,
    0, 0, -2 / (f - n), 0,
    -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1,
  ]);
}
function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a: number[]): number[] {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

const VERT = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNormal;
in vec2 aOffset;
in float aHeight;
in float aGlow;
uniform mat4 uVP;
uniform float uAmp;
out vec3 vNormal;
out float vH;
out float vGlow;
out float vDepth;
out vec2 vRest;
void main() {
  // Crests round off softly; troughs sink further than crests rise, and the two curves
  // blend smoothly through zero so tiles never change speed as they pass rest.
  float x = aHeight;
  float h = mix(x * 1.5, tanh(x), smoothstep(-0.6, 0.6, x));
  vec3 base = aPos + vec3(aOffset.x, 0.0, aOffset.y);
  vec3 p = base;
  p.y += h * uAmp;
  gl_Position = uVP * vec4(p, 1.0);
  vRest = (uVP * vec4(base, 1.0)).xy; // where this point sits when the tile is at rest
  vNormal = aNormal;
  vH = h;
  vGlow = aGlow;
  vDepth = aPos.y;
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;       // canvas size, CSS px
uniform vec2 uImg;       // photo size, px
uniform vec3 uGlowColor;
uniform float uGlow;
uniform vec2 uShade;     // left, right face brightness
in vec3 vNormal;
in float vH;
in float vGlow;
in float vDepth;
in vec2 vRest;
out vec4 outColor;
void main() {
  // Rest position on screen -> photo UV, with the same cover-and-centre crop as the <img>.
  vec2 px = vec2(vRest.x * 0.5 + 0.5, 0.5 - vRest.y * 0.5) * uRes;
  float s = max(uRes.x / uImg.x, uRes.y / uImg.y);
  vec2 disp = uImg * s;
  vec2 uv = (px - (uRes - disp) * 0.5) / disp;
  vec3 col = texture(uTex, uv).rgb;

  bool isTop = vNormal.y > 0.5;
  col *= isTop ? 1.0 : (abs(vNormal.x) > 0.5 ? uShade.y : uShade.x);
  // Sunk tops pick up shade so the trough reads; crests catch a little light.
  if (isTop) col *= 1.0 - clamp(-vH, 0.0, 1.0) * 0.45;
  col *= 1.0 + clamp(vH, 0.0, 1.0) * 0.2;

  // Glow: a soft tint on tops, strongest near the rim on the sides (like a box-shadow).
  float glow = clamp(vGlow * uGlow, 0.0, 1.0);
  float falloff = isTop ? 0.22 : exp(vDepth * 1.6) * 0.6;
  col = mix(col, uGlowColor, glow * falloff);
  outColor = vec4(col, 1.0);
}`;

// ----- one running instance ----------------------------------------------------------
let current: { dispose: () => void } | null = null;

export function destroyCubes() {
  current?.dispose();
  current = null;
}

export function initCubesBackground() {
  destroyCubes();
  const canvas = document.querySelector<HTMLCanvasElement>('[data-cubes]');
  const section = canvas?.closest<HTMLElement>('.filmroll-intro');
  const img = section?.querySelector<HTMLImageElement>('.fr-mobile-bg');
  if (!canvas || !section || !img) return;

  const touchLike = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
  if (!touchLike && !CUBES_ON_DESKTOP) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'default' });
  if (!gl) return; // no WebGL2: the plain photo stays

  document.addEventListener('astro:before-swap', destroyCubes, { once: true });
  const run = (): void => {
    current = start(gl, canvas, section, img);
  };
  if (img.complete && img.naturalWidth > 0) run();
  else img.addEventListener('load', run, { once: true });
}

function start(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, section: HTMLElement, img: HTMLImageElement) {
  // ---- program
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  };
  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link error');
  } catch {
    return { dispose() {} }; // leave the plain photo
  }
  gl.useProgram(program);
  const loc = (n: string) => gl.getAttribLocation(program, n);
  const uni = (n: string) => gl.getUniformLocation(program, n);
  const A = { pos: loc('aPos'), normal: loc('aNormal'), offset: loc('aOffset'), height: loc('aHeight'), glow: loc('aGlow') };
  const U = {
    vp: uni('uVP'), amp: uni('uAmp'), tex: uni('uTex'), res: uni('uRes'), img: uni('uImg'),
    glowColor: uni('uGlowColor'), glow: uni('uGlow'), shade: uni('uShade'),
  };

  // ---- one tile column: its three camera-facing faces (top, +x, +z), hanging below y = 0
  const hw = (1 - GAP) / 2;
  const d = COLUMN_DEPTH;
  // prettier-ignore
  const verts = new Float32Array([
    // top (normal +y)
    -hw, 0, -hw, 0, 1, 0,   hw, 0, -hw, 0, 1, 0,   hw, 0, hw, 0, 1, 0,   -hw, 0, hw, 0, 1, 0,
    // +x face
    hw, 0, -hw, 1, 0, 0,   hw, 0, hw, 1, 0, 0,   hw, -d, hw, 1, 0, 0,   hw, -d, -hw, 1, 0, 0,
    // +z face
    -hw, 0, hw, 0, 0, 1,   hw, 0, hw, 0, 0, 1,   hw, -d, hw, 0, 0, 1,   -hw, -d, hw, 0, 0, 1,
  ]);
  const idx = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 8, 11, 10]);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(A.pos);
  gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(A.normal);
  gl.vertexAttribPointer(A.normal, 3, gl.FLOAT, false, 24, 12);
  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  const offsetBuf = gl.createBuffer()!;
  const heightBuf = gl.createBuffer()!;
  const glowBuf = gl.createBuffer()!;

  // ---- photo texture
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.tex, 0);
  gl.uniform2f(U.img, img.naturalWidth, img.naturalHeight);
  gl.uniform3f(U.glowColor, GLOW_COLOR[0], GLOW_COLOR[1], GLOW_COLOR[2]);
  gl.uniform1f(U.glow, GLOW);
  gl.uniform2f(U.shade, SHADE_LEFT, SHADE_RIGHT);
  gl.uniform1f(U.amp, AMPLITUDE);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.02, 0.03, 0.045, 1); // the seams between tiles

  // ---- camera: true isometric, from the (1,1,1) diagonal
  const eye = [10, 10, 10];
  const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
  const right = [view[0], view[4], view[8]];
  const up = [view[1], view[5], view[9]];
  const forward = [-view[2], -view[6], -view[10]];

  // ---- state
  let width = 0;
  let heightPx = 0;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  let scale = 1; // px per world unit
  let cellPx = 40;
  let size = 0;
  let height = new Float32Array(0);
  let velocity = new Float32Array(0);
  let lastHeight = new Float32Array(0);
  let glowField = new Float32Array(0);
  let display = new Float32Array(0);
  let vp: M4 = new Float32Array(16);

  const c2 = Math.min((SPEED / SIM_HZ) ** 2, 0.5);
  const flowDrag = -Math.log(Math.min(Math.max(DAMPING, 1e-4), 1));
  const settleDrag = -Math.log(0.02);
  const flowPull = 0.8;
  const settlePull = 3.5;
  const SETTLE_AFTER = 0.15;
  const SETTLE_RAMP = 0.8;
  const FLAT = 0.004;

  const build = (n: number) => {
    size = n;
    height = new Float32Array(n * n);
    velocity = new Float32Array(n * n);
    lastHeight = new Float32Array(n * n);
    glowField = new Float32Array(n * n);
    display = new Float32Array(n * n);
    const offsets = new Float32Array(n * n * 2);
    const half = (n - 1) / 2;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        offsets[(i * n + j) * 2] = i - half;
        offsets[(i * n + j) * 2 + 1] = j - half;
      }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuf);
    gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(A.offset);
    gl.vertexAttribPointer(A.offset, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(A.offset, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, heightBuf);
    gl.bufferData(gl.ARRAY_BUFFER, display, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(A.height);
    gl.vertexAttribPointer(A.height, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(A.height, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, glowField, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(A.glow);
    gl.vertexAttribPointer(A.glow, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(A.glow, 1);
  };

  let awake = true;
  const resize = () => {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    width = w;
    heightPx = h;
    cellPx = w < 500 ? 44 : 60; // tile width on screen, CSS px
    canvas.width = Math.round(w * pixelRatio);
    canvas.height = Math.round(h * pixelRatio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    scale = cellPx / Math.SQRT2;
    const proj = ortho(-w / 2 / scale, w / 2 / scale, -h / 2 / scale, h / 2 / scale, -100, 100);
    vp = mul(proj, view);
    gl.uniformMatrix4fv(U.vp, false, vp);
    gl.uniform2f(U.res, w, h);
    const needed = Math.ceil(((w + h * 2) / cellPx) * 1.1) + 4;
    if (needed > size) build(needed);
    awake = true;
  };

  // screen point (CSS px, canvas space) -> grid position on the ground plane
  const toGrid = (sx: number, sy: number): { x: number; z: number } => {
    const vx = (sx - width / 2) / scale;
    const vy = -(sy - heightPx / 2) / scale;
    const t = -(eye[1] + right[1] * vx + up[1] * vy) / forward[1];
    const wx = eye[0] + right[0] * vx + up[0] * vy + forward[0] * t;
    const wz = eye[2] + right[2] * vx + up[2] * vy + forward[2] * t;
    const half = (size - 1) / 2;
    return { x: wx + half, z: wz + half };
  };

  // Smooth Gaussian push into the velocity field around a (fractional) grid position.
  const brush = (gx: number, gz: number, strength: number, radius = BRUSH_RADIUS) => {
    const reach = Math.ceil(radius * 3);
    const inv = 1 / (2 * radius * radius);
    const ci = Math.round(gx);
    const cj = Math.round(gz);
    for (let i = Math.max(1, ci - reach); i <= Math.min(size - 2, ci + reach); i++)
      for (let j = Math.max(1, cj - reach); j <= Math.min(size - 2, cj + reach); j++) {
        const dx = i - gx;
        const dz = j - gz;
        velocity[i * size + j] -= strength * Math.exp(-(dx * dx + dz * dz) * inv);
      }
    awake = true;
  };

  // ---- input: a finger (or pointer) dragging through the field
  let target: { x: number; z: number } | null = null;
  let brushAt: { x: number; z: number } | null = null;
  let idleTime = 0;
  let quietTime = 0;
  let idleTimer = IDLE_EVERY;
  let autoMode = false;
  let lastEnergy = 0;

  const aim = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) {
      target = null;
      brushAt = null;
      return;
    }
    target = toGrid(sx, sy);
    idleTime = 0;
    quietTime = 0;
    autoMode = false;
    wake();
  };
  const onTouch = (e: TouchEvent) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (t) aim(t.clientX, t.clientY);
  };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // touches come through onTouch
    aim(e.clientX, e.clientY);
  };
  const onTouchEnd = () => {
    target = null;
    brushAt = null;
  };

  const applyPointer = () => {
    if (!target) return;
    if (!brushAt) {
      brushAt = { ...target };
      return;
    }
    const dx = target.x - brushAt.x;
    const dz = target.z - brushAt.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.01) return;
    const samples = Math.ceil(distance / 0.35);
    const push = (Math.min(distance, 3) * PUSH_PER_CELL) / samples;
    for (let s = 1; s <= samples; s++) brush(brushAt.x + (dx * s) / samples, brushAt.z + (dz * s) / samples, push);
    brushAt = { ...target };
  };

  const step = () => {
    const ramp = autoMode ? 0 : Math.min(Math.max((idleTime - SETTLE_AFTER) / SETTLE_RAMP, 0), 1);
    const s = ramp * ramp * (3 - 2 * ramp);
    const keep = Math.exp(-(flowDrag + (settleDrag - flowDrag) * s) / SIM_HZ);
    const relax = Math.exp(-(flowPull + (settlePull - flowPull) * s) / SIM_HZ);
    lastHeight.set(height);
    for (let i = 1; i < size - 1; i++)
      for (let j = 1; j < size - 1; j++) {
        const k = i * size + j;
        // Nine-point Laplacian: round wavefronts, no grid-aligned checkerboard noise.
        const edges = height[k - 1] + height[k + 1] + height[k - size] + height[k + size];
        const corners = height[k - size - 1] + height[k - size + 1] + height[k + size - 1] + height[k + size + 1];
        const laplacian = (4 * edges + corners - 20 * height[k]) / 6;
        velocity[k] = (velocity[k] + c2 * laplacian) * keep;
      }
    for (let k = 0; k < height.length; k++) height[k] = (height[k] + velocity[k]) * relax;
    // Glow eases toward local wave energy: quick to light up, slow to fade.
    for (let i = 1; i < size - 1; i++)
      for (let j = 1; j < size - 1; j++) {
        const k = i * size + j;
        const energy =
          (Math.abs(height[k]) * 4 + Math.abs(height[k - 1]) + Math.abs(height[k + 1]) + Math.abs(height[k - size]) + Math.abs(height[k + size])) / 8;
        glowField[k] += (energy - glowField[k]) * (energy > glowField[k] ? 0.08 : 0.015);
      }
  };

  // ---- frame loop: runs only while the intro is on screen, the tab is visible and
  // there is something moving; otherwise it stops and costs nothing.
  let accumulator = 0;
  let raf = 0;
  let last = 0;
  let onScreen = true;
  let slowFrames = 0;
  let firstDrawn = false;

  let idleTick = 0;
  const frame = (now: number) => {
    raf = 0;
    const delta = Math.min((now - last) / 1000 || 0, 0.1);
    last = now;
    update(delta);
    if (!onScreen || document.hidden) return;
    if (awake) raf = requestAnimationFrame(frame);
    else scheduleIdle();
  };
  // Asleep (settled): no drawing, just a slow timer that waits for the next idle ripple.
  const scheduleIdle = () => {
    if (idleTick) return;
    idleTick = window.setTimeout(() => {
      idleTick = 0;
      if (!onScreen || document.hidden) return;
      update(0.25);
      if (awake) wake();
      else scheduleIdle();
    }, 250);
  };
  function wake() {
    awake = true;
    if (idleTick) {
      clearTimeout(idleTick);
      idleTick = 0;
    }
    if (!raf && onScreen && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const update = (delta: number) => {
    idleTime += delta;
    quietTime = !autoMode && idleTime > SETTLE_AFTER && lastEnergy < FLAT ? quietTime + delta : 0;
    if (!autoMode && quietTime > IDLE_DELAY) autoMode = true;
    if (autoMode) {
      idleTimer += delta;
      if (idleTimer > IDLE_EVERY) {
        idleTimer = 0;
        const spread = size * 0.12;
        brush(size / 2 + (Math.random() - 0.5) * spread * 2, size / 2 + (Math.random() - 0.5) * spread * 2, 0.3, 2.6);
      }
    }
    applyPointer();
    if (!awake) {
      lastEnergy = 0;
      return;
    }

    const t0 = performance.now();
    accumulator = Math.min(accumulator + delta, STEP * 8);
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    // Blend the last two simulation states so motion stays smooth at any refresh rate.
    const alpha = accumulator / STEP;
    let wave = 0;
    let light = 0;
    for (let k = 0; k < height.length; k++) {
      display[k] = lastHeight[k] + (height[k] - lastHeight[k]) * alpha;
      wave = Math.max(wave, Math.abs(height[k]), Math.abs(velocity[k]) * 20);
      light = Math.max(light, glowField[k]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, heightBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, display);
    gl.bindBuffer(gl.ARRAY_BUFFER, glowBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, glowField);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElementsInstanced(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0, size * size);
    lastEnergy = wave;
    if (Math.max(wave, light) < 1e-4) awake = false; // settled: stop drawing until the next push

    if (!firstDrawn) {
      firstDrawn = true;
      canvas.classList.add('is-on');
      // The canvas fades in over the photo; only once it is fully opaque is the photo
      // underneath hidden (hiding it sooner would flash the dark section background).
      const hideImg = () => {
        if (canvas.classList.contains('is-on')) img.style.visibility = 'hidden';
      };
      canvas.addEventListener('transitionend', hideImg, { once: true });
      window.setTimeout(hideImg, 900);
    }

    // Adaptive quality: if frames run long (a slow phone), drop the render resolution a step.
    const cost = performance.now() - t0;
    slowFrames = cost > 9 || delta > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 45 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      slowFrames = 0;
      resize();
    }
  };

  // ---- wiring
  const ro = new ResizeObserver(resize);
  ro.observe(section);
  const io = new IntersectionObserver(
    (entries) => {
      onScreen = entries[0]?.isIntersecting ?? true;
      if (onScreen) wake();
    },
    { threshold: 0 },
  );
  io.observe(section);
  const onVisibility = () => {
    if (!document.hidden) wake();
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    dispose(); // give the plain photo back
  };
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);

  resize();
  // Wake the field with one soft ripple so it is clear the background is alive.
  window.setTimeout(() => brush(size / 2, size / 2 - 2, 0.34, 3), 700);
  wake();

  function dispose() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (idleTick) clearTimeout(idleTick);
    idleTick = 0;
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('touchstart', onTouch);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.classList.remove('is-on');
    img.style.visibility = '';
    try {
      gl.deleteTexture(tex);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteBuffer(offsetBuf);
      gl.deleteBuffer(heightBuf);
      gl.deleteBuffer(glowBuf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // context already gone
    }
  }
  return { dispose };
}

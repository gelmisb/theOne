// Small dependency-free chart helpers for the analytics dashboard. Everything is
// built with DOM APIs and written via textContent - never innerHTML - because
// the labels (link text, page paths, referrers) originate in visitors'
// browsers and must be treated as hostile.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export const clear = (node: Element): void => node.replaceChildren();

export const fmt = {
  int: (n: number) => Math.round(n).toLocaleString('en-IE'),
  pct: (ratio: number | null, digits = 0) => (ratio === null ? '-' : `${(ratio * 100).toFixed(digits)}%`),
  dur: (sec: number | null) =>
    sec === null ? '-' : sec < 60 ? `${Math.round(sec)}s` : `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`,
  short: (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))),
  day: (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  dayLong: (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
};

function emptyNote(host: HTMLElement, text = 'No data in this range yet.'): void {
  host.append(h('p', 'dash-empty', text));
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

// ------------------------------------------------------------ line chart

export interface Series {
  name: string;
  color: string;
  values: number[];
}

/** Multi-series line chart with a hover readout. The first series gets an area fill. */
export function lineChart(host: HTMLElement, o: { labels: string[]; series: Series[]; fmtLabel?: (l: string) => string; height?: number }): void {
  clear(host);
  const n = o.labels.length;
  const all = o.series.flatMap((x) => x.values);
  if (!n || !all.some((v) => v > 0)) return emptyNote(host);

  // Draw at the container's real width so axis text stays 1:1 readable on a
  // phone instead of shrinking with a fixed 760-wide viewBox.
  const W = Math.max(260, Math.min(760, host.clientWidth || 760));
  const narrow = W < 520;
  const H = o.height ?? (narrow ? 210 : 260);
  const m = { l: narrow ? 34 : 40, r: 12, t: 14, b: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const step = niceStep(Math.max(...all, 1) / 4);
  const top = Math.max(step, Math.ceil(Math.max(...all) / step) * step);
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const label = o.fmtLabel ?? ((l: string) => l);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' });
  svg.setAttribute('aria-label', `Line chart of ${o.series.map((x) => x.name).join(', ')} over ${n} days`);

  for (let v = 0; v <= top + 1e-9; v += step) {
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'chart-grid' }));
    const t = s('text', { x: m.l - 8, y: y(v) + 4, class: 'chart-tick', 'text-anchor': 'end' });
    t.textContent = fmt.short(v);
    svg.append(t);
  }
  const every = Math.max(1, Math.ceil(n / (narrow ? 4 : 7)));
  for (let i = 0; i < n; i += every) {
    const t = s('text', { x: x(i), y: H - 8, class: 'chart-tick', 'text-anchor': 'middle' });
    t.textContent = label(o.labels[i]);
    svg.append(t);
  }

  o.series.forEach((ser, si) => {
    const pts = ser.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    if (si === 0) {
      const area = s('polygon', { points: `${x(0)},${y(0)} ${pts.join(' ')} ${x(n - 1)},${y(0)}`, class: 'chart-area' });
      area.style.fill = ser.color;
      svg.append(area);
    }
    const line = s('polyline', { points: pts.join(' '), class: 'chart-line' });
    line.style.stroke = ser.color;
    svg.append(line);
  });

  const guide = s('line', { y1: m.t, y2: m.t + ih, class: 'chart-guide' });
  guide.style.display = 'none';
  svg.append(guide);
  const dots = o.series.map((ser) => {
    const c = s('circle', { r: 4, class: 'chart-dot' });
    c.style.fill = ser.color;
    c.style.display = 'none';
    svg.append(c);
    return c;
  });

  const tip = h('div', 'chart-tip');
  tip.hidden = true;
  const catcher = s('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
  svg.append(catcher);

  const show = (e: PointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
    guide.setAttribute('x1', String(x(i)));
    guide.setAttribute('x2', String(x(i)));
    guide.style.display = '';
    dots.forEach((d, si) => {
      d.setAttribute('cx', String(x(i)));
      d.setAttribute('cy', String(y(o.series[si].values[i])));
      d.style.display = '';
    });
    tip.replaceChildren(h('strong', undefined, o.labels[i]));
    o.series.forEach((ser) => {
      const row = h('div', 'chart-tip-row');
      const sw = h('span', 'chart-swatch');
      sw.style.background = ser.color;
      row.append(sw, h('span', undefined, `${ser.name}: ${fmt.int(ser.values[i])}`));
      tip.append(row);
    });
    tip.hidden = false;
    const leftPct = (x(i) / W) * 100;
    tip.style.left = `${leftPct}%`;
    tip.style.transform = leftPct > 60 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
  };
  const hide = () => {
    guide.style.display = 'none';
    dots.forEach((d) => (d.style.display = 'none'));
    tip.hidden = true;
  };
  catcher.addEventListener('pointermove', show);
  catcher.addEventListener('pointerleave', hide);

  host.classList.add('chart-host');
  host.append(svg, tip);
}

// -------------------------------------------------------------- bar list

export interface BarRow {
  label: string;
  value: number;
  /** Small grey text under the label. */
  sub?: string;
  /** Right-hand text, defaults to the number. */
  valueText?: string;
}

/** Horizontal bars as real text rows (screen-reader friendly). */
export function barList(host: HTMLElement, rows: BarRow[], o: { color?: string; empty?: string } = {}): void {
  clear(host);
  if (!rows.length) return emptyNote(host, o.empty);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const ul = h('ul', 'bars');
  for (const r of rows) {
    const li = h('li', 'bar-row');
    const head = h('div', 'bar-head');
    const name = h('span', 'bar-label', r.label);
    name.title = r.label;
    head.append(name, h('span', 'bar-value', r.valueText ?? fmt.int(r.value)));
    const track = h('div', 'bar-track');
    const fill = h('div', 'bar-fill');
    fill.style.width = `${Math.max(2, (r.value / max) * 100)}%`;
    if (o.color) fill.style.background = o.color;
    track.append(fill);
    li.append(head, track);
    if (r.sub) li.append(h('div', 'bar-sub', r.sub));
    ul.append(li);
  }
  host.append(ul);
}

// ----------------------------------------------------------------- donut

export interface Part {
  label: string;
  value: number;
  color: string;
}

export function donut(host: HTMLElement, parts: Part[], o: { center?: string; centerSub?: string } = {}): void {
  clear(host);
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return emptyNote(host);

  const wrap = h('div', 'donut');
  const svg = s('svg', { viewBox: '0 0 42 42', class: 'donut-svg', role: 'img' });
  svg.setAttribute('aria-label', parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', '));
  svg.append(s('circle', { cx: 21, cy: 21, r: 15.9155, class: 'donut-ring' }));
  let offset = 25; // start at 12 o'clock
  for (const p of parts) {
    const pct = (p.value / total) * 100;
    const arc = s('circle', { cx: 21, cy: 21, r: 15.9155, class: 'donut-arc', 'stroke-dasharray': `${pct} ${100 - pct}`, 'stroke-dashoffset': offset });
    arc.style.stroke = p.color;
    svg.append(arc);
    offset -= pct;
  }
  if (o.center) {
    const t = s('text', { x: 21, y: o.centerSub ? 21.5 : 23, class: 'donut-center', 'text-anchor': 'middle' });
    t.textContent = o.center;
    svg.append(t);
    if (o.centerSub) {
      const t2 = s('text', { x: 21, y: 26.5, class: 'donut-sub', 'text-anchor': 'middle' });
      t2.textContent = o.centerSub;
      svg.append(t2);
    }
  }
  const legend = h('ul', 'donut-legend');
  for (const p of parts) {
    const li = h('li');
    const sw = h('span', 'chart-swatch');
    sw.style.background = p.color;
    li.append(sw, h('span', 'donut-name', p.label), h('span', 'donut-val', `${fmt.int(p.value)} · ${Math.round((p.value / total) * 100)}%`));
    legend.append(li);
  }
  wrap.append(svg, legend);
  host.append(wrap);
}

// ---------------------------------------------------------------- funnel

export interface Step {
  label: string;
  value: number;
}

/** Steps as bars scaled to the first step, with % of start and of previous step. */
export function funnel(host: HTMLElement, steps: Step[], o: { color?: string; empty?: string } = {}): void {
  clear(host);
  const base = steps[0]?.value ?? 0;
  if (!base) return emptyNote(host, o.empty);
  const ol = h('ol', 'funnel');
  steps.forEach((st, i) => {
    const li = h('li', 'funnel-row');
    const head = h('div', 'bar-head');
    head.append(h('span', 'bar-label', st.label), h('span', 'bar-value', fmt.int(st.value)));
    const track = h('div', 'bar-track');
    const fill = h('div', 'bar-fill');
    fill.style.width = `${Math.max(st.value ? 2 : 0, (st.value / base) * 100)}%`;
    if (o.color) fill.style.background = o.color;
    track.append(fill);
    const prev = steps[i - 1]?.value;
    const note = i === 0 ? 'start' : `${fmt.pct(st.value / base)} of start${prev ? ` · ${fmt.pct(st.value / prev)} of previous` : ''}`;
    li.append(head, track, h('div', 'bar-sub', note));
    ol.append(li);
  });
  host.append(ol);
}

// --------------------------------------------------------------- heatmap

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 7 x 24 grid, brass intensity by pageviews. Hours are Europe/Dublin. */
export function heatmap(host: HTMLElement, matrix: number[][]): void {
  clear(host);
  const max = Math.max(0, ...matrix.flat());
  if (!max) return emptyNote(host);
  const grid = h('div', 'heat');
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', 'Heatmap of pageviews by weekday and hour');
  grid.append(h('span'));
  for (let hr = 0; hr < 24; hr++) grid.append(h('span', 'heat-hour', hr % 3 === 0 ? String(hr) : ''));
  matrix.forEach((row, wd) => {
    grid.append(h('span', 'heat-day', WEEKDAYS[wd]));
    row.forEach((v, hr) => {
      const cell = h('span', 'heat-cell');
      const a = v ? 0.12 + 0.88 * Math.pow(v / max, 0.65) : 0;
      cell.style.background = v ? `rgba(230,196,104,${a.toFixed(3)})` : 'rgba(234,242,248,0.04)';
      cell.title = `${WEEKDAYS[wd]} ${String(hr).padStart(2, '0')}:00 - ${fmt.int(v)} pageviews`;
      grid.append(cell);
    });
  });
  host.append(grid);
}

// --------------------------------------------------------- stacked ratio

/** One stacked horizontal bar, e.g. good / needs improvement / poor. */
export function stacked(host: HTMLElement, parts: Part[]): void {
  clear(host);
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return emptyNote(host, 'No samples yet.');
  const bar = h('div', 'stack');
  const legend = h('ul', 'stack-legend');
  for (const p of parts) {
    const seg = h('div', 'stack-seg');
    seg.style.width = `${(p.value / total) * 100}%`;
    seg.style.background = p.color;
    seg.title = `${p.label}: ${Math.round((p.value / total) * 100)}%`;
    bar.append(seg);
    const li = h('li');
    const sw = h('span', 'chart-swatch');
    sw.style.background = p.color;
    li.append(sw, h('span', undefined, `${p.label} ${Math.round((p.value / total) * 100)}%`));
    legend.append(li);
  }
  host.append(bar, legend);
}

// ----------------------------------------------------------------- table

/** Plain table; cell text via textContent. `numeric` marks right-aligned columns. */
export function table(host: HTMLElement, headers: string[], rows: (string | number)[][], o: { numeric?: number[]; empty?: string } = {}): void {
  clear(host);
  if (!rows.length) return emptyNote(host, o.empty);
  const t = h('table', 'dash-table');
  const thead = h('thead');
  const hr = h('tr');
  headers.forEach((label, i) => {
    const th = h('th', o.numeric?.includes(i) ? 'num' : undefined, label);
    th.scope = 'col';
    hr.append(th);
  });
  thead.append(hr);
  const tbody = h('tbody');
  for (const row of rows) {
    const tr = h('tr');
    row.forEach((cell, i) => tr.append(h('td', o.numeric?.includes(i) ? 'num' : undefined, typeof cell === 'number' ? fmt.int(cell) : cell)));
    tbody.append(tr);
  }
  t.append(thead, tbody);
  const scroller = h('div', 'table-scroll');
  scroller.append(t);
  host.append(scroller);
}

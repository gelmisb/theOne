import { generateDemoReport } from '../lib/analytics/demo';
import type { ClickKind, Report } from '../lib/analytics/types';
import { homeFrames } from '../data/homeFrames';
import { IGNORE_KEY } from './consent';
import { barList, clear, donut, fmt, funnel, h, heatmap, lineChart, stacked, table, type Series } from './charts';

// Client logic for /analytics/. Data comes from /api/stats (a Netlify function
// locked behind ANALYTICS_TOKEN) or, in "sample data" mode, from the invented
// traffic in lib/analytics/demo.ts. All text goes through charts.ts, which only
// ever uses textContent.

const TOKEN_KEY = 'hv-dash-token';
const DEV = import.meta.env.DEV;

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

const KIND_LABEL: Record<ClickKind, string> = {
  out: 'Outbound link',
  mail: 'Email',
  tel: 'Phone',
  nav: 'Internal link',
  btn: 'Button',
  photo: 'Photo opened',
  video: 'Video played',
  social: 'Social link',
};

const SECTION_LABELS: Record<string, string> = {
  intro: 'Film strip intro',
  hero: 'Hero',
  ...Object.fromEntries(homeFrames.map((f) => [f.id, f.label])),
};
const SECTION_ORDER = ['intro', 'hero', ...homeFrames.map((f) => f.id)];
const prettySection = (id: string) => SECTION_LABELS[id] ?? id.replace(/[-_]+/g, ' ');

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
function countryName(code: string): string {
  if (code === '??') return 'Unknown';
  if (code === '(other)') return 'Other';
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code; // Intl throws on a malformed code; show it as-is rather than abort the render
  }
}

class AuthError extends Error {}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-dash]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const gate = $('dash-gate');
  const app = $('dash-app');
  const status = $('dash-status');
  const gateForm = $<HTMLFormElement>('gate-form');
  const gateInput = $<HTMLInputElement>('gate-token');
  const gateError = $('gate-error');

  let days = 30;
  let demo = DEV && new URLSearchParams(location.search).has('demo');
  let report: Report | null = null;
  const activeSeries = new Set(['visitors', 'pageviews']);

  // ------------------------------------------------------------ loading

  async function fetchReport(): Promise<Report> {
    const token = sessionStorage.getItem(TOKEN_KEY) ?? '';
    const res = await fetch(`/api/stats?days=${days}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (res.status === 401) throw new AuthError('That token is not right.');
    if (res.status === 503) throw new Error('The server has no ANALYTICS_TOKEN yet. Add it in Netlify (Site configuration, Environment variables) and redeploy.');
    if (res.status === 404) throw new Error('The stats function was not found. It only exists on Netlify - locally, open this page with ?demo=1.');
    if (!res.ok) throw new Error(`The stats request failed (${res.status}).`);
    return res.json();
  }

  function showGate(message = ''): void {
    app.hidden = true;
    gate.hidden = false;
    gateError.textContent = message;
    gateError.hidden = !message;
    gateInput.focus();
  }

  async function load(): Promise<void> {
    status.textContent = 'Loading...';
    try {
      report = demo ? generateDemoReport(days) : await fetchReport();
      gate.hidden = true;
      app.hidden = false;
      render(report);
    } catch (err) {
      if (err instanceof AuthError) {
        sessionStorage.removeItem(TOKEN_KEY);
        showGate(err.message);
      } else if (app.hidden) {
        showGate((err as Error).message);
      } else {
        status.textContent = (err as Error).message;
      }
    }
  }

  // ----------------------------------------------------------- rendering

  function render(r: Report): void {
    const when = new Date(r.meta.generatedAt).toLocaleString('en-IE', { timeZone: 'Europe/Dublin', dateStyle: 'medium', timeStyle: 'short' });
    status.textContent = r.meta.demo
      ? `SAMPLE DATA - invented traffic, not real visitors. ${r.meta.days} days to ${fmt.dayLong(r.meta.to)}.`
      : `Live data. ${r.meta.days} days to ${fmt.dayLong(r.meta.to)} · updated ${when} (Dublin time)`;
    app.classList.toggle('is-demo', r.meta.demo);
    $('demo-banner').hidden = !r.meta.demo;
    $<HTMLButtonElement>('toggle-demo').setAttribute('aria-pressed', String(r.meta.demo));
    document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.range) === days)));

    renderKpis(r);
    renderTraffic(r);
    renderSources(r);
    renderPages(r);
    renderClicks(r);
    renderJourney(r);
    renderAudience(r);
    renderWhen(r);
    renderVitals(r);
    renderCustom(r);
  }

  function renderKpis(r: Report): void {
    const t = r.totals;
    const news = r.forms.find((f) => f.form === 'newsletter-form');
    const tiles: [string, string, string][] = [
      ['Visitors', fmt.int(t.visitors), `${fmt.pct(t.visitors ? t.returningVisitors / t.visitors : null)} returning · counted per day`],
      ['Sessions', fmt.int(t.sessions), t.pagesPerSession === null ? '' : `${t.pagesPerSession.toFixed(1)} pages per session`],
      ['Pageviews', fmt.int(t.pageviews), `${fmt.int(r.daily.length ? t.pageviews / r.daily.length : 0)} a day`],
      ['Time on page', fmt.dur(t.avgEngagedSec), 'average, tab visible'],
      ['Bounce rate', fmt.pct(t.bounceRate), 'one page, no click, under 10s'],
      ['Clicks', fmt.int(t.clicks), t.sessions ? `${(t.clicks / t.sessions).toFixed(2)} per session` : ''],
      ['Enquiries', fmt.int(t.enquiries), t.enquiriesPer100Visitors === null ? '' : `${t.enquiriesPer100Visitors.toFixed(1)} per 100 visitors${t.enquiryErrors ? ` · ${t.enquiryErrors} failed` : ''}`],
      ['Newsletter sign-ups', fmt.int(news?.ok ?? 0), `${fmt.int(news?.start ?? 0)} started`],
    ];
    const host = $('kpis');
    clear(host);
    for (const [label, value, sub] of tiles) {
      const tile = h('div', 'kpi');
      tile.append(h('div', 'kpi-label', label), h('div', 'kpi-value', value), h('div', 'kpi-sub', sub));
      host.append(tile);
    }
  }

  function renderTraffic(r: Report): void {
    const all: [string, string, string, (d: Report['daily'][number]) => number][] = [
      ['visitors', 'Visitors', COLORS[0], (d) => d.visitors],
      ['pageviews', 'Pageviews', COLORS[1], (d) => d.pageviews],
      ['sessions', 'Sessions', COLORS[2], (d) => d.sessions],
      ['clicks', 'Clicks', COLORS[3], (d) => d.clicks],
      ['enquiries', 'Enquiries', COLORS[4], (d) => d.enquiries],
    ];
    const chips = $('traffic-chips');
    clear(chips);
    for (const [key, name, color] of all) {
      const b = h('button', 'chip', name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(activeSeries.has(key)));
      const sw = h('span', 'chart-swatch');
      sw.style.background = color;
      b.prepend(sw);
      b.addEventListener('click', () => {
        if (activeSeries.has(key) && activeSeries.size > 1) activeSeries.delete(key);
        else activeSeries.add(key);
        renderTraffic(r);
      });
      chips.append(b);
    }
    const series: Series[] = all
      .filter(([key]) => activeSeries.has(key))
      .map(([, name, color, get]) => ({ name, color, values: r.daily.map(get) }));
    lineChart($('chart-traffic'), { labels: r.daily.map((d) => d.date), series, fmtLabel: fmt.day });
  }

  function renderSources(r: Report): void {
    donut($('chart-channels'), r.channels.map((c, i) => ({ label: c.name, value: c.n, color: COLORS[i % COLORS.length] })), {
      center: fmt.int(r.channels.reduce((a, c) => a + c.n, 0)),
      centerSub: 'sessions',
    });
    barList($('list-referrers'), r.referrers.map((x) => ({ label: x.name, value: x.n })), { empty: 'No referring sites yet - mostly direct visits.' });
    table($('table-campaigns'), ['Source / medium / campaign', 'Sessions'], r.campaigns.map((c) => [c.name, c.n]), {
      numeric: [1],
      empty: 'No tagged campaign links yet. Add ?utm_source=...&utm_medium=...&utm_campaign=... to a link to see it here.',
    });
  }

  function renderPages(r: Report): void {
    table(
      $('table-pages'),
      ['Page', 'Views', 'Entries', 'Time', 'Scroll'],
      r.pages.map((p) => [p.path, p.views, p.entries, fmt.dur(p.avgSec), p.avgScroll === null ? '-' : `${Math.round(p.avgScroll)}%`]),
      { numeric: [1, 2, 3, 4] },
    );
    barList($('list-entries'), r.entries.map((p) => ({ label: p.path, value: p.entries })), { color: 'var(--c2)' });
  }

  function renderClicks(r: Report): void {
    barList($('list-click-kinds'), r.clickKinds.map((k) => ({ label: KIND_LABEL[k.name as ClickKind] ?? k.name, value: k.n })), { color: 'var(--c3)' });
    table(
      $('table-clicks'),
      ['Link or button', 'Type', 'Goes to', 'Where', 'Clicks'],
      r.clicks.map((c) => [c.label, KIND_LABEL[c.kind] ?? c.kind, c.dest || '-', c.section ? prettySection(c.section) : '-', c.n]),
      { numeric: [4], empty: 'No clicks recorded yet.' },
    );
  }

  function renderJourney(r: Report): void {
    const select = $<HTMLSelectElement>('sec-path');
    const paths = Object.keys(r.sections);
    const keep = paths.includes(select.value) ? select.value : paths.includes('/') ? '/' : (paths[0] ?? '');
    clear(select);
    for (const p of paths) {
      const o = h('option', undefined, `${p} (${fmt.int(r.sections[p].views)} views)`);
      o.value = p;
      select.append(o);
    }
    select.value = keep;
    const draw = () => {
      const data = r.sections[select.value];
      if (!data) return funnel($('funnel-sections'), []);
      const counts = new Map(data.rows.map((x) => [x.id, x.n]));
      const ids = select.value === '/' ? SECTION_ORDER : data.rows.map((x) => x.id);
      funnel($('funnel-sections'), [
        { label: 'Opened the page', value: data.views },
        ...ids.map((id) => ({ label: prettySection(id), value: counts.get(id) ?? 0 })),
      ]);
    };
    select.onchange = draw;
    draw();

    const pageViews = (path: string) => r.pages.find((p) => p.path === path)?.views ?? 0;
    const enq = r.forms.find((f) => f.form === 'enquiry-form');
    const news = r.forms.find((f) => f.form === 'newsletter-form');
    funnel($('funnel-enquiry'), [
      { label: 'Viewed the contact page', value: pageViews('/contact/') },
      { label: 'Started the form', value: enq?.start ?? 0 },
      { label: 'Sent an enquiry', value: enq?.ok ?? 0 },
    ], { color: 'var(--c4)', empty: 'No contact page views yet.' });
    $('enquiry-note').textContent = enq?.err ? `${enq.err} submission${enq.err === 1 ? '' : 's'} failed with an error.` : 'No failed submissions.';
    funnel($('funnel-newsletter'), [
      { label: 'Reached the sign-up', value: r.sections['/']?.rows.find((x) => x.id === 'updates')?.n ?? 0 },
      { label: 'Started', value: news?.start ?? 0 },
      { label: 'Subscribed', value: news?.ok ?? 0 },
    ], { color: 'var(--c5)', empty: 'Nobody has reached the sign-up yet.' });
  }

  function renderAudience(r: Report): void {
    barList($('list-countries'), r.countries.map((x) => ({ label: countryName(x.name), value: x.n })), { color: 'var(--c2)' });
    donut($('chart-devices'), r.devices.map((d, i) => ({ label: d.name, value: d.n, color: COLORS[i % COLORS.length] })));
    barList($('list-browsers'), r.browsers.map((x) => ({ label: x.name, value: x.n })));
    barList($('list-oses'), r.oses.map((x) => ({ label: x.name, value: x.n })));
    barList($('list-viewports'), r.viewports.map((x) => ({ label: x.name, value: x.n })));
    barList($('list-languages'), r.languages.map((x) => ({ label: x.name.toUpperCase(), value: x.n })));
  }

  function renderWhen(r: Report): void {
    heatmap($('chart-heatmap'), r.heatmap);
  }

  function renderVitals(r: Report): void {
    const meta: [keyof Report['vitals'], string, (v: number) => string][] = [
      ['lcp', 'Loading (LCP)', (v) => `${(v / 1000).toFixed(2)} s average`],
      ['cls', 'Layout stability (CLS)', (v) => `${v.toFixed(3)} average`],
      ['inp', 'Responsiveness (INP)', (v) => `${Math.round(v)} ms average`],
    ];
    const host = $('vitals');
    clear(host);
    for (const [key, title, show] of meta) {
      const v = r.vitals[key];
      const block = h('div', 'vital');
      block.append(h('div', 'vital-head', title), h('div', 'vital-avg', v.avg === null ? 'No samples yet' : show(v.avg)));
      const bar = h('div');
      stacked(bar, [
        { label: 'Good', value: v.good, color: 'var(--good)' },
        { label: 'Needs work', value: v.ni, color: 'var(--warn)' },
        { label: 'Poor', value: v.poor, color: 'var(--bad)' },
      ]);
      block.append(bar);
      host.append(block);
    }
  }

  function renderCustom(r: Report): void {
    const panel = $('panel-custom');
    panel.hidden = !r.custom.length;
    table($('table-custom'), ['Event', 'Label', 'Count'], r.custom.map((c) => [c.name, c.label || '-', c.n]), { numeric: [2] });
  }

  // --------------------------------------------------------------- wiring

  gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const token = gateInput.value.trim();
    if (!token) return;
    sessionStorage.setItem(TOKEN_KEY, token);
    gateInput.value = '';
    demo = false;
    void load();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((b) =>
    b.addEventListener('click', () => {
      days = Number(b.dataset.range);
      void load();
    }),
  );
  // The line chart is drawn at its container's width, so redraw it when that changes.
  let resizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (report && !app.hidden) renderTraffic(report);
    }, 150);
  });

  $('refresh').addEventListener('click', () => void load());
  $('toggle-demo').addEventListener('click', () => {
    demo = !demo;
    void load();
  });
  $('sign-out').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    demo = false;
    showGate('');
  });
  $('export-csv').addEventListener('click', () => {
    if (!report) return;
    const rows = [['date', 'visitors', 'sessions', 'pageviews', 'clicks', 'enquiries'], ...report.daily.map((d) => [d.date, d.visitors, d.sessions, d.pageviews, d.clicks, d.enquiries])];
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
    const a = h('a');
    a.href = URL.createObjectURL(blob);
    a.download = `horizon-vantage-daily-${report.meta.to}${report.meta.demo ? '-SAMPLE' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const ignore = $<HTMLInputElement>('ignore-me');
  ignore.checked = localStorage.getItem(IGNORE_KEY) === '1';
  ignore.addEventListener('change', () => {
    if (ignore.checked) localStorage.setItem(IGNORE_KEY, '1');
    else localStorage.removeItem(IGNORE_KEY);
  });

  // Sample data is dev-only on the gate screen: a public page should never show
  // invented numbers. After unlocking it is a plain toggle in the header.
  $('gate-demo').hidden = !DEV;
  $('gate-demo').addEventListener('click', () => {
    demo = true;
    void load();
  });

  if (demo || sessionStorage.getItem(TOKEN_KEY)) void load();
  else showGate('');
}

init();
document.addEventListener('astro:page-load', init);

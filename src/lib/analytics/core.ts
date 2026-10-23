import {
  CLICK_KINDS,
  FORM_ACTIONS,
  type Batch,
  type ClickKind,
  type Ev,
  type FormAction,
  type PageStat,
  type RawRecord,
  type Rollup,
  type VitalStat,
} from './types';

// Browser-safe: Intl and plain JS only, no Node imports (the dashboard bundles
// this too, for its sample-data mode).

/** Raw per-batch records are deleted after this many days; the aggregated
 *  daily Rollups (no visitor IDs) are kept. Stated on /privacy/ - change both. */
export const RAW_RETENTION_DAYS = 30;
export const MAX_EVENTS_PER_BATCH = 25;
export const MAX_BODY_BYTES = 12_000;
/** Distinct keys allowed per counter map, so a flood of junk labels can't
 *  bloat a Rollup. Overflow lands in OTHER. */
export const MAP_CAP = 150;
export const OTHER = '(other)';
export const TZ = 'Europe/Dublin';

// ---------------------------------------------------------------- dates

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

/** Europe/Dublin calendar date (YYYY-MM-DD) for a timestamp. Every "day" in
 *  this system is a Dublin day, so the numbers match the owner's clock. */
export const dublinDay = (ts: number): string => dayFmt.format(ts);
export const dublinHour = (ts: number): number => Number(hourFmt.format(ts)) % 24;

/** Calendar arithmetic on YYYY-MM-DD strings, done in UTC so DST can't skew it. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The `days` dates ending at `to`, oldest first. */
export const dayRange = (to: string, days: number): string[] =>
  Array.from({ length: days }, (_, i) => addDays(to, i - days + 1));

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(day: string): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

// ----------------------------------------------------------- sanitising
// Everything arriving at /api/collect is attacker-controllable. Strings are
// stripped of control characters and length-capped here; the dashboard also
// renders every label with textContent, never innerHTML.

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/gu; // control characters and the Unicode line/paragraph separators

export function cleanStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Path only: query string and hash dropped, odd characters removed. '' = invalid. */
export function cleanPath(v: unknown): string {
  if (typeof v !== 'string') return '';
  const p = v.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return '';
  return p.replace(/[^A-Za-z0-9/_\-.~%]/g, '').replace(/\/{2,}/g, '/').slice(0, 120) || '/';
}

export function cleanHost(v: unknown): string {
  const h = cleanStr(v, 80).toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h) ? h : '';
}

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SECTION_RE = /^[A-Za-z0-9_-]{1,40}$/;

function sanitiseEvent(e: unknown): Ev | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const p = cleanPath(o.p);
  if (!p) return null;

  switch (o.t) {
    case 'pv': {
      const ev: Ev = { t: 'pv', p };
      const r = cleanHost(o.r);
      if (r) ev.r = r;
      for (const [src, dst] of [['us', 'us'], ['um', 'um'], ['uc', 'uc']] as const) {
        const s = cleanStr(o[src], 60).toLowerCase();
        if (s) ev[dst] = s;
      }
      const w = num(o.w, 0, 10_000);
      if (w !== undefined) ev.w = Math.round(w);
      const l = cleanStr(o.l, 12).toLowerCase().split('-')[0];
      if (l) ev.l = l;
      if (o.n === 1) ev.n = 1;
      return ev;
    }
    case 'leave': {
      const ev: Ev = { t: 'leave', p };
      const e1 = num(o.e, 0, 3_600_000);
      if (e1 !== undefined) ev.e = Math.round(e1);
      const s = num(o.s, 0, 100);
      if (s !== undefined) ev.s = Math.round(s);
      const lcp = num(o.lcp, 0, 60_000);
      if (lcp !== undefined) ev.lcp = Math.round(lcp);
      const cls = num(o.cls, 0, 10);
      if (cls !== undefined) ev.cls = Math.round(cls * 1000) / 1000;
      const inp = num(o.inp, 0, 60_000);
      if (inp !== undefined) ev.inp = Math.round(inp);
      return ev;
    }
    case 'click': {
      if (!CLICK_KINDS.includes(o.k as ClickKind)) return null;
      const l = cleanStr(o.l, 60);
      if (!l) return null;
      const ev: Ev = { t: 'click', p, k: o.k as ClickKind, l };
      const d = cleanStr(o.d, 100);
      if (d) ev.d = d;
      const sec = cleanStr(o.sec, 40);
      if (sec && SECTION_RE.test(sec)) ev.sec = sec;
      return ev;
    }
    case 'sec': {
      const id = cleanStr(o.id, 40);
      return SECTION_RE.test(id) ? { t: 'sec', p, id } : null;
    }
    case 'form': {
      const f = cleanStr(o.f, 40);
      if (!f || !FORM_ACTIONS.includes(o.a as FormAction)) return null;
      return { t: 'form', p, f, a: o.a as FormAction };
    }
    case 'evt': {
      const n = cleanStr(o.n, 40);
      if (!n) return null;
      const ev: Ev = { t: 'evt', p, n };
      const l = cleanStr(o.l, 60);
      if (l) ev.l = l;
      return ev;
    }
    default:
      return null;
  }
}

/** Validate an untrusted POST body. Returns null if nothing usable is in it. */
export function sanitiseBatch(raw: unknown): Batch | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || typeof o.vid !== 'string' || typeof o.sid !== 'string') return null;
  if (!ID_RE.test(o.vid) || !ID_RE.test(o.sid)) return null;
  if (!Array.isArray(o.events)) return null;
  const events = o.events
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map(sanitiseEvent)
    .filter((e): e is Ev => e !== null);
  if (!events.length) return null;
  return { v: 1, vid: o.vid, sid: o.sid, ret: o.ret === 1 ? 1 : 0, events };
}

// ------------------------------------------------------- classification

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|facebookexternalhit|preview|monitor|uptime|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\//i;

/** Crawlers, previewers and scripts - dropped at the door so they can't inflate counts. */
export const isBot = (ua: string): boolean => !ua || BOT_RE.test(ua);

/** Coarse buckets only. The raw user-agent string is never stored. */
export function classifyUA(ua: string): { device: string; browser: string; os: string } {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux|X11/.test(ua)
              ? 'Linux'
              : 'Other';
  const tablet = /iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod/.test(ua);
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox|FxiOS/.test(ua)
          ? 'Firefox'
          : /CriOS|Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Other';
  return { device: tablet ? 'Tablet' : mobile ? 'Mobile' : 'Desktop', browser, os };
}

const SEARCH_RE =
  /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com|startpage\.com|qwant\.com|yandex\.[a-z.]+|baidu\.com)$/;
const SOCIAL_RE =
  /(^|\.)(facebook\.com|fb\.me|instagram\.com|linkedin\.com|lnkd\.in|twitter\.com|x\.com|t\.co|tiktok\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|reddit\.com|threads\.net|whatsapp\.com|snapchat\.com)$/;

/** Bucket a session's source into a marketing channel. */
export function classifyChannel(refHost: string, medium: string, source: string): string {
  if (/^(email|e-mail|newsletter)$/.test(medium)) return 'Email';
  if (/^(cpc|ppc|paid|paidsearch|display|ads?)$/.test(medium)) return 'Paid';
  if (medium === 'social' || (medium === '' && SOCIAL_RE.test(source))) return 'Social';
  if (!refHost) return source || medium ? 'Campaign' : 'Direct';
  if (SEARCH_RE.test(refHost)) return 'Organic Search';
  if (SOCIAL_RE.test(refHost)) return 'Social';
  return 'Referral';
}

export function viewportBucket(w: number): string {
  return w < 480 ? 'Under 480' : w < 768 ? '480-767' : w < 1024 ? '768-1023' : w < 1440 ? '1024-1439' : '1440 and up';
}

// -------------------------------------------------------------- rollup

/** Increment a counter map, spilling new keys into OTHER once it is full. */
export function bump(map: Record<string, number>, rawKey: string, by = 1, cap = MAP_CAP): void {
  let key = rawKey === '__proto__' ? OTHER : rawKey;
  if (!Object.hasOwn(map, key) && Object.keys(map).length >= cap) key = OTHER;
  map[key] = (map[key] ?? 0) + by;
}

function getPage(pages: Record<string, PageStat>, path: string): PageStat {
  let key = path === '__proto__' ? OTHER : path;
  if (!Object.hasOwn(pages, key) && Object.keys(pages).length >= MAP_CAP) key = OTHER;
  if (!Object.hasOwn(pages, key)) pages[key] = { views: 0, entries: 0, engagedMs: 0, scrollSum: 0, scrollN: 0 };
  return pages[key];
}

const vital = (): VitalStat => ({ good: 0, ni: 0, poor: 0, sum: 0, n: 0 });

export function emptyRollup(date: string): Rollup {
  return {
    v: 1,
    date,
    builtAt: 0,
    visitors: 0,
    sessions: 0,
    pageviews: 0,
    newVisitors: 0,
    returningVisitors: 0,
    bouncedSessions: 0,
    engagedMs: 0,
    clicks: 0,
    formStarts: 0,
    formOk: 0,
    formErr: 0,
    pages: {},
    referrers: {},
    channels: {},
    campaigns: {},
    clickMap: {},
    sections: {},
    forms: {},
    custom: {},
    countries: {},
    devices: {},
    browsers: {},
    oses: {},
    languages: {},
    viewports: {},
    hours: Array.from({ length: 24 }, () => 0),
    vitals: { lcp: vital(), cls: vital(), inp: vital() },
  };
}

function tally(s: VitalStat, value: number | undefined, good: number, poor: number): void {
  if (value === undefined) return;
  s.n++;
  s.sum += value;
  if (value <= good) s.good++;
  else if (value <= poor) s.ni++;
  else s.poor++;
}

/** A single-page session with no clicks/forms and under 10s engaged. */
const BOUNCE_MS = 10_000;

/**
 * Fold one Dublin day of raw records into a Rollup. Pure and deterministic, so
 * rebuilding a day always gives the same answer (the stats function relies on
 * that when it caches past days).
 */
export function buildRollup(date: string, records: RawRecord[], now = Date.now()): Rollup {
  const r = emptyRollup(date);
  r.builtAt = now;

  interface Sess {
    pv: number;
    interact: boolean;
    engaged: number;
  }
  const sessions = new Map<string, Sess>();
  const visitors = new Map<string, boolean>(); // vid -> seen as returning

  for (const rec of [...records].sort((a, b) => a.ts - b.ts)) {
    let s = sessions.get(rec.sid);
    if (!s) {
      s = { pv: 0, interact: false, engaged: 0 };
      sessions.set(rec.sid, s);
    }
    for (const e of rec.events) {
      switch (e.t) {
        case 'pv': {
          r.pageviews++;
          r.hours[dublinHour(rec.ts)]++;
          const page = getPage(r.pages, e.p);
          page.views++;
          if (s.pv === 0) {
            // Session-level attributes come from its first pageview of the day.
            page.entries++;
            bump(r.channels, classifyChannel(e.r ?? '', e.um ?? '', e.us ?? ''));
            if (e.r) bump(r.referrers, e.r);
            if (e.us || e.um || e.uc) bump(r.campaigns, `${e.us || '(none)'} / ${e.um || '(none)'} / ${e.uc || '(none)'}`);
            bump(r.countries, rec.cc || '??');
            bump(r.devices, rec.dev);
            bump(r.browsers, rec.br);
            bump(r.oses, rec.os);
            if (e.l) bump(r.languages, e.l);
            if (e.w !== undefined) bump(r.viewports, viewportBucket(e.w));
          }
          s.pv++;
          visitors.set(rec.vid, (visitors.get(rec.vid) ?? false) || rec.ret === 1);
          break;
        }
        case 'leave': {
          const page = getPage(r.pages, e.p);
          if (e.e !== undefined) {
            page.engagedMs += e.e;
            r.engagedMs += e.e;
            s.engaged += e.e;
          }
          if (e.s !== undefined) {
            page.scrollSum += e.s;
            page.scrollN++;
          }
          tally(r.vitals.lcp, e.lcp, 2500, 4000);
          tally(r.vitals.cls, e.cls, 0.1, 0.25);
          tally(r.vitals.inp, e.inp, 200, 500);
          break;
        }
        case 'click': {
          r.clicks++;
          s.interact = true;
          bump(r.clickMap, `${e.k}\t${e.l}\t${e.d ?? ''}\t${e.sec ?? ''}`);
          break;
        }
        case 'sec': {
          const key = e.p === '__proto__' ? OTHER : e.p;
          if (!Object.hasOwn(r.sections, key)) {
            if (Object.keys(r.sections).length >= MAP_CAP) break;
            r.sections[key] = {};
          }
          bump(r.sections[key], e.id, 1, 40);
          break;
        }
        case 'form': {
          s.interact = true;
          const key = e.f === '__proto__' ? OTHER : e.f;
          if (!Object.hasOwn(r.forms, key)) {
            if (Object.keys(r.forms).length >= 20) break;
            r.forms[key] = { start: 0, ok: 0, err: 0 };
          }
          r.forms[key][e.a]++;
          if (e.a === 'start') r.formStarts++;
          else if (e.a === 'ok') r.formOk++;
          else r.formErr++;
          break;
        }
        case 'evt': {
          s.interact = true;
          bump(r.custom, `${e.n}\t${e.l ?? ''}`);
          break;
        }
      }
    }
  }

  for (const s of sessions.values()) {
    if (s.pv === 0) continue; // a leave beacon from a session that began yesterday
    r.sessions++;
    if (s.pv === 1 && !s.interact && s.engaged < BOUNCE_MS) r.bouncedSessions++;
  }
  for (const returning of visitors.values()) {
    r.visitors++;
    if (returning) r.returningVisitors++;
    else r.newVisitors++;
  }
  return r;
}

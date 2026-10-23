// Shared shapes for the first-party analytics system. Imported by the browser
// tracker (src/scripts/analytics.ts), the two Netlify functions
// (netlify/functions/collect.ts, stats.ts) and the dashboard
// (src/pages/analytics.astro) - keep this file free of DOM and Node imports so
// it runs in all three.
//
// Data flow: tracker -> POST /api/collect -> one raw JSON blob per batch ->
// buildRollup() folds a day of raw blobs into one Rollup (no visitor IDs left
// in it) -> mergeRollups() folds N days into the Report the dashboard draws.
// See CLAUDE.md "Analytics" for the privacy rules this is built around.

export type ClickKind = 'out' | 'mail' | 'tel' | 'nav' | 'btn' | 'photo' | 'video' | 'social';
export const CLICK_KINDS: readonly ClickKind[] = ['out', 'mail', 'tel', 'nav', 'btn', 'photo', 'video', 'social'];

export type FormAction = 'start' | 'ok' | 'err';
export const FORM_ACTIONS: readonly FormAction[] = ['start', 'ok', 'err'];

/**
 * One tracked event, as sent over the wire (short keys keep beacons small).
 * `p` is always the page path the event happened on.
 */
export type Ev =
  /** Page view. r = external referrer host (first pageview of a session only),
   *  us/um/uc = utm source/medium/campaign, w = viewport width, l = language,
   *  n = 1 on the first pageview of a new session. */
  | { t: 'pv'; p: string; r?: string; us?: string; um?: string; uc?: string; w?: number; l?: string; n?: 1 }
  /** Leaving a page. e = engaged (tab visible) ms, s = deepest scroll %, plus
   *  Core Web Vitals (sent once, for the initial hard load only). */
  | { t: 'leave'; p: string; e?: number; s?: number; lcp?: number; cls?: number; inp?: number }
  /** A link or button was used. k = kind, l = label, d = destination host or
   *  path, sec = id of the section it sat in. */
  | { t: 'click'; p: string; k: ClickKind; l: string; d?: string; sec?: string }
  /** A section scrolled into view (once per pageview per section). */
  | { t: 'sec'; p: string; id: string }
  /** A form was started / submitted / failed. f = form id. Never any content. */
  | { t: 'form'; p: string; f: string; a: FormAction }
  /** Anything else worth counting, via the hv:track DOM event. */
  | { t: 'evt'; p: string; n: string; l?: string };

/** What the browser POSTs. vid/sid are random, made in the browser. */
export interface Batch {
  v: 1;
  vid: string;
  sid: string;
  /** 1 if this browser has been seen on an earlier day. */
  ret: 0 | 1;
  events: Ev[];
}

/** A stored batch: the sanitised events plus coarse, server-derived fields.
 *  No IP address and no raw user-agent string is ever kept. */
export interface RawRecord {
  ts: number;
  vid: string;
  sid: string;
  ret: 0 | 1;
  /** ISO country code from the host's geolocation, '??' if unknown. */
  cc: string;
  dev: string;
  br: string;
  os: string;
  events: Ev[];
}

export interface PageStat {
  views: number;
  entries: number;
  engagedMs: number;
  scrollSum: number;
  scrollN: number;
}

export interface VitalStat {
  good: number;
  ni: number;
  poor: number;
  sum: number;
  n: number;
}

/** One Europe/Dublin calendar day, aggregated. Contains no visitor or session
 *  IDs, so it can be kept indefinitely after the raw records are purged. */
export interface Rollup {
  v: 1;
  date: string;
  builtAt: number;
  visitors: number;
  sessions: number;
  pageviews: number;
  newVisitors: number;
  returningVisitors: number;
  bouncedSessions: number;
  /** Total engaged milliseconds across all pageviews. */
  engagedMs: number;
  clicks: number;
  formStarts: number;
  formOk: number;
  formErr: number;
  pages: Record<string, PageStat>;
  /** Maps below count sessions unless noted. */
  referrers: Record<string, number>;
  channels: Record<string, number>;
  campaigns: Record<string, number>;
  /** key = kind \t label \t destination \t section; value = clicks. */
  clickMap: Record<string, number>;
  /** page path -> section id -> pageviews that reached it. */
  sections: Record<string, Record<string, number>>;
  forms: Record<string, { start: number; ok: number; err: number }>;
  /** key = name \t label; value = count. */
  custom: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  oses: Record<string, number>;
  languages: Record<string, number>;
  viewports: Record<string, number>;
  /** Pageviews by Europe/Dublin hour, index 0-23. */
  hours: number[];
  vitals: { lcp: VitalStat; cls: VitalStat; inp: VitalStat };
}

export interface NameCount {
  name: string;
  n: number;
}

export interface DayPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  clicks: number;
  enquiries: number;
}

export interface PageRow {
  path: string;
  views: number;
  entries: number;
  avgSec: number;
  /** Mean deepest-scroll %, null if no leave events were recorded. */
  avgScroll: number | null;
}

export interface ClickRow {
  kind: ClickKind;
  label: string;
  dest: string;
  section: string;
  n: number;
}

export interface VitalSummary {
  good: number;
  ni: number;
  poor: number;
  n: number;
  avg: number | null;
}

/** Everything the dashboard draws, for one date range. */
export interface Report {
  meta: { generatedAt: number; from: string; to: string; days: number; retentionDays: number; demo: boolean };
  daily: DayPoint[];
  totals: {
    visitors: number;
    sessions: number;
    pageviews: number;
    newVisitors: number;
    returningVisitors: number;
    bounceRate: number | null;
    avgEngagedSec: number | null;
    pagesPerSession: number | null;
    clicks: number;
    formStarts: number;
    enquiries: number;
    enquiryErrors: number;
    enquiriesPer100Visitors: number | null;
  };
  pages: PageRow[];
  entries: PageRow[];
  referrers: NameCount[];
  channels: NameCount[];
  campaigns: NameCount[];
  clicks: ClickRow[];
  clickKinds: NameCount[];
  sections: Record<string, { views: number; rows: { id: string; n: number }[] }>;
  forms: { form: string; start: number; ok: number; err: number }[];
  custom: { name: string; label: string; n: number }[];
  countries: NameCount[];
  devices: NameCount[];
  browsers: NameCount[];
  oses: NameCount[];
  languages: NameCount[];
  viewports: NameCount[];
  /** [weekday Mon=0..Sun=6][hour 0-23] pageviews. */
  heatmap: number[][];
  vitals: { lcp: VitalSummary; cls: VitalSummary; inp: VitalSummary };
}

/** The subset of a Netlify Blobs Store the server code uses, so tests can
 *  swap in an in-memory one. */
export interface BlobStoreLike {
  get(key: string, options?: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  list(options?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
  delete(key: string): Promise<void>;
}

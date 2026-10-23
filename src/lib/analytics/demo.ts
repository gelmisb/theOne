import { buildRollup, dayRange, dublinDay } from './core';
import { mergeRollups } from './report';
import type { Ev, RawRecord, Report } from './types';

// SAMPLE DATA ONLY. Invents plausible traffic so the dashboard can be seen
// working - every chart populated - before (or without) real visitors. It
// builds raw records and pushes them through the real buildRollup/mergeRollups,
// so the sample view exercises the same code as live data. The dashboard
// labels it "SAMPLE DATA" wherever it appears; none of it is real visitors.

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashStr = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

type Weighted<T> = [T, number][];

function pick<T>(r: () => number, items: Weighted<T>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1][0];
}

const HOME_SECTIONS = [
  'intro', 'hero', 'who-we-help', 'why-real-photos', 'offer-intro', 'offer',
  'portfolio', 'clients', 'process', 'about', 'seo', 'faq', 'updates',
];
const HOME_REACH = [1, 0.97, 0.84, 0.72, 0.61, 0.54, 0.47, 0.43, 0.4, 0.34, 0.28, 0.22, 0.18];

const ENTRY: Weighted<string> = [
  ['/', 62], ['/photography/', 8], ['/stays-and-experiences/', 6], ['/food-and-drink/', 6],
  ['/local-seo/', 5], ['/videography/', 4], ['/web-projects/', 3], ['/about/', 3], ['/contact/', 3],
];
const NEXT: Weighted<string> = [
  ['/photography/', 20], ['/contact/', 12], ['/stays-and-experiences/', 12], ['/food-and-drink/', 12],
  ['/about/', 10], ['/web-projects/', 10], ['/local-seo/', 10], ['/videography/', 8], ['/terms/', 3], ['/privacy/', 2],
];
const REFERRERS: Weighted<string> = [
  ['', 40], ['google.ie', 20], ['google.com', 8], ['instagram.com', 10], ['l.facebook.com', 7],
  ['linkedin.com', 5], ['bing.com', 3], ['duckduckgo.com', 2], ['localchamber.example', 3], ['directory.example', 2],
];
const COUNTRIES: Weighted<string> = [
  ['IE', 78], ['GB', 8], ['US', 5], ['DE', 2], ['FR', 2], ['NL', 1.5], ['ES', 1], ['??', 1], ['PL', 1.5],
];
const PHOTO_CAPTIONS = ['Barbershops', 'Café Culture', 'Local Produce', 'Strength Training', 'Village Pet Shop Front', 'Buddy Care Shelf', 'Costa Corner'];
const PAGE_SECTIONS: Record<string, string[]> = {
  '/photography/': ['photography-why', 'photography-included', 'photography-process'],
  '/stays-and-experiences/': ['stays-outcomes', 'stays-package', 'faq'],
  '/food-and-drink/': ['food-outcomes', 'food-package', 'faq'],
  '/local-seo/': ['seo-why', 'seo-steps'],
  '/videography/': ['video-included'],
  '/web-projects/': ['wp-why', 'wp-process'],
  '/about/': ['about-cta'],
  '/contact/': ['contact'],
};

/** Build `days` days of invented raw records, ending at `endDay`. */
function generateRecords(endDay: string, days: number): Map<string, RawRecord[]> {
  const out = new Map<string, RawRecord[]>();
  const dates = dayRange(endDay, days);
  let counter = 0;

  dates.forEach((date, di) => {
    const r = rng(hashStr(date));
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const spike = di === Math.floor(days * 0.62) ? 2.3 : 1; // an email-campaign day
    const dayFactor = spike > 1 ? 1 : weekday >= 5 ? 0.55 : 1;
    const trend = 0.7 + 0.6 * (di / Math.max(days - 1, 1));
    const visitors = Math.round(38 * dayFactor * trend * spike * (0.8 + r() * 0.4));
    const emailDay = spike > 1;
    const records: RawRecord[] = [];

    for (let v = 0; v < visitors; v++) {
      counter++;
      const device = pick(r, [['Mobile', 58], ['Desktop', 36], ['Tablet', 6]] as Weighted<string>);
      const browser = device === 'Desktop'
        ? pick(r, [['Chrome', 62], ['Safari', 14], ['Edge', 14], ['Firefox', 9]] as Weighted<string>)
        : pick(r, [['Safari', 55], ['Chrome', 38], ['Samsung Internet', 7]] as Weighted<string>);
      const os = device === 'Desktop'
        ? pick(r, [['Windows', 58], ['macOS', 34], ['Linux', 8]] as Weighted<string>)
        : pick(r, [['iOS', 56], ['Android', 44]] as Weighted<string>);
      const width = device === 'Mobile' ? 360 + Math.floor(r() * 70) : device === 'Tablet' ? 768 + Math.floor(r() * 66) : 1280 + Math.floor(r() * 640);
      const returning: 0 | 1 = r() < 0.22 ? 1 : 0;
      const cc = pick(r, COUNTRIES);
      const lang = pick(r, [['en', 90], ['de', 3], ['fr', 3], ['pl', 2], ['ga', 2]] as Weighted<string>);
      const hour = pick(r, [[8, 3], [9, 6], [10, 8], [11, 8], [12, 9], [13, 8], [14, 7], [15, 7], [16, 7], [17, 6], [18, 6], [19, 8], [20, 9], [21, 7]] as Weighted<number>);
      const ts = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hour, Math.floor(r() * 59));

      const events: Ev[] = [];
      let page = pick(r, ENTRY);
      const pageCount = 1 + (r() < 0.45 ? 1 : 0) + (r() < 0.25 ? 1 : 0) + (r() < 0.12 ? 1 : 0) + (r() < 0.05 ? 2 : 0);
      for (let p = 0; p < pageCount; p++) {
        const pv: Ev = { t: 'pv', p: page, w: width, l: lang };
        let navigatedViaCta = false;
        if (p === 0) {
          pv.n = 1;
          const ref = emailDay && r() < 0.5 ? '' : pick(r, REFERRERS);
          if (ref) pv.r = ref;
          if (emailDay && !ref) { pv.us = 'newsletter'; pv.um = 'email'; pv.uc = 'spring-update'; }
          else if (ref === 'instagram.com' && r() < 0.3) { pv.us = 'instagram'; pv.um = 'social'; pv.uc = 'bio-link'; }
        }
        events.push(pv);

        let reached = 0;
        if (page === '/') {
          for (let s = 0; s < HOME_SECTIONS.length; s++) {
            if (r() > HOME_REACH[s] / (s ? HOME_REACH[s - 1] : 1)) break;
            events.push({ t: 'sec', p: page, id: HOME_SECTIONS[s] });
            reached = s + 1;
          }
          if (r() < 0.14) { events.push({ t: 'click', p: page, k: 'nav', l: 'Get a Free Listing Audit', d: '/contact/', sec: 'hero' }); navigatedViaCta = true; }
          else if (r() < 0.06) events.push({ t: 'click', p: page, k: 'nav', l: 'See Packages', d: '/#offer', sec: 'hero' });
          else if (r() < 0.05) events.push({ t: 'click', p: page, k: 'nav', l: 'Cafés, bakeries and food producers', d: '/food-and-drink/', sec: 'who-we-help' });
          if (reached >= 7 && r() < 0.16) events.push({ t: 'click', p: page, k: 'photo', l: PHOTO_CAPTIONS[Math.floor(r() * PHOTO_CAPTIONS.length)], sec: 'portfolio' });
          if (reached >= HOME_SECTIONS.length && r() < 0.09) {
            events.push({ t: 'form', p: page, f: 'newsletter-form', a: 'start' });
            if (r() < 0.55) events.push({ t: 'form', p: page, f: 'newsletter-form', a: 'ok' });
          }
        } else {
          for (const id of (PAGE_SECTIONS[page] ?? []).slice(0, 1 + Math.floor(r() * 3))) events.push({ t: 'sec', p: page, id });
          if (r() < 0.1) { events.push({ t: 'click', p: page, k: 'nav', l: 'Get a Free Listing Audit', d: '/contact/', sec: 'main' }); navigatedViaCta = true; }
        }
        if (page === '/contact/') {
          if (r() < 0.48) {
            events.push({ t: 'form', p: page, f: 'enquiry-form', a: 'start' });
            const x = r();
            if (x < 0.32) events.push({ t: 'form', p: page, f: 'enquiry-form', a: 'ok' });
            else if (x < 0.35) events.push({ t: 'form', p: page, f: 'enquiry-form', a: 'err' });
          }
        }
        if (r() < 0.012) events.push({ t: 'click', p: page, k: 'mail', l: 'Email', sec: 'footer' });
        if (r() < 0.018) events.push({ t: 'click', p: page, k: 'tel', l: 'Phone', sec: 'footer' });
        if (r() < 0.02) events.push({ t: 'click', p: page, k: 'social', l: 'Instagram', d: 'instagram.com', sec: 'footer' });
        if (r() < 0.01) events.push({ t: 'click', p: page, k: 'out', l: 'dataprotection.ie', d: 'dataprotection.ie', sec: 'main' });

        const base = page === '/' ? 55_000 : 35_000;
        // Roughly half of single-page visits are quick exits (under 10s).
        const quickExit = pageCount === 1 && r() < 0.5;
        const leave: Ev = {
          t: 'leave', p: page,
          e: quickExit ? Math.round(1500 + r() * 7500) : Math.round(base * (0.15 + r() * 1.7)),
          s: page === '/' ? Math.min(100, Math.round(8 + (reached / HOME_SECTIONS.length) * 92 + r() * 6)) : Math.round(25 + r() * 75),
        };
        if (p === 0) {
          leave.lcp = Math.round((device === 'Mobile' ? 2300 : 1600) * (0.5 + r() * 1.2));
          leave.cls = r() < 0.12 ? Math.round((0.1 + r() * 0.25) * 1000) / 1000 : Math.round(r() * 0.06 * 1000) / 1000;
          leave.inp = Math.round((device === 'Mobile' ? 170 : 90) * (0.5 + r() * 1.6));
        }
        events.push(leave);
        page = navigatedViaCta ? '/contact/' : pick(r, NEXT);
      }

      records.push({
        ts, vid: `demo-visitor-${counter}`, sid: `demo-session-${counter}`, ret: returning, cc,
        dev: device, br: browser, os, events,
      });
    }
    out.set(date, records);
  });
  return out;
}

/** A complete Report built from invented traffic. */
export function generateDemoReport(days: number, now = Date.now()): Report {
  const end = dublinDay(now);
  const dates = dayRange(end, days);
  const byDay = generateRecords(end, days);
  const rollups = dates.map((d) => buildRollup(d, byDay.get(d) ?? [], now));
  return mergeRollups(rollups, dates, { demo: true, now });
}

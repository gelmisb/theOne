// Always-on visit counter - the part of analytics that needs no cookie choice.
//
// Every page view sends one tiny beacon (src/scripts/hitCounter.ts) carrying
// only the page path. Nothing is stored on the visitor's device and no ID is
// created. The server (server.ts, handleHit) keeps ONE small record per view:
// time, page, country, device class, and two small numbers (`j`, `k`) used to
// estimate how many different people visited. Those numbers are a HyperLogLog
// observation of a keyed, daily-rotating hash of the visitor's connection
// details: `j` is one of 1024 buckets and `k` a rank, together roughly 15 bits -
// enough to estimate a count across many visitors, far too little to recognise
// or single out anyone. The connection details and the full hash are never
// stored. Browser-safe: no Node imports (hashing lives in server.ts).
import { MAP_CAP, bump, dublinHour } from './core';
import type { AllTraffic, HitRecord, HitRollup } from './types';

/** HyperLogLog precision: 2^10 = 1024 buckets, about 3% standard error. */
export const HLL_BITS = 10;
export const HLL_M = 1 << HLL_BITS;
const RANK_BITS = 32 - HLL_BITS; // 22 bits left for the rank

/** Turn the first 4 bytes of a hash into a (bucket, rank) observation. */
export function hllObserve(first4: Uint8Array | number[]): { j: number; k: number } {
  const h = ((first4[0] << 24) | (first4[1] << 16) | (first4[2] << 8) | first4[3]) >>> 0;
  const j = h >>> RANK_BITS;
  const w = h & ((1 << RANK_BITS) - 1);
  // rank = position of the first 1 bit in the remaining bits (1-based); all zeros -> max rank
  const k = w === 0 ? RANK_BITS + 1 : Math.clz32(w) - HLL_BITS + 1;
  return { j, k };
}

/** Estimated number of distinct visitors from the max rank seen per bucket. */
export function hllEstimate(registers: number[] | Uint8Array): number {
  const m = HLL_M;
  let sum = 0;
  let zeros = 0;
  for (let i = 0; i < m; i++) {
    const r = registers[i] ?? 0;
    sum += 2 ** -r;
    if (r === 0) zeros++;
  }
  const alpha = 0.7213 / (1 + 1.079 / m);
  const raw = (alpha * m * m) / sum;
  // Small-range correction (linear counting): accurate when few visitors, the usual case here.
  return Math.round(raw <= 2.5 * m && zeros > 0 ? m * Math.log(m / zeros) : raw);
}

export function emptyHitRollup(date: string): HitRollup {
  return { v: 1, date, builtAt: 0, views: 0, visitors: 0, pages: {}, countries: {}, devices: {}, hours: Array(24).fill(0) };
}

/** Fold one day of hit records into a roll-up (counts only; nothing identifying is left). */
export function buildHitRollup(date: string, records: HitRecord[], now = Date.now()): HitRollup {
  const r = emptyHitRollup(date);
  r.builtAt = now;
  const regs = new Uint8Array(HLL_M);
  for (const h of records) {
    r.views++;
    bump(r.pages, h.p);
    bump(r.countries, h.cc);
    bump(r.devices, h.dev);
    r.hours[dublinHour(h.ts)]++;
    if (Number.isInteger(h.j) && h.j >= 0 && h.j < HLL_M && Number.isInteger(h.k) && h.k > 0 && h.k <= RANK_BITS + 1) {
      regs[h.j] = Math.max(regs[h.j], h.k);
    }
  }
  r.visitors = hllEstimate(regs);
  return r;
}

const top = (m: Record<string, number>, n = 12) =>
  Object.entries(m)
    .map(([name, c]) => ({ name, n: c }))
    .sort((a, b) => b.n - a.n)
    .slice(0, n);

/** Fold N day roll-ups into what the dashboard draws. Visitors are summed per
 *  day (a person back on another day counts again - the daily key rotates, so
 *  days can't be linked), so treat the total as "visitor-days". */
export function mergeHitRollups(rollups: HitRollup[], dates: string[]): AllTraffic {
  const byDate = new Map(rollups.map((r) => [r.date, r]));
  const pages: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const devices: Record<string, number> = {};
  let views = 0;
  let visitors = 0;
  const daily = dates.map((date) => {
    const r = byDate.get(date);
    if (!r) return { date, views: 0, visitors: 0 };
    views += r.views;
    visitors += r.visitors;
    for (const [k, v] of Object.entries(r.pages)) bump(pages, k, v, MAP_CAP * 2);
    for (const [k, v] of Object.entries(r.countries)) bump(countries, k, v);
    for (const [k, v] of Object.entries(r.devices)) bump(devices, k, v);
    return { date, views: r.views, visitors: r.visitors };
  });
  return { daily, totals: { views, visitors }, pages: top(pages), countries: top(countries), devices: top(devices) };
}

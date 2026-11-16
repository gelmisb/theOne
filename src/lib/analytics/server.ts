import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  MAX_BODY_BYTES,
  RAW_RETENTION_DAYS,
  addDays,
  buildRollup,
  classifyUA,
  cleanPath,
  dayRange,
  dublinDay,
  isBot,
  sanitiseBatch,
} from './core';
import { buildHitRollup, hllObserve, mergeHitRollups } from './hits';
import { mergeRollups } from './report';
import type { BlobStoreLike, HitRecord, HitRollup, RawRecord, Rollup } from './types';

// Server side of the analytics system, written against a tiny store interface
// so it can be tested without Netlify. The two function files
// (netlify/functions/collect.ts, stats.ts) are thin wrappers that pass in the
// real Netlify Blobs store. Node-only (node:crypto) - never import this from
// browser code.
//
// Storage layout in the "analytics" blob store:
//   raw/YYYY-MM-DD/<ts>-<id>.json   one sanitised batch each; deleted after RAW_RETENTION_DAYS
//   daily/YYYY-MM-DD.json           that day's Rollup (no visitor IDs); kept
//   meta/purged-YYYY-MM-DD          marker so the purge runs once a day
//   hits/YYYY-MM-DD/<ts>-<id>.json  one record per page view from the always-on
//                                   counter (hits.ts); no IDs; deleted after RAW_RETENTION_DAYS
//   hits-daily/YYYY-MM-DD.json      that day's HitRollup; kept

export interface ServerDeps {
  store: BlobStoreLike;
  now?: () => number;
  /** ANALYTICS_TOKEN - the secret the dashboard sends. */
  token?: string;
}

export interface HitContext {
  /** Host-geolocated ISO country code. */
  country?: string;
  /** Connection address. Read only to make the one-way daily hash below; never stored. */
  ip?: string;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

// -------------------------------------------------------------- collect

/**
 * POST /api/collect. Never reads or stores an IP address. `country` is the
 * host's geolocation country code, passed in by the function wrapper.
 */
export async function handleCollect(req: Request, country: string | undefined, deps: ServerDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });

  // Same-origin only: a browser always sends Origin on a POST, and ours is us.
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return empty(403);
    } catch {
      return empty(403);
    }
  }

  const ua = req.headers.get('user-agent') ?? '';
  if (isBot(ua)) return empty(204); // silently - no reason to tell a crawler it was filtered

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return empty(413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return empty(413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return empty(400);
  }
  const batch = sanitiseBatch(raw);
  if (!batch) return empty(400);

  const now = deps.now ?? Date.now;
  const ts = now();
  const { device, browser, os } = classifyUA(ua);
  const record: RawRecord = {
    ts,
    vid: batch.vid,
    sid: batch.sid,
    ret: batch.ret,
    cc: /^[A-Z]{2}$/.test(country ?? '') ? (country as string) : '??',
    dev: device,
    br: browser,
    os,
    events: batch.events,
  };
  await deps.store.setJSON(`raw/${dublinDay(ts)}/${ts}-${randomUUID().slice(0, 8)}.json`, record);
  return empty(204);
}

// ------------------------------------------------------------------ hit

/**
 * POST /api/hit - the always-on visit counter (see hits.ts for the privacy
 * design). Counts a page view for everyone, whatever their cookie choice, and
 * stands down for browsers that send Global Privacy Control or Do Not Track.
 * The connection address is hashed with a key that changes every Irish day,
 * reduced to a ~15-bit observation, and discarded - only that observation is
 * stored, with the page, country and device class.
 */
export async function handleHit(req: Request, ctx: HitContext, deps: ServerDeps & { salt?: string }): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return empty(403);
    } catch {
      return empty(403);
    }
  }
  // The browser's own "don't track me" signals: not counted at all.
  if (req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') return empty(204);

  const ua = req.headers.get('user-agent') ?? '';
  if (isBot(ua)) return empty(204);

  if (Number(req.headers.get('content-length') ?? 0) > 1000) return empty(413);
  const text = await req.text();
  if (text.length > 1000) return empty(413);
  let body: { p?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return empty(400);
  }
  const path = cleanPath(body?.p);
  if (!path || path.startsWith('/analytics') || path.startsWith('/api/')) return empty(204);

  const ts = (deps.now ?? Date.now)();
  const day = dublinDay(ts);
  // Keyed by a secret AND the day, so the same visitor hashes differently each
  // day and days can't be linked. With no secret configured it still works; the
  // hash is never stored either way.
  const key = `${deps.salt ?? 'hv'}|${day}`;
  const hash = createHmac('sha256', key).update(`${ctx.ip ?? ''}|${ua}`).digest();
  const { j, k } = hllObserve(hash.subarray(0, 4));
  const { device } = classifyUA(ua);
  const record: HitRecord = { ts, p: path, cc: /^[A-Z]{2}$/.test(ctx.country ?? '') ? (ctx.country as string) : '??', dev: device, j, k };
  await deps.store.setJSON(`hits/${day}/${ts}-${randomUUID().slice(0, 8)}.json`, record);
  return empty(204);
}

// ---------------------------------------------------------------- stats

const digest = (s: string) => createHash('sha256').update(s).digest();

function authorised(req: Request, token: string): boolean {
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  return timingSafeEqual(digest(given), digest(token));
}

/** Run `fn` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function loadRaw(store: BlobStoreLike, day: string): Promise<RawRecord[]> {
  const { blobs } = await store.list({ prefix: `raw/${day}/` });
  const records = await mapLimit(blobs, 8, (b) => store.get(b.key, { type: 'json' }));
  return records.filter((r): r is RawRecord => !!r && typeof r === 'object');
}

/** A past day is built once and cached; today is rebuilt from raw every time. */
async function rollupFor(store: BlobStoreLike, day: string, today: string, now: number): Promise<Rollup> {
  const past = day < today;
  if (past) {
    const cached = (await store.get(`daily/${day}.json`, { type: 'json' })) as Rollup | null;
    if (cached && cached.v === 1) return cached;
  }
  const rollup = buildRollup(day, await loadRaw(store, day), now);
  if (past) await store.setJSON(`daily/${day}.json`, rollup);
  return rollup;
}

async function loadHits(store: BlobStoreLike, day: string): Promise<HitRecord[]> {
  const { blobs } = await store.list({ prefix: `hits/${day}/` });
  const records = await mapLimit(blobs, 8, (b) => store.get(b.key, { type: 'json' }));
  return records.filter((r): r is HitRecord => !!r && typeof r === 'object');
}

/** Same caching rule as rollupFor: a past day is built once, today is rebuilt every time. */
async function hitRollupFor(store: BlobStoreLike, day: string, today: string, now: number): Promise<HitRollup> {
  const past = day < today;
  if (past) {
    const cached = (await store.get(`hits-daily/${day}.json`, { type: 'json' })) as HitRollup | null;
    if (cached && cached.v === 1) return cached;
  }
  const rollup = buildHitRollup(day, await loadHits(store, day), now);
  if (past) await store.setJSON(`hits-daily/${day}.json`, rollup);
  return rollup;
}

/**
 * Delete raw records older than the retention window - but only after that
 * day's roll-up exists, so purging never loses the aggregate. Runs at most
 * once a day (marker blob).
 */
async function purgeOld(store: BlobStoreLike, today: string, now: number): Promise<void> {
  const marker = `meta/purged-${today}`;
  if (await store.get(marker)) return;
  const cutoff = addDays(today, -RAW_RETENTION_DAYS);
  const { blobs } = await store.list({ prefix: 'raw/' });
  const byDay = new Map<string, string[]>();
  for (const { key } of blobs) {
    const day = key.slice(4, 14);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < cutoff) byDay.set(day, [...(byDay.get(day) ?? []), key]);
  }
  for (const [day, keys] of byDay) {
    await rollupFor(store, day, today, now); // make sure the aggregate exists first
    await mapLimit(keys, 8, (k) => store.delete(k));
  }
  // The always-on counter's per-view records, same rule: roll up first, then delete.
  const { blobs: hitBlobs } = await store.list({ prefix: 'hits/' });
  const hitsByDay = new Map<string, string[]>();
  for (const { key } of hitBlobs) {
    const day = key.slice(5, 15);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < cutoff) hitsByDay.set(day, [...(hitsByDay.get(day) ?? []), key]);
  }
  for (const [day, keys] of hitsByDay) {
    await hitRollupFor(store, day, today, now);
    await mapLimit(keys, 8, (k) => store.delete(k));
  }
  await store.setJSON(marker, { at: now });
}

const ALLOWED_RANGES = [7, 30, 90];

/** GET /api/stats?days=7|30|90 with `Authorization: Bearer <ANALYTICS_TOKEN>`. */
export async function handleStats(req: Request, deps: ServerDeps): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  if (!deps.token) return json({ error: 'Analytics is not configured: ANALYTICS_TOKEN is not set.' }, 503);
  if (!authorised(req, deps.token)) {
    await new Promise((r) => setTimeout(r, 400)); // blunt brute-forcing
    return json({ error: 'Wrong token.' }, 401);
  }

  const asked = Number(new URL(req.url).searchParams.get('days'));
  const days = ALLOWED_RANGES.includes(asked) ? asked : 30;
  const now = (deps.now ?? Date.now)();
  const today = dublinDay(now);
  const dates = dayRange(today, days);

  try {
    await purgeOld(deps.store, today, now);
  } catch (err) {
    console.error('analytics purge failed', err); // never fail the dashboard over housekeeping
  }
  const rollups = await mapLimit(dates, 6, (d) => rollupFor(deps.store, d, today, now));
  const report = mergeRollups(rollups, dates, { now });
  try {
    const hitRollups = await mapLimit(dates, 6, (d) => hitRollupFor(deps.store, d, today, now));
    report.all = mergeHitRollups(hitRollups, dates);
  } catch (err) {
    console.error('hit counter roll-up failed', err); // the rest of the dashboard still loads
  }
  return json(report);
}

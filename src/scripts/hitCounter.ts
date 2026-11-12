// Always-on visit counter. Browser only. Runs for every visitor, whatever they
// chose in the cookie banner, because it uses no cookie or storage and sends
// nothing but the page path - see lib/analytics/hits.ts and /privacy/.
//
// Called from Layout.astro's page-load handler, so an in-app page change (Astro's
// client router) counts as a view just like a full load. Skips: the private
// /analytics page, a browser the owner flagged "ignore my visits", and browsers
// sending Do Not Track / Global Privacy Control (the server also refuses those).
import { IGNORE_KEY, browserOptOut } from './consent';

const ENDPOINT = '/api/hit';
let lastPath = '';
let lastAt = 0;

export function initHitCounter() {
  const path = location.pathname;
  if (path.startsWith('/analytics') || browserOptOut()) return;
  try {
    if (localStorage.getItem(IGNORE_KEY) === '1') return;
  } catch {
    // Storage blocked: carry on, nothing is written either way.
  }
  // astro:page-load can fire twice for one view (e.g. a restored page); count it once.
  const now = Date.now();
  if (path === lastPath && now - lastAt < 1500) return;
  lastPath = path;
  lastAt = now;

  const body = JSON.stringify({ p: path });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    // fall through to fetch
  }
  void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

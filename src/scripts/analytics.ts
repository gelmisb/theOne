import { IGNORE_KEY, browserOptOut, getConsent } from './consent';
import type { Batch, Ev } from '../lib/analytics/types';

// First-party analytics tracker. Sends nothing, stores nothing and observes
// nothing unless the visitor has clicked Accept in the cookie banner (and their
// browser isn't sending Do Not Track / Global Privacy Control).
//
// What it records, once consented: page views (with referrer host and utm_*),
// time on page and scroll depth, link and button clicks, which sections were
// reached, form started/submitted/failed (never what was typed), Core Web
// Vitals and coarse device facts (viewport width, language). The random
// visitor/session IDs live in localStorage/sessionStorage and are deleted the
// moment consent is withdrawn. Receiver: netlify/functions/collect.ts.
//
// Called from Layout.astro's page-load handler. Astro's client router swaps the
// DOM without reloading, so "a page view" is an `astro:page-load`, and every
// session-lifetime listener is bound exactly once (bindOnce).

const ENDPOINT = '/api/collect';
const VID_KEY = 'hv-vid';
const FIRST_KEY = 'hv-first';
const SID_KEY = 'hv-sid';
const SID_TIME_KEY = 'hv-sid-t';

const FLUSH_MS = 2000;
const MAX_QUEUE = 10;
const SESSION_IDLE_MS = 30 * 60 * 1000;

interface PageState {
  path: string;
  engagedMs: number;
  visibleSince: number | null;
  maxScroll: number;
  scrollSent: boolean;
  sections: Set<string>;
  forms: Set<string>;
  observer: IntersectionObserver | null;
  /** True only for the page that was loaded by a real navigation - Core Web
   *  Vitals describe that load, not later in-app page swaps. */
  hardLoad: boolean;
}

let page: PageState | null = null;
let queue: Ev[] = [];
let timer: number | undefined;
let bound = false;
let hasNavigated = false;
let vitalsStarted = false;
let vitalsSent = false;
const vitals: { lcp?: number; cls: number; inp: number } = { cls: 0, inp: 0 };

const attempt = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const store = {
  get: (k: string) => attempt(() => localStorage.getItem(k), null),
  set: (k: string, v: string) => attempt(() => localStorage.setItem(k, v), undefined),
  del: (k: string) => attempt(() => localStorage.removeItem(k), undefined),
};
const session = {
  get: (k: string) => attempt(() => sessionStorage.getItem(k), null),
  set: (k: string, v: string) => attempt(() => sessionStorage.setItem(k, v), undefined),
  del: (k: string) => attempt(() => sessionStorage.removeItem(k), undefined),
};

const uuid = (): string =>
  crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

function active(): boolean {
  return (
    getConsent() === 'granted' &&
    !browserOptOut() &&
    store.get(IGNORE_KEY) !== '1' &&
    !location.pathname.startsWith('/analytics')
  );
}

/** Visitor + session identity. Creating it is what makes this "tracking", so it
 *  only ever runs once active() is true. */
function identity(): { vid: string; sid: string; ret: 0 | 1; newSession: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  let vid = store.get(VID_KEY);
  if (!vid) {
    vid = uuid();
    store.set(VID_KEY, vid);
    store.set(FIRST_KEY, today);
  }
  const first = store.get(FIRST_KEY) ?? today;

  const now = Date.now();
  let sid = session.get(SID_KEY);
  const last = Number(session.get(SID_TIME_KEY) ?? 0);
  let newSession = false;
  if (!sid || now - last > SESSION_IDLE_MS) {
    sid = uuid();
    session.set(SID_KEY, sid);
    newSession = true;
  }
  session.set(SID_TIME_KEY, String(now));
  return { vid, sid, ret: first < today ? 1 : 0, newSession };
}

function flush(beacon = false): void {
  window.clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  if (!active()) {
    queue = [];
    return;
  }
  const { vid, sid, ret } = identity();
  const batch: Batch = { v: 1, vid, sid, ret, events: queue.splice(0, 25) };
  const body = JSON.stringify(batch);
  // text/plain keeps it a "simple" request: no CORS preflight, and sendBeacon
  // survives the page being closed.
  const queued = beacon && 'sendBeacon' in navigator && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
  if (!queued) {
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  }
  if (queue.length) flush(beacon);
}

function enqueue(ev: Ev, immediate = false): void {
  queue.push(ev);
  if (immediate || queue.length >= MAX_QUEUE) flush();
  else if (timer === undefined) timer = window.setTimeout(() => flush(), FLUSH_MS);
}

// ----------------------------------------------------------- web vitals

function startVitals(): void {
  if (vitalsStarted || !('PerformanceObserver' in window)) return;
  vitalsStarted = true;
  const watch = (type: string, cb: (entries: PerformanceEntryList) => void, extra: object = {}) =>
    attempt(() => new PerformanceObserver((list) => cb(list.getEntries())).observe({ type, buffered: true, ...extra } as PerformanceObserverInit), undefined);

  watch('largest-contentful-paint', (entries) => {
    vitals.lcp = entries[entries.length - 1]?.startTime;
  });

  // CLS per the spec: shifts grouped into windows (gap < 1s, window <= 5s), worst window wins.
  let windowValue = 0;
  let windowStart = 0;
  let windowLast = 0;
  watch('layout-shift', (entries) => {
    for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (e.hadRecentInput) continue;
      if (windowValue && e.startTime - windowLast < 1000 && e.startTime - windowStart < 5000) {
        windowValue += e.value;
      } else {
        windowValue = e.value;
        windowStart = e.startTime;
      }
      windowLast = e.startTime;
      if (windowValue > vitals.cls) vitals.cls = windowValue;
    }
  });

  // INP approximated as the slowest interaction seen (exact p98 only differs past 50 interactions).
  watch(
    'event',
    (entries) => {
      for (const e of entries as (PerformanceEntry & { interactionId?: number })[]) {
        if (e.interactionId && e.duration > vitals.inp) vitals.inp = e.duration;
      }
    },
    { durationThreshold: 40 },
  );
}

// ------------------------------------------------------------ page life

function externalReferrer(): string {
  return attempt(() => {
    const host = new URL(document.referrer).hostname;
    return host && host !== location.hostname ? host : '';
  }, '');
}

function startPage(): void {
  if (!active()) return;
  startVitals();
  const { newSession } = identity();
  const path = location.pathname;
  page = {
    path,
    engagedMs: 0,
    visibleSince: document.visibilityState === 'visible' ? performance.now() : null,
    maxScroll: 0,
    scrollSent: false,
    sections: new Set(),
    forms: new Set(),
    observer: null,
    hardLoad: !hasNavigated,
  };

  const ev: Ev = { t: 'pv', p: path, w: window.innerWidth, l: navigator.language };
  if (newSession) {
    ev.n = 1;
    const ref = externalReferrer();
    if (ref) ev.r = ref;
    const q = new URLSearchParams(location.search);
    const us = q.get('utm_source');
    const um = q.get('utm_medium');
    const uc = q.get('utm_campaign');
    if (us) ev.us = us;
    if (um) ev.um = um;
    if (uc) ev.uc = uc;
  }
  enqueue(ev);
  watchSections();
  scrollTick();
}

function endPage(beacon: boolean): void {
  if (!page) return;
  pauseTimer();
  const ev: Ev = { t: 'leave', p: page.path };
  const engaged = Math.round(page.engagedMs);
  if (engaged > 0) ev.e = engaged;
  if (!page.scrollSent) {
    ev.s = page.maxScroll;
    page.scrollSent = true;
  }
  if (page.hardLoad && !vitalsSent && vitals.lcp !== undefined) {
    ev.lcp = Math.round(vitals.lcp);
    ev.cls = Math.round(vitals.cls * 1000) / 1000;
    if (vitals.inp > 0) ev.inp = Math.round(vitals.inp);
    vitalsSent = true;
  }
  // A visibilitychange immediately followed by pagehide would otherwise send an empty second leave.
  if (ev.e !== undefined || ev.s !== undefined || ev.lcp !== undefined) enqueue(ev);
  page.engagedMs = 0; // a later return from a hidden tab only adds the new time
  flush(beacon);
}

function pauseTimer(): void {
  if (page && page.visibleSince !== null) {
    page.engagedMs += performance.now() - page.visibleSince;
    page.visibleSince = null;
  }
}

function resumeTimer(): void {
  if (page && page.visibleSince === null) page.visibleSince = performance.now();
}

let scrollQueued = false;
function scrollTick(): void {
  if (scrollQueued || !page) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    if (!page) return;
    const total = Math.max(document.documentElement.scrollHeight, 1);
    const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / total) * 100));
    if (pct > page.maxScroll) page.maxScroll = pct;
  });
}

/** A section counts as reached once its top enters the upper 60% of the viewport -
 *  works for any section height, unlike a visible-area threshold. */
function watchSections(): void {
  if (!page || !('IntersectionObserver' in window)) return;
  const current = page;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const id = (en.target as HTMLElement).id;
        if (en.isIntersecting && id && !current.sections.has(id)) {
          current.sections.add(id);
          enqueue({ t: 'sec', p: current.path, id });
        }
      }
    },
    { rootMargin: '0px 0px -40% 0px', threshold: 0 },
  );
  document.querySelectorAll<HTMLElement>('section[id]').forEach((s) => io.observe(s));
  current.observer = io;
}

// --------------------------------------------------------------- clicks

type ClickEv = Extract<Ev, { t: 'click' }>;

function describeClick(el: HTMLElement): Omit<ClickEv, 't' | 'p'> | null {
  const label = (
    el.dataset.track ||
    el.getAttribute('aria-label') ||
    el.textContent ||
    el.querySelector('img')?.getAttribute('alt') ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const sec = el.closest('section[id]')?.id || (el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : '');

  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute('href') ?? '';
    if (href.startsWith('mailto:')) return { k: 'mail', l: el.dataset.track || 'Email', sec };
    if (href.startsWith('tel:')) return { k: 'tel', l: el.dataset.track || 'Phone', sec };
    if (el.classList.contains('pswp-item')) return { k: 'photo', l: label || 'Photo', sec };
    let url: URL;
    try {
      url = new URL(el.href, location.href);
    } catch {
      return null;
    }
    if (url.origin !== location.origin) {
      const host = url.hostname.replace(/^www\./, '');
      return { k: el.closest('.foot-socials') ? 'social' : 'out', l: label || host, d: host, sec };
    }
    return { k: 'nav', l: label || url.pathname, d: url.pathname + url.hash, sec };
  }
  if (el.hasAttribute('data-video-trigger')) return { k: 'video', l: el.dataset.videoTitle || label || 'Video', sec };
  if (el.matches('button[type="submit"]')) return null; // covered by the form events
  return label ? { k: 'btn', l: label, sec } : null;
}

function onClick(e: MouseEvent): void {
  if (!page || !active()) return;
  const el = (e.target as Element | null)?.closest?.('a[href], button, [data-track]') as HTMLElement | null;
  if (!el || el.closest('#cookie-banner')) return;
  const info = describeClick(el);
  if (info) enqueue({ t: 'click', p: page.path, ...info });
}

function onFocusIn(e: FocusEvent): void {
  const form = (e.target as Element | null)?.closest?.('form');
  if (!form || !page || !active()) return;
  const id = form.id || form.getAttribute('name') || 'form';
  if (page.forms.has(id)) return;
  page.forms.add(id);
  enqueue({ t: 'form', p: page.path, f: id, a: 'start' });
}

/** Forget this browser: stop, empty the queue, delete the IDs. */
function stopAndForget(): void {
  window.clearTimeout(timer);
  timer = undefined;
  queue = [];
  page?.observer?.disconnect();
  page = null;
  store.del(VID_KEY);
  store.del(FIRST_KEY);
  session.del(SID_KEY);
  session.del(SID_TIME_KEY);
}

function bindOnce(): void {
  if (bound) return;
  bound = true;
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocusIn);
  window.addEventListener('scroll', scrollTick, { passive: true });
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? endPage(true) : resumeTimer()));
  window.addEventListener('pagehide', () => endPage(true));
  document.addEventListener('astro:before-swap', () => {
    hasNavigated = true;
    endPage(false);
    page?.observer?.disconnect();
    page = null;
  });

  // Other scripts report outcomes the tracker can't see (a form actually
  // succeeding): document.dispatchEvent(new CustomEvent('hv:track', { detail: ... })).
  document.addEventListener('hv:track', (e) => {
    const d = (e as CustomEvent).detail ?? {};
    if (!page || !active()) return;
    if (d.type === 'form' && (d.action === 'ok' || d.action === 'err')) {
      enqueue({ t: 'form', p: page.path, f: String(d.form), a: d.action }, true);
    } else if (d.type === 'evt') {
      enqueue({ t: 'evt', p: page.path, n: String(d.name), l: d.label ? String(d.label) : undefined });
    }
  });

  document.addEventListener('hv:consent-changed', (e) => {
    if ((e as CustomEvent).detail === 'granted') {
      if (!page) startPage();
    } else {
      stopAndForget();
    }
  });
}

/** Safe to call on every page load: listeners bind once, and a page already
 *  started is left alone. */
export function initAnalytics(): void {
  bindOnce();
  if (page?.path === location.pathname) return;
  startPage();
}

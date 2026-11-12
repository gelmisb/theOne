// Newsletter sign-up pop-up. Browser only. Markup lives in
// components/NewsletterPopup.astro, mounted once in Layout.astro and kept alive
// across client-side page changes (transition:persist), so this module only has
// to decide WHEN to show it and wire up its buttons.
//
// Rules, from the website-updates brief:
// - Not instantly: it waits a few seconds after the page loads, and until the
//   visitor has answered the cookie banner (two notices stacked on a phone would
//   cover the page).
// - Easy to close (button, Escape), and a close is remembered for
//   POPUP_DISMISS_DAYS. Once per browser session, never on every page.
// - Never shown to someone already subscribed, nor on the contact, privacy,
//   terms or analytics pages, where it would interrupt what they came to do.
// - A floating card, not a modal: no backdrop, no scroll lock, the page stays usable.
import { POPUP_DISMISS_DAYS } from '../data/offers';
import { getConsent } from './consent';

const SUBSCRIBED_KEY = 'hv-newsletter-subscribed';
const DISMISSED_KEY = 'hv-popup-dismissed';
const SHOWN_KEY = 'hv-popup-shown';
const SHOW_DELAY_MS = 3000;
const EXCLUDED_PATHS = ['/contact', '/privacy', '/terms', '/analytics', '/404'];

let timer: number | undefined;

const popup = () => document.getElementById('newsletter-popup');

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
function write(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage blocked: the pop-up may simply come back next time.
  }
}

const excluded = () => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return EXCLUDED_PATHS.some((p) => path === p || path.startsWith(p + '/'));
};

function dismissedRecently(): boolean {
  const at = Number(read(localStorage, DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < POPUP_DISMISS_DAYS * 86_400_000;
}

function eligible(): boolean {
  return (
    !excluded() &&
    read(localStorage, SUBSCRIBED_KEY) !== 'true' &&
    !dismissedRecently() &&
    read(sessionStorage, SHOWN_KEY) !== 'true'
  );
}

function show() {
  const el = popup();
  if (!el || !eligible()) return;
  write(sessionStorage, SHOWN_KEY, 'true');
  el.removeAttribute('hidden');
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

function hide(remember: boolean) {
  const el = popup();
  if (!el || el.hasAttribute('hidden')) return;
  if (remember) write(localStorage, DISMISSED_KEY, String(Date.now()));
  el.classList.remove('is-visible');
  window.setTimeout(() => el.setAttribute('hidden', ''), 250);
}

function schedule() {
  window.clearTimeout(timer);
  const el = popup();
  if (!el) return;
  if (excluded()) {
    // Arrived (by client-side navigation) somewhere it shouldn't be showing.
    hide(false);
    return;
  }
  if (!el.hasAttribute('hidden') || !eligible()) return;
  const start = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(show, SHOW_DELAY_MS);
  };
  if (getConsent() === null) {
    document.addEventListener('hv:consent-changed', start, { once: true });
  } else {
    start();
  }
}

async function submit(form: HTMLFormElement) {
  const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value.trim() ?? '';
  const botField = (form.elements.namedItem('bot-field') as HTMLInputElement | null)?.value ?? '';
  const error = document.getElementById('popup-error');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, botField, consent: true }),
    });
    if (!res.ok) throw new Error(`Subscribe request failed: ${res.status}`);
    write(localStorage, SUBSCRIBED_KEY, 'true');
    error?.setAttribute('hidden', '');
    form.setAttribute('hidden', '');
    document.getElementById('popup-thanks')?.removeAttribute('hidden');
    document.dispatchEvent(new CustomEvent('hv:track', { detail: { type: 'form', form: 'newsletter-popup', action: 'ok' } }));
    window.setTimeout(() => hide(false), 9000);
  } catch {
    error?.removeAttribute('hidden');
    if (button) button.disabled = false;
    document.dispatchEvent(new CustomEvent('hv:track', { detail: { type: 'form', form: 'newsletter-popup', action: 'err' } }));
  }
}

let bound = false;
export function initNewsletterPopup() {
  if (!bound) {
    bound = true;
    document.addEventListener('click', (e) => {
      if ((e.target as Element | null)?.closest('[data-popup-close]')) hide(true);
    });
    document.addEventListener('keydown', (e) => {
      const el = popup();
      if (e.key === 'Escape' && el && !el.hasAttribute('hidden') && !document.querySelector('header.nav-open')) hide(true);
    });
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form?.id !== 'newsletter-popup-form') return;
      e.preventDefault();
      void submit(form);
    });
  }
  schedule();
}

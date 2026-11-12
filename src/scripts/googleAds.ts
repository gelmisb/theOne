// Google Ads tag: consent updates and the enquiry conversion. Browser only.
//
// The tag itself is in the <head> of every page (Layout.astro), loaded and
// configured there under Google Consent Mode v2 so it is in the page source where
// Google's checker looks. This module handles what happens afterwards:
//   - the visitor clicks Accept            -> all four signals 'granted'
//   - consent withdrawn                    -> 'denied', and the cookies the tag set
//                                             on this site (_gcl_*, _gac_*) are removed
// A browser sending Global Privacy Control / Do Not Track is never granted, even
// after Accept. Until Accept, the tag sets no cookies and does not personalise ads
// (/privacy/ has the full wording - change it with any change here).
//
// Conversion: `hv:conversion` is fired by the contact form on success
// (Contact.astro) and sent to Google whatever the consent state - with signals
// denied Google gets a cookie-less ping, which it uses for modelled conversions.
// Each carries a random transaction_id so Google counts one enquiry once.
import { business } from '../data/business';
import { browserOptOut, getConsent } from './consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** Set by the head snippet once the tag has been configured on this page load. */
    hvGtagOn?: boolean;
  }
}

const { id, leadLabel } = business.googleAds;
let bound = false;

// The head snippet declares a global `gtag` function; fall back to pushing the
// Arguments object ourselves if it was skipped on this page.
const send = (...args: unknown[]) => {
  const fn = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  fn?.(...args);
};

const granted = (): boolean => getConsent() === 'granted' && !browserOptOut();

const signals = (v: 'granted' | 'denied') => ({
  ad_storage: v,
  ad_user_data: v,
  ad_personalization: v,
  analytics_storage: v,
});

/** Remove the cookies Google's tag sets on this site (_gcl_*, _gac_*). */
function clearGoogleCookies() {
  const host = location.hostname;
  const domains = [host, `.${host}`, `.${host.replace(/^www\./, '')}`];
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (!/^(_gcl_|_gac_|_gcl$)/.test(name)) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/; domain=${d}`;
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

const transactionId = (): string =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function initGoogleAds() {
  if (bound) return;
  bound = true;
  document.addEventListener('hv:consent-changed', () => {
    if (!window.hvGtagOn) return;
    const on = granted();
    send('consent', 'update', signals(on ? 'granted' : 'denied'));
    if (!on) clearGoogleCookies();
  });
  document.addEventListener('hv:conversion', (e) => {
    if (!window.hvGtagOn || (e as CustomEvent).detail !== 'lead') return;
    send('event', 'conversion', { send_to: `${id}/${leadLabel}`, transaction_id: transactionId() });
  });
}

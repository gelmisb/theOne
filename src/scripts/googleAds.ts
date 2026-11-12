// Google Ads tag and enquiry conversion. Browser only.
//
// The tag is ALWAYS loaded, on every page, so Google can see it and measure
// whether our ads lead to enquiries. What the visitor chose in the cookie banner
// decides what it may DO, through Google Consent Mode v2:
//   - before consent (and for "Essential only"): every signal is 'denied', so the
//     tag sets no cookies and does not use data for ad personalisation; Google
//     still gets basic, cookie-less pings (page, IP, browser) to count conversions;
//   - after "Accept analytics and ads": the signals switch to 'granted';
//   - consent withdrawn: back to 'denied' and the cookies the tag set are removed.
// A browser sending Global Privacy Control / Do Not Track is never granted,
// even if Accept was clicked. /privacy/ describes all of this - change it with
// any change here.
//
// Not loaded on the private /analytics page, nor in a browser the owner has
// flagged "ignore my visits" (their own test clicks shouldn't reach Google).
//
// What it measures: whether a Google ad led to a sent enquiry - `hv:conversion`
// is fired by the contact form on success (Contact.astro).
import { business } from '../data/business';
import { IGNORE_KEY, browserOptOut, getConsent } from './consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const { id, leadLabel } = business.googleAds;
let loaded = false;
let bound = false;

/** The tag may load here at all. */
function loadable(): boolean {
  let ignored = false;
  try {
    ignored = localStorage.getItem(IGNORE_KEY) === '1';
  } catch {
    // Storage blocked: treat as not ignored.
  }
  return !ignored && !location.pathname.startsWith('/analytics');
}

/** The visitor has agreed AND their browser isn't asking not to be tracked. */
const granted = (): boolean => getConsent() === 'granted' && !browserOptOut();

const signals = (v: 'granted' | 'denied') => ({
  ad_storage: v,
  ad_user_data: v,
  ad_personalization: v,
  analytics_storage: v,
});

function load() {
  if (loaded || !loadable()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads an Arguments object off the data layer, not an array, so this
  // has to be a plain function using `arguments`.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  // Consent default FIRST (a returning visitor's saved choice applies straight away).
  window.gtag('consent', 'default', signals(granted() ? 'granted' : 'denied'));
  // With ad_storage denied, strip ad-click identifiers from requests to Google.
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('js', new Date());
  window.gtag('config', id);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

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

export function initGoogleAds() {
  if (!bound) {
    bound = true;
    document.addEventListener('hv:consent-changed', () => {
      if (!loaded) return;
      const on = granted();
      window.gtag?.('consent', 'update', signals(on ? 'granted' : 'denied'));
      if (!on) clearGoogleCookies();
    });
    document.addEventListener('hv:conversion', (e) => {
      // Sent whatever the consent state: with signals denied Google receives a
      // cookie-less conversion ping, which it uses for modelled conversions.
      if (!loaded || (e as CustomEvent).detail !== 'lead') return;
      window.gtag?.('event', 'conversion', { send_to: `${id}/${leadLabel}` });
    });
  }
  load();
}

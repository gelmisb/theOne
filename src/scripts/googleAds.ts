// Google Ads tag and enquiry conversion. Browser only.
//
// Loads nothing until the visitor has clicked Accept in the cookie banner (the
// same choice that switches on our own analytics), and never when their browser
// sends Global Privacy Control / Do Not Track, when the owner has flagged their
// own browser as "ignore my visits", or on the private /analytics page. If
// consent is withdrawn the tag is told to stand down and the cookies it set on
// this site are removed. /privacy/ describes all of this.
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

function allowed(): boolean {
  let ignored = false;
  try {
    ignored = localStorage.getItem(IGNORE_KEY) === '1';
  } catch {
    // Storage blocked: treat as not ignored.
  }
  return getConsent() === 'granted' && !browserOptOut() && !ignored && !location.pathname.startsWith('/analytics');
}

function load() {
  if (loaded || !allowed()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads an Arguments object off the data layer, not an array, so this
  // has to be a plain function using `arguments`.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
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

function setConsentMode(granted: boolean) {
  const v = granted ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
}

export function initGoogleAds() {
  if (!bound) {
    bound = true;
    document.addEventListener('hv:consent-changed', (e) => {
      if ((e as CustomEvent).detail === 'granted') {
        if (loaded) setConsentMode(true);
        else load();
      } else {
        if (loaded) setConsentMode(false);
        clearGoogleCookies();
      }
    });
    document.addEventListener('hv:conversion', (e) => {
      if (!loaded || !allowed() || (e as CustomEvent).detail !== 'lead') return;
      window.gtag?.('event', 'conversion', { send_to: `${id}/${leadLabel}` });
    });
  }
  load();
}

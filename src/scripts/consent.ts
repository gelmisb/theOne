// Analytics consent. Browser only. The tracker (analytics.ts) does nothing
// unless this says 'granted'.
//
// A NEW storage key, deliberately: the old banner was a notice with a single
// "Got it" button that wrote 'accepted' to `hv-cookie-consent`. That click was
// agreement to "essential cookies only", not to analytics, so it must never be
// read as consent now. The legacy key is just deleted.

export const CONSENT_KEY = 'hv-consent-v2';
const LEGACY_KEY = 'hv-cookie-consent';
/** Set by the dashboard's "don't count my visits" switch; the tracker stands down while it is '1'. */
export const IGNORE_KEY = 'hv-ignore';

export type Consent = 'granted' | 'denied';

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage blocked: the choice just won't persist, and nothing is tracked.
  }
  document.dispatchEvent(new CustomEvent('hv:consent-changed', { detail: choice }));
}

/** Drop the notice-only flag from the old banner. */
export function clearLegacyConsent(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/** Re-open the banner so a visitor can change their mind (footer link). */
export const openConsent = (): void => {
  document.dispatchEvent(new CustomEvent('hv:open-consent'));
};

/**
 * The browser itself says "don't track me" (Global Privacy Control or Do Not
 * Track). Honoured even after a visitor clicks Accept - the signal is the more
 * deliberate, more specific choice.
 */
export function browserOptOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

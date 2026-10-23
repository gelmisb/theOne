// The scheduling link for the step AFTER the free listing audit - "talk through
// your audit and quote". It is not the first-contact route: the audit is a
// review sent back by email, so the enquiry form (Contact.astro) stays the
// front door. See QUOTE-AND-DEPOSIT.md for where this link sits in the flow.
//
// Paste a Cal.com / Calendly / similar booking-page URL here to switch the
// link on everywhere at once (Offer, Process, Contact). While it is empty, no
// button renders anywhere - nothing half-built reaches the public site.
//
// It is a plain link that opens in a new tab, not an embedded widget, on
// purpose: an embed loads the scheduler's scripts and cookies on every visit,
// which would break the cookie banner's "essential cookies only, no trackers"
// promise (CookieBanner.astro).
//
// Wording: PRODUCT.md says CTA language is not "consultation" or "discovery
// call", so the label stays plain.
export const CALL_BOOKING_URL = '';
export const CALL_BOOKING_LABEL = 'Book a time to talk it through';

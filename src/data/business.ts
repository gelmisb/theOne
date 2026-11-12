// Facts about the business that appear in more than one place (footer,
// structured data, emails). Keep this the single source: search engines and AI
// assistants cross-check name, phone and profile links, so they must agree
// everywhere.
export const business = {
  name: 'Horizon Vantage',
  url: 'https://horizonvantage.ie',
  email: 'info@horizonvantage.ie',
  phone: '+353894939050',
  phoneDisplay: '+353 89 493 9050',
  instagram: 'https://instagram.com/horizonvantage',
  facebook: 'https://www.facebook.com/share/1DqPMeqiL3/',
  /** Google Business Profile - the same listing shown in Search and Maps. */
  googleProfile: 'https://share.google/URlyVh4JCicbSqVF6',
  founder: 'Gelmis Bartulis',
  /** Google Ads account tag and the conversion label for "Submit lead form" (a sent enquiry). */
  googleAds: { id: 'AW-18565783979', leadLabel: 'M7_gCMDvqrcdEKvD7ZRF' },
} as const;

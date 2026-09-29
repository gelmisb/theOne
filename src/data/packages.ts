// Single source of truth for pricing and package contents - every price on
// the site (Offer.astro's homepage section, the enquiry form's business-type
// context, any future landing page) reads from here, per REFOCUS_BRIEF.md
// section 6. No hard-coded prices anywhere else.
//
// "from €X" + priceNote rather than a fixed number: keeps the tiers as a
// real anchor for comparison shopping without locking to a number before
// the free audit - REFOCUS_BRIEF.md section 4's own convention.
//
// Guessed numbers, flagged for founder review (not in the brief verbatim):
//  - website-only: "pricier, fully-custom version of Starter" was confirmed,
//    the actual number (from €1,400) was not - it sits between Starter
//    (€900, template) and Launch (€2,400, full shoot+site+SEO).
//  - local-seo: "one-off setup" was confirmed, the number (€150) was not.
export interface PackageTier {
  id: string;
  num: string;
  name: string;
  price: string;
  priceNote?: string;
  purpose: string;
  includes: string[];
  core: boolean;
  visible: boolean;
}

const AUDIT_NOTE = 'Final quote after your free audit.';

export const packages: PackageTier[] = [
  {
    id: 'launch',
    num: 'TIER 01',
    name: 'Booking-Ready Launch',
    price: 'from €2,400',
    priceNote: `Scope can extend to €3,200. ${AUDIT_NOTE}`,
    purpose: 'The flagship package - shoot to search, fully booking-ready',
    includes: [
      'Half-day on-site shoot - 25 to 40 edited images',
      '60 to 90 second property film, plus 3 vertical social cuts',
      '5 to 8 page website with booking or ordering set up',
      'Google Business Profile optimisation',
      '30-day check-in after launch',
    ],
    core: true,
    visible: true,
  },
  {
    id: 'refresh',
    num: 'TIER 02',
    name: 'Season Refresh',
    price: 'from €450',
    priceNote: AUDIT_NOTE,
    purpose: 'Keep an existing site and listing current through the seasons',
    includes: ['New on-site imagery each spring or autumn', 'A short social video to match'],
    core: false,
    visible: true,
  },
  {
    id: 'care',
    num: 'TIER 03',
    name: 'Care & Visibility',
    price: 'from €120',
    priceNote: `/month. ${AUDIT_NOTE}`,
    purpose: 'Recurring, on top of the project fee',
    includes: [
      'Website care and hosting',
      'Monthly Google Business Profile posts',
      'A quarterly photo drop',
      'Monthly enquiry and booking report',
    ],
    core: false,
    visible: true,
  },
  {
    id: 'starter',
    num: 'TIER 04',
    name: 'Starter Website',
    price: 'from €900',
    priceNote: AUDIT_NOTE,
    purpose: 'A budget-friendly way to get online properly',
    includes: ['Template-based small website', 'No photo shoot included'],
    core: false,
    visible: true,
  },
  {
    id: 'website-only',
    num: 'TIER 05',
    name: 'Website Only',
    price: 'from €1,400',
    priceNote: AUDIT_NOTE,
    purpose: 'A fully custom build, no photo shoot required',
    includes: ['Custom-built website, not a template', 'Structured around imagery you already have'],
    core: false,
    visible: true,
  },
  {
    id: 'local-seo',
    num: 'TIER 06',
    name: 'Local SEO Help Only',
    price: 'from €150',
    priceNote: `One-off setup. ${AUDIT_NOTE}`,
    purpose: 'For a business with a site already, elsewhere',
    includes: ['Google Business Profile setup and clean-up', 'Category, service area and NAP consistency check'],
    core: false,
    visible: true,
  },
];

// Single source of truth for pricing and package contents - every price on
// the site (Offer.astro's homepage section, the enquiry form's business-type
// context, any future landing page) reads from here, per REFOCUS_BRIEF.md
// section 6. No hard-coded prices anywhere else.
//
// Restructured per pricing-page-fixes.md (P1): six equal tiers became two
// core packages in the main row, with the recurring plan and the small
// one-offs moved into their own sections below, so the first number a visitor
// sees is the flagship rather than a €120/month plan. `group` decides which
// section an entry lands in; array order is display order within a group.
//
// "from €X" + `typical` rather than a bare number: "from" keeps the packages
// a real anchor for comparison shopping without locking to a number before
// the free audit (REFOCUS_BRIEF.md section 4), while `typical` states what
// most clients actually spend so a quote after the audit doesn't read as a
// bait-and-switch. Only set `typical` where there's a real figure behind it.
//
// Guessed numbers, flagged for founder review (not in the brief verbatim):
//  - website: the merged Starter (€900) + Website Only (€1,400) card. The
//    "from €900" floor and the €1,100-€1,600 typical range come from
//    pricing-page-fixes.md.
//  - local-seo: "one-off setup" was confirmed, the number (€150) was not.
//
// To add a premium third package (pricing-page-fixes.md item 1), add a
// `group: 'core'` entry - the main row is a flex-wrapped grid and will lay
// three cards out without any template change.
export type PackageGroup = 'core' | 'ongoing' | 'addon';

export interface PackageTier {
  id: string;
  group: PackageGroup;
  /** Mono label above the name (e.g. "PACKAGE 01", "MONTHLY"). */
  label: string;
  name: string;
  price: string;
  priceNote?: string;
  /** What most clients actually spend - shown on the card next to "from". */
  typical?: string;
  purpose: string;
  includes: string[];
  /** Suggested third-party tool(s) per kind of business, shown as a collapsed
   * list on the add-on row. Suggestions only - the right pick is confirmed in
   * the audit. */
  suggestedTools?: { sector: string; tools: string }[];
  core: boolean;
  visible: boolean;
}

const AUDIT_NOTE = 'Final quote after your free audit.';

export const packages: PackageTier[] = [
  {
    id: 'launch',
    group: 'core',
    label: 'PACKAGE 01',
    name: 'Booking-Ready Launch',
    price: 'from €2,400',
    priceNote: `Scope can extend to €3,200. ${AUDIT_NOTE}`,
    typical: 'Typically around €2,800',
    purpose: 'The flagship package - shoot to search, fully booking-ready',
    includes: [
      'Half-day on-site shoot - 25 to 40 edited images',
      '60 to 90 second film of your business, plus 3 vertical social cuts',
      '5 to 8 page website with booking or ordering set up',
      'Google Business Profile optimisation',
      'Free NFC "Tap to Review" card',
      '30-day check-in after launch',
    ],
    core: true,
    visible: true,
  },
  {
    id: 'website',
    group: 'core',
    label: 'PACKAGE 02',
    name: 'Website',
    price: 'from €900',
    priceNote: AUDIT_NOTE,
    typical: 'Most clients spend €1,100-€1,600',
    purpose: 'A fast, properly built site, with or without a photo shoot behind it',
    includes: [
      'Template-based or fully custom build, depending on what you need',
      'Structured around imagery you already have',
      'No photo shoot included',
    ],
    core: false,
    visible: true,
  },
  {
    id: 'care',
    group: 'ongoing',
    label: 'MONTHLY',
    name: 'Care & Visibility',
    price: 'from €120',
    priceNote: `/month, about €1,440 a year. On top of the project fee. ${AUDIT_NOTE}`,
    purpose: 'Keeps the site, the listing and the photos current once you are live',
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
    id: 'local-seo',
    group: 'addon',
    label: 'ONE-OFF',
    name: 'Local SEO Help Only',
    price: 'from €150',
    priceNote: `One-off setup. ${AUDIT_NOTE}`,
    purpose: 'For a business with a site already, elsewhere',
    includes: ['Google Business Profile setup and clean-up', 'Category, service area and NAP consistency check'],
    core: false,
    visible: true,
  },
  {
    id: 'refresh',
    group: 'addon',
    label: 'SEASONAL',
    name: 'Season Refresh',
    price: 'from €450',
    priceNote: AUDIT_NOTE,
    purpose: 'Keep an existing site and listing current through the seasons',
    includes: ['New on-site imagery each spring or autumn', 'A short social video to match'],
    core: false,
    visible: true,
  },
  // Added 2026-10-23, flagged for founder review:
  //  - price is "Quoted" rather than a number - none was given. Put a
  //    "from €X" here once decided.
  //  - the tools below are suggestions checked for existence and general
  //    fit (Ireland/UK/EU availability) on 2026-10-23, NOT vetted for price,
  //    commission or integration quality - confirm each before relying on it.
  //  - "the tool's own fees are paid to the provider" assumes the client
  //    holds the account and pays the vendor directly.
  // A Booking-Ready Launch already includes booking or ordering on its site
  // (see 'launch' above), so this add-on is for everyone else.
  {
    id: 'booking-system',
    group: 'addon',
    label: 'ADD-ON',
    name: 'Booking or ordering system setup',
    price: 'Quoted',
    priceNote: `Our fee covers set-up; the tool's own fees, if any, go to the provider. Already included in a Booking-Ready Launch. ${AUDIT_NOTE}`,
    purpose: 'Bookings, appointments or orders on a site you already have, linked from your Google profile',
    includes: ['The right tool chosen for your kind of business', 'Set up, connected to your website and tested end to end'],
    suggestedTools: [
      { sector: 'Barbershops, salons, gyms and grooming', tools: 'Fresha or Square Appointments' },
      { sector: 'Cafés and restaurants (table booking)', tools: 'ResDiary or OpenTable' },
      { sector: 'Bakeries, shops and food producers (ordering)', tools: 'Shopify or Square Online' },
      { sector: 'Holiday lets and glamping', tools: 'Lodgify or Smoobu' },
      { sector: 'B&Bs and guesthouses', tools: 'Little Hotelier or eviivo' },
      { sector: 'Activity providers and experiences', tools: 'Rezdy, FareHarbor or Bókun' },
      { sector: 'Anything simpler (a call or a slot)', tools: 'Cal.com or Calendly' },
    ],
    core: false,
    visible: true,
  },
  {
    id: 'nfc',
    group: 'addon',
    label: 'ADD-ON',
    name: 'NFC "Tap to Review" card',
    price: '€25-35',
    priceNote: 'Per card. Free with any Booking-Ready Launch.',
    purpose: 'Makes it easy for every customer to leave an honest review',
    includes: [],
    core: false,
    visible: true,
  },
];

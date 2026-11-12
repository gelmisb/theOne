// Time-limited offers and the newsletter incentive, in one place. Read by the
// homepage section (SeasonalOffer.astro), the pricing list (packages.ts), the
// sign-up pop-up and the welcome email (netlify/lib/welcomeEmail.ts), so a
// change here updates all of them.

/** The Christmas "Seasonal Refresh": an on-site shoot of a business's seasonal
 *  decorations and atmosphere. */
export const seasonalOffer = {
  id: 'seasonal-refresh',
  name: 'Seasonal Refresh',
  season: 'Christmas',
  discountPercent: 20,
  /** The price the discount comes off, in euro. Matches the existing
   *  "Season Refresh" package ("from €450" in packages.ts) - confirm this is the
   *  right base. */
  basePrice: 450,
  /** Last day the offer runs, as YYYY-MM-DD (Irish time), or null while the end
   *  date is still to be confirmed. The offer disappears from the site on the day
   *  after this; set it before launch if you want a firm deadline. */
  endsOn: null as string | null,
} as const;

export const salePrice = Math.round(seasonalOffer.basePrice * (1 - seasonalOffer.discountPercent / 100));

/** Today's date in Ireland as YYYY-MM-DD. */
const dublinToday = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' }).format(now);

/** True until the day after `endsOn`; always true while no end date is set. */
export function isOfferActive(now: Date = new Date()): boolean {
  return seasonalOffer.endsOn === null || dublinToday(now) <= seasonalOffer.endsOn;
}

/** "Ends 24 December", or a plain note while the date is undecided. */
export function offerEndLabel(): string {
  if (seasonalOffer.endsOn === null) return 'Limited time - end date to be confirmed';
  const d = new Date(`${seasonalOffer.endsOn}T12:00:00Z`);
  return `Ends ${new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)}`;
}

/** What a new newsletter subscriber gets: a code to quote in an email enquiry,
 *  which Horizon Vantage answers with a free, no-obligation quote. */
export const subscriberOffer = {
  code: 'HV-WELCOME',
  benefit: 'a free, no-obligation quote for a shoot, a website or a Google profile refresh',
} as const;

/** How long a closed sign-up pop-up stays closed, in days. */
export const POPUP_DISMISS_DAYS = 14;

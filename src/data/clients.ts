// Brands we've worked with or are working with now. The single source for the
// homepage "Brands" section (components/Clients.astro) and for the website
// case study on the Web Projects page. Add a brand by adding an entry here.
//
// Rules, from the brief and PRODUCT.md:
// - Only real work. No invented clients, results, quotes or logos.
// - Say only what is known: `work` lists what we actually did, and is left empty
//   rather than guessed.
// - Every card links somewhere real: the business's own site if it has one,
//   otherwise its Google Maps listing.
// - Confirm a brand is happy to be named before it goes live here.

export type ClientStatus = 'completed' | 'in-progress';

export const statusLabel: Record<ClientStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
};

export interface Client {
  id: string;
  name: string;
  /** Where the business is, if known. */
  location?: string;
  /** What we did for them - only what is true. */
  work: string[];
  status: ClientStatus;
  link: { href: string; label: string };
  /** Internal page that shows the work in more detail. */
  caseStudy?: string;
}

/** A Google Maps search link. Opens the business's listing when Google can match
 *  the name and place; swap in the listing's own "Share" link for a guaranteed
 *  match. */
const mapsSearch = (query: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const clients: Client[] = [
  {
    id: 'irish-exotic-pets',
    name: 'Irish Exotic Pets',
    work: ['Website design and build'],
    status: 'completed',
    link: { href: 'https://irishexoticpets.ie', label: 'Visit irishexoticpets.ie' },
    caseStudy: '/web-projects/',
  },
  {
    id: 'frascati-car-wash',
    name: 'Frascati Car Wash',
    location: 'Frascati Shopping Centre, Blackrock',
    // A refresh only - they have no website, so there is nothing to link to but the map.
    work: ['Photography refresh'],
    status: 'completed',
    link: { href: mapsSearch('Frascati Car Wash, Frascati Shopping Centre, Blackrock'), label: 'Find on Google Maps' },
  },
  {
    id: 'furry-butts',
    name: 'Furry Butts',
    location: 'Blessington, Co. Wicklow',
    work: ['Website design and build', 'Event and shop photography'],
    status: 'completed',
    link: { href: 'https://furrybutts.com', label: 'Visit furrybutts.com' },
    caseStudy: '/web-projects/',
  },
];

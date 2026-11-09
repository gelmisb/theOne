// Structured-data helpers shared by the page templates. Every node points back
// at the one business entity (`/#business`, see LocalBusinessSchema.astro) so
// search engines and AI assistants read the site as a single business offering
// these services, not a set of unrelated pages.
import { business } from './business';

const BUSINESS_ID = `${business.url}/#business`;

export const breadcrumbNames: Record<string, string> = {
  '/photography/': 'Photography',
  '/videography/': 'Videography',
  '/web-projects/': 'Website Design',
  '/local-seo/': 'Local SEO',
  '/food-and-drink/': 'Food & Drink',
  '/stays-and-experiences/': 'Stays & Experiences',
  '/about/': 'About',
  '/contact/': 'Contact',
};

/** BreadcrumbList for a top-level page; null for the homepage and unlisted pages. */
export function breadcrumbSchema(pathname: string) {
  const name = breadcrumbNames[pathname];
  if (!name) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${business.url}/` },
      { '@type': 'ListItem', position: 2, name, item: `${business.url}${pathname}` },
    ],
  };
}

export function serviceSchema(opts: { name: string; serviceType: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: `${business.url}${opts.path}`,
    provider: { '@id': BUSINESS_ID },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'County Wicklow' },
      { '@type': 'AdministrativeArea', name: 'County Kildare' },
      { '@type': 'AdministrativeArea', name: 'County Wexford' },
      { '@type': 'AdministrativeArea', name: 'County Dublin' },
      { '@type': 'Country', name: 'Ireland' },
    ],
  };
}

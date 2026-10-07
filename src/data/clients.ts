// Previous clients / projects shown in Clients.astro. Add a real entry by
// filling in a new object (or replacing a `placeholder: true` one) - the
// component renders whatever is here, and placeholders get a muted
// "Coming soon" card instead of a link.
//
// Only list a client here with their permission - the section copy says
// "shown with their permission".
export interface Client {
  name: string;
  /** What was done for them - short, factual. */
  summary: string;
  /** Short tags, e.g. ['Website', 'Photography']. */
  work: string[];
  href?: string;
  /** Display form of the URL, e.g. 'irishexoticpets.ie'. */
  hrefLabel?: string;
  placeholder?: boolean;
}

export const clients: Client[] = [
  {
    name: 'Irish Exotic Pets',
    summary: 'Online presence for an Irish exotic pet business.',
    work: ['Website'],
    href: 'https://irishexoticpets.ie',
    hrefLabel: 'irishexoticpets.ie',
  },
  {
    name: 'Next project',
    summary: 'Another local business is in the works - details land here once it launches.',
    work: [],
    placeholder: true,
  },
];

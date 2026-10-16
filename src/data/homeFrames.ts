// The homepage's numbered sections, in the exact order pages/index.astro
// renders them. This one list drives BOTH the "FRAME 00N" tag on each section
// and the dot nav's numbers (ScrollNav.astro), so the two can't drift apart.
//
// They used to: each component hard-coded its own number, so sections added
// later (Who We Help, Why Real Photos, FAQ) took the next free number instead
// of their place on the page, and the page read 021, 022, 001, 002 ... 023,
// 007. To add or move a homepage section, put it here at its position on the
// page - every number after it updates itself.
//
// Intro and Hero carry no frame tag, so they aren't in this list; ScrollNav
// adds them in front, unnumbered.
//
// Standalone pages (photography, stays-and-experiences, ...) number their own
// sections from 001 in reading order, directly in their templates.
export interface HomeFrame {
  /** The section's own element id - what the dot nav links and tracks. */
  id: string;
  /** Matches the text beside the FRAME tag on the section itself. */
  label: string;
}

export const homeFrames: HomeFrame[] = [
  { id: 'who-we-help', label: 'Who We Help' },
  { id: 'why-real-photos', label: 'Why Real Photos' },
  { id: 'offer-intro', label: 'The Gap' },
  { id: 'offer', label: 'The Offer' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'process', label: 'How It Works' },
  { id: 'about', label: 'About' },
  { id: 'seo', label: 'Local SEO' },
  { id: 'faq', label: 'Questions' },
  { id: 'updates', label: 'Stay In The Loop' },
];

/** "001", "002", ... for a homepage section id. */
export function frameNumber(id: string): string {
  const i = homeFrames.findIndex((f) => f.id === id);
  if (i === -1) throw new Error(`homeFrames: no homepage frame with id "${id}"`);
  return String(i + 1).padStart(3, '0');
}

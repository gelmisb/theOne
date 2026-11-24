# Horizon Vantage: Website Refocus Brief (for Claude Code)

Read this whole file, then execute it. Repo: `gelmisb/theOne`, branch `dev1` (Astro + GSAP + ScrollTrigger, deployed on Netlify at horizonvantage.ie).

## 0. Decisions Gelmis must confirm before anything merges to main

These come from a market assessment, not from Gelmis yet. Build them as recommended, keep them in one data file so they are trivial to change.

- Prices: Launch from €2,400 (scope range up to €3,200), Refresh from €450, Care & Visibility from €120/month.
- Package contents in section 4 (image counts, film length, page counts).
- Service-area town list in section 2.
- Starter Website price (placeholder €900). Ship it with `visible: false` until confirmed.

## 1. How to work

1. Inspect the repo first: pages, layouts, components, data, forms, head/SEO handling, GSAP utilities. Reply with a plan of at most 15 lines (files you will change), then proceed without waiting unless genuinely blocked.
2. One logical change per commit, clear messages, push to `dev1` only. Do not merge to `main`.
3. No debug markers or `console.log` in commits. Reuse existing GSAP/ScrollTrigger patterns and respect the existing `prefers-reduced-motion` handling. No new heavy dependencies.
4. Do not touch: `Welcome.astro`, `.gitignore`, `package-lock.json`, the `name` field in `package.json`.
5. Never invent clients, testimonials, logos, statistics, awards, results or guarantees. Where real content does not exist yet (case studies, testimonials), build the section behind a flag (e.g. `SHOW_CASE_STUDIES = false`) with clearly marked placeholder slots.
6. All prices and package contents live in ONE data file (e.g. `src/data/packages.ts`). Components read from it. No hard-coded prices anywhere else.
7. Irish English spelling. Prices in euro.

## 2. Positioning

- Primary niche: tourism accommodation and experiences in West Wicklow and the surrounding area: holiday lets, glamping sites, B&Bs, guesthouses, activity operators, small venues.
- Secondary niche: artisan food and drink producers, farm shops and makers.
- Area: based in Baltinglass. Covers West Wicklow, Blessington, Hollywood, Donard, Glen of Imaal, Tullow, Carlow and west Kildare. Further by arrangement.
- Core promise: honest, on-site photography and video of the real place, built into a fast website and Google profile that help guests book direct. Every image is shot at the client's property, never AI-generated.
- Keep the existing tagline: "See further. Show it better."
- Framing rule: credential-led ("10+ years building software, 5+ years shooting professionally"). Never use "one-man", "sole trader", "just me" or "one person" language anywhere. "One local specialist" is acceptable.
- Do not claim AI is bad or that people can spot it. The argument is accuracy and trust: what guests see is what they get.
- No statistics on the site unless a visible source is cited and Gelmis has approved it.

## 3. Copy (use as written unless it breaks the layout)

**Hero**
- H1: Honest photography and websites for West Wicklow stays and experiences.
- Sub: Real on-site photo and video of your place, built into a fast website that helps guests book direct. One local specialist, start to finish.
- Primary CTA: Get a free listing audit (links to the enquiry form)
- Secondary CTA: See packages (scrolls to packages)

**Who we help** (two cards, each linking to its landing page)
- Stays and experiences: Holiday lets, glamping, B&Bs, guesthouses, activity providers and small venues. Show guests the real place before they arrive.
- Food and drink producers: Artisan producers, farm shops and makers. Product and process imagery that sells, on a site that takes orders.

**Why real photos** (three short points, no stats)
- Guests book on trust. Accurate images mean fewer surprises and better reviews.
- Your place is not generic. Stock and AI imagery cannot show your view, your rooms or your welcome.
- One local specialist means photos, film, website and Google profile all match, instead of four suppliers who never talk to each other.

**Process** (five steps)
1. Free listing audit: a short review of your photos, Google profile and booking page, with three quick wins.
2. Plan: agree the shot list, timing and what the site needs to do.
3. Shoot: on site, at your property, at the right light.
4. Build: a fast website with booking or ordering set up, and your Google Business Profile tidied.
5. Launch and care: go live, then keep it fresh through the seasons.

**About** (credential-led, keep short)
"10+ years building software. 5+ years shooting professionally. Horizon Vantage brings both to local businesses: real photography and film of your place, and the technical skill to turn it into a website that works. Based in Baltinglass, working across West Wicklow, Carlow and Kildare."

**FAQ**
- Do you use AI-generated images? No. Every image is shot at your property. Guests book on trust, so what they see should be what they get.
- What is a listing audit? A short, free review of your current photos, Google profile and booking page, with three quick wins. No obligation.
- Where do you work? Based in Baltinglass. I cover West Wicklow, Carlow and Kildare, and further by arrangement.
- How long does a project take? It depends on scope and season. We agree a timeline before we start.
- Are there grants for this? Some supports exist, for example through your Local Enterprise Office, but eligibility varies and nothing is guaranteed. Ask your LEO, and we will share what we know.

## 4. Packages (data file)

| id | name | from | includes | visible |
|---|---|---|---|---|
| launch | Booking-Ready Launch (flagship, highlight this one) | €2,400 | Half-day on-site shoot (25 to 40 edited images); 60 to 90 second property film plus 3 vertical social cuts; 5 to 8 page website with booking or ordering set up; Google Business Profile optimisation; 30-day check-in | true |
| refresh | Season Refresh | €450 | New imagery plus short social video each spring or autumn | true |
| care | Care & Visibility | €120 / month | Website care and hosting; monthly Google Business Profile posts; a quarterly photo drop; monthly enquiry and booking report | true |
| starter | Starter Website | €900 (placeholder, confirm) | Template-based small website | false |

Show "from" prices with the line: "Final quote after your free audit." Remove the old tier names (Visual Refresh, Growth Retainer, Visual Visibility, Complete Local Presence) and old prices everywhere.

## 5. Tasks (one commit each, in this order)

1. **Brand cleanup.** Find and replace the placeholder "Ready Frame Studio" with "Horizon Vantage" everywhere (grep visible text, meta, JSON-LD, manifest, alt text, footer, copyright). Remove any "one person" framing in About and footer. Footer: © Horizon Vantage and the current year, contact info@horizonvantage.ie.
2. **Data file.** Create the packages data file per section 4 and delete the old tier data.
3. **Hero and positioning.** Rewrite the hero per section 3. Keep existing animation style.
4. **New sections.** Who we help, Why real photos, Process, FAQ, using the copy above. Reuse existing components and scroll animations.
5. **Packages section.** Render from the data file. Highlight the Launch package. Respect `visible`.
6. **Landing pages.** Add `/stays-and-experiences` and `/food-and-drink`. Each has its own H1, a short intro, three outcome bullets, the relevant package, a FAQ subset and a CTA to the enquiry form. Link both from nav and the home page. No fake case studies.
7. **Enquiry form.** Keep the existing submission mechanism (Netlify Forms if already used). Rename the CTA to "Request a free listing audit". Fields: name, email, business name, business type (holiday let, glamping, B&B or guesthouse, activity provider, food and drink producer, other), town or area, website or listing URL (optional), message. Add a honeypot, validation and a clear success state.
8. **SEO and technical.**
   - Unique title (60 characters or fewer) and meta description (155 or fewer) per page. Suggested titles: Home "Horizon Vantage | Photo, Video & Websites in West Wicklow"; Stays "Holiday Let & Glamping Photography, West Wicklow"; Food "Food & Drink Producer Photography, Wicklow & Carlow".
   - One H1 per page, canonical URLs, Open Graph and Twitter tags, alt text on all images.
   - JSON-LD `ProfessionalService` with `areaServed` for the towns in section 2. Do NOT include a street address (service-area business).
   - Sitemap and robots.txt.
9. **Grants cleanup.** Grep for "Trading Online" and "TOV" and remove any references. Do not add claims that a grant will fund the client's website.
10. **QA.**
   - `npm run build` passes with no errors or warnings you introduced.
   - No console errors.
   - Checked at 375px width and desktop.
   - Reduced-motion behaves.
   - All links and anchors work.
   - Lighthouse mobile: performance 90 or higher, accessibility 95 or higher, SEO 95 or higher. Use Astro image handling and lazy loading.
   - Grep confirms no "Ready Frame Studio", "Trading Online", old tier names or old prices remain.

## 6. Definition of done

Everything is pushed to `dev1`, the Netlify deploy for `dev1` builds cleanly, and you reply with: a list of commits, anything you could not do and why, every place you had to guess, and a list of placeholders still needing real content (case studies, testimonials, real photos). Then stop. Do not merge.

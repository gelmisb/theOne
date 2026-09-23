# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners of small Irish businesses that aren't designers — cafés, salons, gyms, clinics, and trades, explicitly not corporates (Hero.astro: "Built for cafés, salons, gyms, clinics and trades - not corporates"). Two confirmed visitor situations:

- A new or rebranding business that needs a first website and real photography from scratch.
- An established business whose current site and photos look templated/stock and wants a real refresh.

## Product Purpose

On-site photography, videography, custom website design/build, and local SEO (Google Business Profile) setup for small Irish businesses, delivered by one person. The website is built around real, on-site photography of the actual business rather than a template filled with stock imagery. Success is a business that gets real photography, a site built around those specific images, and local search visibility — ideally leading into the Growth Retainer for ongoing content.

## Positioning

"I shoot it, then I build the site around it." The founder is both the photographer and the web developer (10+ years software engineering, 5+ years photography), so the site is built around real, on-site images of the actual business rather than commissioned separately from a template. Gap.astro states this explicitly as the site's own comparison: typical local web studios sell a templated layout + stock photography + a half-finished Google Business Profile; Horizon Vantage sells an on-site shoot + a custom-built site designed around those images + a fully set-up GBP, with an optional retainer for ongoing shoots. A studio that only builds sites, or a photographer who only shoots, can't truthfully copy this — it depends on one person doing both.

## Operating Context

- On-site shoots at the client's own premises across Ireland; registered/contact address is Wicklow, but the service area is Ireland generally, not a single town.
- Scope for each engagement is confirmed in a written quote/proposal before work begins; a 50% non-refundable deposit secures a booking.
- Growth Retainer is billed monthly in advance and continues until cancelled with 30 days' written notice.
- Contact intake runs through Contact.astro via Netlify Forms (`data-netlify="true"`) — functional today, no separate backend or CRM integration.
- Sole trader, registered with the Irish Companies Registration Office (CRO) under business name registration number SR9692490. Not currently VAT-registered.
- terms-of-service.md is the authoritative source for confirmed legal/commercial terms (deposits, rescheduling, cancellation, late payment).

## Capabilities and Constraints

Confirmed service tiers (Offer.astro):

- **Visual Refresh** — on-site photography package, €350–600.
- **Growth Retainer** — ongoing monthly content + SEO support, €75–150/mo.
- **Visual Visibility** — website design and build, €600–1,500.
- **Complete Local Presence** — combined photography, video, website, and SEO, €1,500–2,500.

Videography is a real, bookable service today (confirmed), not an aspirational one — the absence of demonstrated video content in the portfolio is a content gap to fill, not a scope limitation to hedge around in copy.

"Book a Founder Shoot" is the site's standing CTA language — not "consultation" or "discovery call."

## Brand Commitments

- Name: **Horizon Vantage** — final and registered, not a placeholder.
- Tagline: "See Further. Show It Better."
- Contact: info@horizonvantage.ie · https://horizonvantage.ie
- Real photography is a binding, non-negotiable claim: no stock photography and no AI-generated imagery presented as real client work, anywhere on the site.
- The founder's dual background (10+ years software engineering, 5+ years photography) is an explicit trust signal the site keeps visible, not just origin-story backstory.

## Evidence on Hand

- Real client photos: 3 of the 5 files in `src/assets/photos/portfolio/` are real, non-generated shoots (`Barbershops.jpg`, `consumables.jpg`, `product advertisement.jpg`). The other 2 are AI-generated placeholders, tracked via `Portfolio.astro`'s `GENERATED_FILES` set — future work must not present these as authentic client work, and should replace them with real shoots as they become available.
- A real Grafton Barbers shoot exists outside the repo (`D:\Photos\Edited\Events\Grafton Barbers - J6`), rights-cleared generally for reuse in Horizon Vantage's own marketing. A signed release is still required before any specific photo from it is used in a prominent/hero placement. Every currently-sampled photo from that shoot shows visible COVID-era face masks, which dates them — a fresh shoot is preferable before wider use.
- No real client testimonials or completed website case studies exist yet. The Web Projects page currently ships as a scaffold with placeholder entries pending real project data.
- No demonstrated video portfolio yet, despite Video being a real offered service (see Capabilities and Constraints) — this is a content gap, not a feature to downplay.

## Product Principles

1. Real photography is the central claim. No stock, no AI-generated imagery presented as finished evidence anywhere client-facing; any placeholder must read as clearly transitional.
2. The site is held to the same standard it's selling — since the pitch is "a real website built around real photos of your business," the site's own execution is itself part of the proof.
3. Speak directly to non-designer small-business owners (cafés, salons, gyms, clinics, trades). Avoid agency-internal jargon; keep a "what this means for my business" framing.
4. One person does both the photography and the build. Keep that dual-skillset story visible as a differentiator, not buried as backstory.
5. Every real photo of an identifiable person or business needs a confirmed rights/reuse trail before it ships in new marketing, independent of general copyright ownership.

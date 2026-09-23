---
name: Horizon Vantage
description: On-site photography, videography, web design, and local SEO for small Irish businesses — real photos, not stock, with a real website built around them.
colors:
  bg: "#0A0E13"
  panel: "#12181F"
  panel-2: "#1A2029"
  paper: "#EAF2F8"
  paper-dim: "#9FB1C2"
  brass: "#E6C468"
  brass-light: "#F3DD9A"
  brass-dim: "#A3822F"
  safelight: "#E8975A"
  line: "rgba(234,242,248,0.14)"
  line-strong: "rgba(234,242,248,0.26)"
typography:
  display:
    fontFamily: "Montserrat, serif"
    fontWeight: 400
  body:
    fontFamily: "Inter, sans-serif"
  label:
    fontFamily: "IBM Plex Mono, monospace"
    letterSpacing: "0.06em"
  accent-serif:
    fontFamily: "Instrument Serif, serif"
rounded:
  sm: "2px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "15px 28px"
  button-primary-hover:
    backgroundColor: "{colors.brass-light}"
  button-ghost:
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "15px 28px"
  glass-panel:
    backgroundColor: "rgba(26,32,41,0.55)"
    rounded: "{rounded.lg}"
    padding: "32px"
---

# Design System: Horizon Vantage

## Overview

**Creative North Star: "The Darkroom Ledger"**

Horizon Vantage's site reads like a photography darkroom crossed with a precise engineering logbook — which is literally who built it: one person with 10+ years of software engineering and 5+ years behind the camera. Everything sits on near-black ink navy, lit by two signals borrowed straight from a darkroom: warm brass (the accent that carries value — CTAs, prices, the wordmark's italic half) and a dimmer safelight amber (reserved exclusively for "this is live" markers — the REC dot, the frame-tag indicator — never used on text or buttons). Structure is stated in mono-labelled, uppercase frame tags ("FRAME 001", "TIER 02") the way a contact sheet or a lab notebook numbers its entries.

The system is flat and sharp at rest — thin hairline borders, near-flush 2px corners — and turns to frosted glass only when something is floating above the page: the header once you've scrolled past Hero, the stat strip, the featured pricing tier, the contact form. That's a deliberate signal, not decoration: glass means "this surface is doing something," flat means "this is just content." Real, on-site photography is the whole premise, so photography motifs aren't skin-deep ornament — sprocket-hole dividers, viewfinder corner brackets, a contact-sheet frame grid, and a working film-strip intro are structural, load-bearing parts of the page, not one-off flourishes.

**Key Characteristics:**
- Near-black ink navy base, lit by exactly two accents: brass (value/action) and safelight amber (live/active signal only).
- Flat and sharp by default; glass/frosted surfaces appear only on floating or scroll-activated elements.
- Everything structural is mono-labelled and numbered, like frames on a contact sheet.
- Photography/darkroom motifs (sprockets, viewfinder brackets, frame tags, film grain) are structural components, not decoration.
- No stock photography, no AI-generated imagery presented as real — the visual system's central and non-negotiable rule (see PRODUCT.md).

## Colors

Two accents on a cool, near-black ground: warm brass carries value and action, a dimmer amber is reserved strictly for "live" signals.

### Primary
- **Brass** (`#E6C468`): the site's one consistent accent — primary buttons, the wordmark's italic half, prices, section-heading accent words, frame-tag labels, focus rings. If something is interactive or carries value, it's brass.
- **Brass Light** (`#F3DD9A`): primary-button hover only.
- **Brass Dim** (`#A3822F`): defined as a deeper step in the brass ramp; not currently used by any component. Reserve it for a pressed/active state rather than introducing a new accent hue.

### Secondary
- **Safelight Amber** (`#E8975A`): a literal darkroom-safelight reference, used exclusively as a small glowing dot — the Hero "REC" indicator and the frame-tag's leading marker. **The Live-Signal Rule.** Safelight amber never appears on text, buttons, or large surfaces — it marks "this is live/active" and nothing else.

### Neutral
- **Darkroom Black** (`#0A0E13`): page background.
- **Panel** (`#12181F`): default card/section-panel background (pricing tiers, resting surfaces).
- **Panel Deep** (`#1A2029`): the featured/"core" pricing tier's background — one step lighter than Panel, reserved for the single emphasized card on the page.
- **Proof Paper** (`#EAF2F8`): primary text — a cool, slightly blue white rather than a pure one, like light through photographic paper.
- **Faded Proof** (`#9FB1C2`): secondary/dimmed text (sub-copy, labels, captions).
- **Hairline** (`rgba(234,242,248,0.14)`) / **Hairline Strong** (`rgba(234,242,248,0.26)`): borders and dividers, translucent against the dark ground rather than a flat gray.

### Named Rules
**The One-Accent Rule.** Brass is the only accent used for value, action, or emphasis anywhere on the site. There is no second competing "brand color" — variety comes from brass's own light/dim steps, never a new hue.

## Typography

**Display Font:** Montserrat (with generic serif fallback)
**Body Font:** Inter (with sans-serif fallback)
**Label/Mono Font:** IBM Plex Mono (with generic monospace fallback)
**Secondary Accent Serif:** Instrument Serif — used narrowly (Footer, one Gap comparison-card heading), not a primary hierarchy role.

**Character:** A geometric, faintly humanist display serif (Montserrat, weight 400 only, its italic reserved for the brass-accented word inside a heading) over a plain, highly legible body sans (Inter) and a uniformly uppercase, letter-spaced mono for every label, tag, price, and button — the pairing reads as "considered headline, plain-spoken body, precisely labelled everything else," matching the darkroom-ledger character.

### Hierarchy
- **Display** (400, `clamp(40px, 8vw, 96px)` down to `clamp(32px, 4vw, 50px)` depending on role, line-height ~1–1.08): the wordmark and every H2 section heading. Its accent word/phrase is always italic and brass.
- **Body** (400, 15–19px, line-height 1.5–1.65): paragraph copy (`.section-sub`, card descriptions).
- **Label** (400–500, 10–14px, letter-spacing 0.04–0.14em, uppercase): navigation, buttons, frame tags, EXIF-style captions, form labels, prices, badges — always IBM Plex Mono.

### Named Rules
**The Mono Label Rule.** IBM Plex Mono is reserved exclusively for short, uppercase, letter-spaced labels — navigation, buttons, tags, prices, captions. It never sets body copy or a heading. If text is mono, it's structural metadata, not prose.

## Layout

No formal spacing-token scale exists in the codebase (no `--spacing-*` custom properties) — rhythm is set by consistent, repeated ad-hoc values rather than named steps:

- Content is capped at `.wrap { max-width: 1180px }`, with 32px side padding (20px under 640px).
- Sections default to 110px vertical padding (70px under 640px) via a bare `section { padding }` rule — every section shares this rhythm unless it opts out.
- Card grids use small, tight gaps (14–20px) rather than generous whitespace between siblings — density comes from tight card gaps against generous section padding, not uniform spacing everywhere.
- Two-column layouts (pricing tiers, comparison cards) collapse to one column between 640–760px; form row-pairs collapse under 560px.

## Elevation & Depth

Hybrid: flat by default, glass only as a floating-state signal. Most surfaces (default pricing tiers, comparison cards, the base header) carry no shadow at all — depth comes from a 1px hairline border against the dark ground, not elevation. Frosted "glass" surfaces (`backdrop-filter: blur(20px) saturate(1.7)`, translucent panel fill, soft ambient shadow) are reserved specifically for elements that are floating above other content or responding to a scroll/interaction state: the header once scrolled past Hero, the Hero stat strip, the featured pricing tier, the About panel, the contact form.

### Shadow Vocabulary
- **Glass ambient** (`box-shadow: 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07-0.08)`): the one shadow recipe in the system, applied only to glass surfaces — a soft drop shadow plus a faint inner top highlight suggesting a frosted pane catching light.

### Named Rules
**The Scroll-State Glass Rule.** A surface only becomes glass when it's floating or responding to state — never as a static decorative choice on resting content. The header is the clearest example: flat and transparent at the top of the page, and only gains its glass pill treatment once `.scrolled` is toggled by scroll position.

## Shapes

Sharp and near-flush by default (`--radius: 2px`, effectively square corners) on buttons, form fields, and default cards. A much larger, deliberately soft `--radius: 20px` is reserved exclusively for glass/floating surfaces — the corner radius itself is part of the "this is elevated" signal, not an independent styling choice. Full circles (999px/50%) mark small live-status elements: the eyebrow pill, the REC dot, scroll-nav dots, portfolio play buttons.

### Named Rules
**The Diagonal Corner Rule.** The signature pricing badge doesn't use the full glass radius — it's rounded only on two opposite corners (`border-radius: 0 20px 0 20px`), a ribbon-like accent shape reserved for callout badges, distinct from every other rounded surface in the system.

## Components

### Buttons
- **Shape:** near-flush (2px radius).
- **Primary:** brass fill, ink-navy text, uppercase mono label, 15px/28px padding. Lifts 2px and lightens to Brass Light on hover.
- **Ghost:** transparent fill, Hairline Strong border, Proof Paper text; on hover the border and text both shift to brass and it lifts 2px, matching Primary's motion without its fill.
- Focus state on both: a 2px brass outline, 3px offset — the same accent color as hover, not a separate focus color.

### Glass Panels (signature surface)
- **Corner style:** 20px radius, always.
- **Fill:** `rgba(26,32,41,0.55)` with `backdrop-filter: blur(20px) saturate(1.7)`; a plain, more opaque dark fallback when `backdrop-filter` isn't supported.
- **Border:** 1px `rgba(234,242,248,0.16)`.
- **Shadow:** the Glass Ambient recipe above.
- Used for: the scrolled header, Hero's stat strip, the featured pricing tier, the About panel, the contact form.

### Pricing Tiers
- **Default:** Panel background, Hairline border, 38px/32px padding, no radius. Lifts 4px on hover, border brightens to Hairline Strong.
- **Featured ("core"):** Panel Deep background, brass border, lifts 6px on hover; the "core.glass" variant additionally takes the full Glass Panel treatment tinted blue (`rgba(44,110,156,0.22)`) rather than the neutral glass fill — the one place glass gets a color cast instead of neutral dark.
- **Badge:** brass fill, ink-navy uppercase mono text, the Diagonal Corner shape.

### Inputs / Fields
- **Style:** ink-navy (`--bg`) fill, Hairline Strong border, 2px radius, Inter body text, 13px/14px padding.
- **Focus:** border shifts to brass, no glow or outline.
- **Labels:** always mono, uppercase, Faded Proof colored, sit above the field.

### Navigation
- Flat and transparent at rest; becomes a glass pill (see Elevation) once scrolled past Hero, with tighter internal padding to read as "compact utility bar" instead of "hero-scale header."
- Links are mono, uppercase, Faded Proof at rest, brightening on hover/active — no underline.

### Sprockets (signature component)
A thin horizontal strip of small brass dots on a repeating radial-gradient pattern, styled after 35mm film sprocket holes. Used as a divider between every major section, alternating full opacity (light backgrounds) and a dimmer `.dark` variant — described in its own CSS comment as this system's "signature texture."

### Frame Tag (signature component)
A small glowing safelight dot + a mono, uppercase "FRAME 00N" label, used to number section headers the way a contact sheet numbers its frames. Its own CSS comment calls it out as this system's "signature element" — every section head that uses it should keep the numbering sequential and the dot glow (`box-shadow: 0 0 8px 1px rgba(224,141,75,0.6)`) intact.

## Do's and Don'ts

### Do:
- **Do** keep brass as the only value/action accent — new emphasis comes from its light/dim steps, not a new hue.
- **Do** reserve Safelight Amber strictly for small "this is live" markers (dots), never text, fills, or buttons.
- **Do** set IBM Plex Mono only on short, uppercase, letter-spaced labels/tags/buttons — never body copy or headings.
- **Do** reserve the 20px glass radius and `backdrop-filter` treatment for floating/scroll-state surfaces; default content stays flat with a hairline border.
- **Do** treat sprockets and frame tags as structural, load-bearing components (they're explicitly named "signature" in the codebase) — reuse them for new sections rather than inventing a new divider or numbering style.

### Don't:
- **Don't** introduce a second brand accent color; variety comes from brass's own steps.
- **Don't** apply glass/blur to a resting, non-floating surface "for polish" — it's a state signal, not a texture.
- **Don't** use stock photography or AI-generated imagery anywhere client-facing; this system's central premise is real, on-site photos (see PRODUCT.md's Evidence on Hand for which existing assets are placeholders, not real work).
- **Don't** give buttons, cards, or form fields anything above the 2px sharp radius — large rounding is reserved exclusively for the glass-surface signal.

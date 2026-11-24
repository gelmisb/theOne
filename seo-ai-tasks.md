# Task: Technical SEO & AI Discoverability - Horizon Vantage

## Context
- Astro + GSAP/ScrollTrigger site, repo `gelmisb/theOne`, working branch `dev1`
- Deployed on Netlify, live at `https://horizonvantage.ie`
- Business: Horizon Vantage - photography, videography, website dev, and local SEO for Irish SMBs, based in Co. Wicklow

## Guardrails (do not violate)
- Do not touch: `Welcome.astro`, `.gitignore`, `package-lock.json`, or the `name` field in `package.json` - these are flagged separately and out of scope for this task.
- Stay on branch `dev1`. Commit in small logical increments (one feature/file group per commit), not one giant commit.
- Remove any debug markers/console logs added during work before committing.
- Respect existing `prefers-reduced-motion` handling - do not regress accessibility on the GSAP/ScrollTrigger animations while working nearby.
- Before finalizing anything with the business name, grep the codebase for the leftover placeholder `"Ready Frame Studio"` and flag any instance found - it must not end up in metadata, schema, or copy alongside the real name "Horizon Vantage".

## Tasks

### 1. Sitemap
- Add the `@astrojs/sitemap` integration.
- Set `site: 'https://horizonvantage.ie'` in `astro.config.mjs`.
- Confirm `sitemap-index.xml` generates correctly on `astro build`.

### 2. robots.txt
- Create/update `public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://horizonvantage.ie/sitemap-index.xml
```

### 3. LocalBusiness JSON-LD schema
- Create `src/components/LocalBusinessSchema.astro` with a `MarketingAgency` JSON-LD block (name, url, email, areaServed: IE, address region Wicklow/IE, `makesOffer` listing photography/videography, website development, and local SEO as services).
- Import and render it once in the shared base layout `<head>`.
- The `name` field must exactly match the Google Business Profile listing: **"Horizon Vantage"**.

### 4. Per-page meta
- Confirm the base layout accepts `title` and `description` props and renders: `<title>`, `<meta name="description">`, `<link rel="canonical">`, and Open Graph tags (`og:title`, `og:description`, `og:url`, `og:image`).
- Audit every existing page/route and ensure each has a unique, real title and description (flag any still using placeholder or duplicate copy).

### 5. llms.txt
- Create `public/llms.txt`:
```markdown
# Horizon Vantage
> Photography, videography, website development, and local SEO for Irish SMBs, based in Co. Wicklow.

## Services
- Website development
- Photography & videography
- Local SEO
```
(Low priority, low effort - do after 1–4.)

### 6. Animation crawler-visibility check
- Review GSAP/ScrollTrigger entrance animations for any content that starts at `opacity: 0` / `visibility: hidden` in a way that could leave meaningful text absent from the initial server-rendered HTML.
- Report any instance found; don't change animation behavior without confirmation - this is a check/flag step, not an automatic rewrite.

### 7. Verify before marking done
- `astro build` succeeds with no new errors/warnings.
- `sitemap-index.xml` and `robots.txt` are reachable locally.
- JSON-LD validates in Google's Rich Results Test.
- No leftover "Ready Frame Studio" references introduced or left in touched files.
- Summarize what changed, file by file, at the end.

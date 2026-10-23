// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Astro keeps `<!-- ... -->` comments from templates in the built HTML, so
// this repo's long developer notes (file names, "found during..." backstory,
// brief references) were being served to every visitor and crawler - 4-11% of
// a page's bytes. This strips them from the build output only; the comments
// stay in the source. <script>, <style>, <pre> and <textarea> bodies are left
// alone in case a "<!--" appears inside them as real content.
/** @type {import('astro').AstroIntegration} */
const stripHtmlComments = {
  name: 'strip-html-comments',
  hooks: {
    'astro:build:done': ({ dir }) => {
      /** @param {string} d @returns {string[]} */
      const htmlFiles = (d) =>
        fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(d, e.name);
          if (e.isDirectory()) return htmlFiles(p);
          return e.name.endsWith('.html') ? [p] : [];
        });

      const protectedOrComment =
        /(<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\2>)|<!--(?!\[if)[\s\S]*?-->/gi;

      for (const file of htmlFiles(fileURLToPath(dir))) {
        const html = fs.readFileSync(file, 'utf8');
        const out = html.replace(protectedOrComment, (match, protectedBlock) => protectedBlock ?? '');
        if (out !== html) fs.writeFileSync(file, out);
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://horizonvantage.ie',
  // /analytics/ is a private owner dashboard: noindex, and kept out of the sitemap too.
  integrations: [sitemap({ filter: (page) => !page.includes('/analytics') }), stripHtmlComments],
});

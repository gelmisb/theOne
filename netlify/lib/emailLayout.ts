// Shared building blocks for Horizon Vantage's transactional emails
// (enquiry confirmation, newsletter welcome). Email clients ignore most CSS, so
// everything is table-based with inline styles, a fixed 600px column and
// absolute image URLs. Colours match the site (near-black navy + brass).
export const SITE = 'https://horizonvantage.ie';
export const LOGO = `${SITE}/email-logo.png`;
export const PHONE_DISPLAY = '+353 89 493 9050';
export const PHONE_LINK = '+353894939050';
export const EMAIL = 'info@horizonvantage.ie';
export const INSTAGRAM = 'https://instagram.com/horizonvantage';

export const BG = '#0a0e13';
export const PANEL = '#121820';
export const BRASS = '#e6c468';
export const PAPER = '#f3efe6';
export const DIM = '#a9b0b8';
export const LINE = '#26303b';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const eyebrow = (text: string, margin = '0 0 12px') =>
  `<div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin:${margin};">${text}</div>`;

/** A numbered/bulleted row used for "what happens next" / "what to expect" lists. */
export function stepsTable(items: [string, string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${items
        .map(
          ([n, t, d]) => `<tr>
        <td valign="top" width="36" style="padding:0 0 14px;"><div style="width:26px;height:26px;line-height:26px;border:1px solid ${BRASS};border-radius:50%;text-align:center;font-size:13px;color:${BRASS};">${n}</div></td>
        <td valign="top" style="padding:0 0 14px;"><div style="font-size:15px;font-weight:bold;color:${PAPER};margin-bottom:2px;">${t}</div><div style="font-size:14px;line-height:1.55;color:${DIM};">${d}</div></td>
      </tr>`
        )
        .join('')}
    </table>`;
}

export const button = (href: string, label: string, primary = true) =>
  `<a href="${href}" style="display:inline-block;${
    primary ? `background:${BRASS};color:${BG};` : `border:1px solid ${BRASS};color:${BRASS};`
  }font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:999px;margin:0 4px 8px;">${label}</a>`;

export const contactBlock = () => `<tr><td style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};"><tr><td style="padding-top:20px;font-size:14px;line-height:1.9;color:${DIM};">
      ${eyebrow('Get in touch', '0 0 6px')}
      Email: <a href="mailto:${EMAIL}" style="color:${PAPER};">${EMAIL}</a><br>
      Phone: <a href="tel:${PHONE_LINK}" style="color:${PAPER};">${PHONE_DISPLAY}</a><br>
      Web: <a href="${SITE}/" style="color:${PAPER};">horizonvantage.ie</a><br>
      Instagram: <a href="${INSTAGRAM}" style="color:${PAPER};">@horizonvantage</a>
    </td></tr></table>
  </td></tr>`;

export const textContact = [
  'GET IN TOUCH',
  `Email: ${EMAIL}`,
  `Phone: ${PHONE_DISPLAY}`,
  `Web: ${SITE}/`,
  `Instagram: ${INSTAGRAM}`,
];

export const REGISTRATION = 'Horizon Vantage - sole trader, registered with the Companies Registration Office (Ireland), number SR9692490. Co. Wicklow, Ireland.';

/**
 * Wraps body rows (each a `<tr><td>...</td></tr>`) in the branded shell:
 * logo + wordmark header at the top, `footerHtml` in the small-print footer.
 */
export function shell(opts: { title: string; preheader: string; bodyRows: string; footerHtml: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${PANEL};border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:${PAPER};">

  <tr><td align="center" style="padding:32px 24px 8px;">
    <img src="${LOGO}" width="84" height="74" alt="Horizon Vantage" style="display:block;border:0;outline:none;width:84px;height:auto;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.1;margin-top:12px;color:${PAPER};"><i style="color:${BRASS};">Horizon</i> Vantage</div>
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin-top:8px;">See further. Show it better.</div>
  </td></tr>

  ${opts.bodyRows}

  <tr><td style="padding:20px 32px 28px;font-size:12px;line-height:1.6;color:#7d858e;">
    ${opts.footerHtml}
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

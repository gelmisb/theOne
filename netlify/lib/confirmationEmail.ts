// Branded confirmation email sent to the visitor after a contact-form enquiry
// (see netlify/functions/enquiry.ts). Email clients ignore most CSS, so this
// is table-based with inline styles, a fixed 600px column, and absolute image
// URLs. Colours match the site (near-black navy + brass).
const SITE = 'https://horizonvantage.ie';
const LOGO = `${SITE}/email-logo.png`;
const PHONE_DISPLAY = '+353 89 493 9050';
const PHONE_LINK = '+353894939050';
const EMAIL = 'info@horizonvantage.ie';
const INSTAGRAM = 'https://instagram.com/horizonvantage';

const BG = '#0a0e13';
const PANEL = '#121820';
const BRASS = '#e6c468';
const PAPER = '#f3efe6';
const DIM = '#a9b0b8';
const LINE = '#26303b';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface EnquirySummaryRow {
  label: string;
  value: string;
}

const steps = [
  ['1', 'We look at your business', 'We review your website and Google listing (if you have them) before we reply, so the first message is useful, not generic.'],
  ['2', 'You get a reply within one business day', 'A personal reply from the founder with a few questions, or a suggested time for a short call.'],
  ['3', 'Your free listing audit', 'A plain-English rundown of what is working, what is holding you back, and what we would fix first. No obligation, no pitch.'],
];

export function buildConfirmationEmail(name: string, rows: EnquirySummaryRow[]) {
  const first = name.split(/\s+/)[0] || name;
  const summary = rows.filter((r) => r.value);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>Thanks for your enquiry - Horizon Vantage</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">We have your enquiry and will reply within one business day.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${PANEL};border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:${PAPER};">

  <tr><td align="center" style="padding:32px 24px 8px;">
    <img src="${LOGO}" width="84" height="74" alt="Horizon Vantage" style="display:block;border:0;outline:none;width:84px;height:auto;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.1;margin-top:12px;color:${PAPER};"><i style="color:${BRASS};">Horizon</i> Vantage</div>
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin-top:8px;">See further. Show it better.</div>
  </td></tr>

  <tr><td style="padding:24px 32px 0;">
    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${PAPER};">Thanks, ${esc(first)} - your enquiry is in.</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${DIM};">We have your details and will reply <strong style="color:${PAPER};">within one business day</strong> (Monday to Friday, excluding Irish public holidays). If it is urgent, call or email us directly using the details below.</p>
  </td></tr>

  <tr><td style="padding:8px 32px 0;">
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin:0 0 12px;">What happens next</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${steps
        .map(
          ([n, t, d]) => `<tr>
        <td valign="top" width="36" style="padding:0 0 14px;"><div style="width:26px;height:26px;line-height:26px;border:1px solid ${BRASS};border-radius:50%;text-align:center;font-size:13px;color:${BRASS};">${n}</div></td>
        <td valign="top" style="padding:0 0 14px;"><div style="font-size:15px;font-weight:bold;color:${PAPER};margin-bottom:2px;">${t}</div><div style="font-size:14px;line-height:1.55;color:${DIM};">${d}</div></td>
      </tr>`
        )
        .join('')}
    </table>
  </td></tr>

  ${
    summary.length
      ? `<tr><td style="padding:8px 32px 0;">
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin:0 0 10px;">What you sent us</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;">
      ${summary
        .map(
          (r, i) => `<tr><td valign="top" width="38%" style="padding:10px 14px;font-size:13px;color:${DIM};${i ? `border-top:1px solid ${LINE};` : ''}">${esc(r.label)}</td><td valign="top" style="padding:10px 14px;font-size:14px;line-height:1.5;color:${PAPER};${i ? `border-top:1px solid ${LINE};` : ''}">${esc(r.value).replace(/\n/g, '<br>')}</td></tr>`
        )
        .join('')}
    </table>
    <p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:${DIM};">Forgot something? Just reply to this email and it goes straight to the founder.</p>
  </td></tr>`
      : ''
  }

  <tr><td align="center" style="padding:28px 32px 8px;">
    <a href="${SITE}/" style="display:inline-block;background:${BRASS};color:${BG};font-size:14px;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:999px;">See our work</a>
  </td></tr>

  <tr><td style="padding:24px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};"><tr><td style="padding-top:20px;font-size:14px;line-height:1.9;color:${DIM};">
      <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRASS};margin-bottom:6px;">Get in touch</div>
      Email: <a href="mailto:${EMAIL}" style="color:${PAPER};">${EMAIL}</a><br>
      Phone: <a href="tel:${PHONE_LINK}" style="color:${PAPER};">${PHONE_DISPLAY}</a><br>
      Web: <a href="${SITE}/" style="color:${PAPER};">horizonvantage.ie</a><br>
      Instagram: <a href="${INSTAGRAM}" style="color:${PAPER};">@horizonvantage</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 32px 28px;font-size:12px;line-height:1.6;color:#7d858e;">
    You are getting this because you sent an enquiry through horizonvantage.ie. We will only use your details to reply to you - see our <a href="${SITE}/privacy/" style="color:#7d858e;">Privacy Policy</a>. This is not a marketing email, and you will not be added to a mailing list unless you ask.<br><br>
    Horizon Vantage - sole trader, registered with the Companies Registration Office (Ireland), number SR9692490. Co. Wicklow, Ireland.
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Thanks, ${first} - your enquiry is in.`,
    '',
    'We have your details and will reply within one business day (Monday to Friday, excluding Irish public holidays). If it is urgent, call or email us directly.',
    '',
    'WHAT HAPPENS NEXT',
    ...steps.map(([n, t, d]) => `${n}. ${t} - ${d}`),
    '',
    ...(summary.length ? ['WHAT YOU SENT US', ...summary.map((r) => `${r.label}: ${r.value}`), '', 'Forgot something? Just reply to this email.', ''] : []),
    'GET IN TOUCH',
    `Email: ${EMAIL}`,
    `Phone: ${PHONE_DISPLAY}`,
    `Web: ${SITE}/`,
    `Instagram: ${INSTAGRAM}`,
    '',
    `You are getting this because you sent an enquiry through horizonvantage.ie. We only use your details to reply to you - Privacy Policy: ${SITE}/privacy/`,
    'Horizon Vantage - sole trader, CRO number SR9692490, Co. Wicklow, Ireland.',
  ].join('\n');

  return { html, text };
}

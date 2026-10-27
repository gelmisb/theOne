// Branded confirmation email sent to the visitor after a contact-form enquiry
// (see netlify/functions/enquiry.ts). Layout pieces live in ./emailLayout.
import {
  BRASS, BG, DIM, LINE, PAPER, SITE, REGISTRATION, EMAIL, INSTAGRAM, PHONE_DISPLAY,
  button, contactBlock, esc, eyebrow, shell, stepsTable, textContact,
} from './emailLayout';

export interface EnquirySummaryRow {
  label: string;
  value: string;
}

const steps: [string, string, string][] = [
  ['1', 'We look at your business', 'We review your website and Google listing (if you have them) before we reply, so the first message is useful, not generic.'],
  ['2', 'You get a reply within one business day', 'A personal reply from the founder with a few questions, or a suggested time for a short call.'],
  ['3', 'Your free listing audit', 'A plain-English rundown of what is working, what is holding you back, and what we would fix first. No obligation, no pitch.'],
];

export function buildConfirmationEmail(name: string, rows: EnquirySummaryRow[]) {
  const first = name.split(/\s+/)[0] || name;
  const summary = rows.filter((r) => r.value);

  const bodyRows = `
  <tr><td style="padding:24px 32px 0;">
    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${PAPER};">Thanks, ${esc(first)} - your enquiry is in.</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${DIM};">We have your details and will reply <strong style="color:${PAPER};">within one business day</strong> (Monday to Friday, excluding Irish public holidays). If it is urgent, call or email us directly using the details below.</p>
  </td></tr>

  <tr><td style="padding:8px 32px 0;">
    ${eyebrow('What happens next')}
    ${stepsTable(steps)}
  </td></tr>

  ${
    summary.length
      ? `<tr><td style="padding:8px 32px 0;">
    ${eyebrow('What you sent us', '0 0 10px')}
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
    ${button(`${SITE}/`, 'See our work')}
  </td></tr>

  ${contactBlock()}`;

  const html = shell({
    title: 'Thanks for your enquiry - Horizon Vantage',
    preheader: 'We have your enquiry and will reply within one business day.',
    bodyRows,
    footerHtml: `You are getting this because you sent an enquiry through horizonvantage.ie. We will only use your details to reply to you - see our <a href="${SITE}/privacy/" style="color:#7d858e;">Privacy Policy</a>. This is not a marketing email, and you will not be added to a mailing list unless you ask.<br><br>${REGISTRATION}`,
  });

  const text = [
    `Thanks, ${first} - your enquiry is in.`,
    '',
    'We have your details and will reply within one business day (Monday to Friday, excluding Irish public holidays). If it is urgent, call or email us directly.',
    '',
    'WHAT HAPPENS NEXT',
    ...steps.map(([n, t, d]) => `${n}. ${t} - ${d}`),
    '',
    ...(summary.length ? ['WHAT YOU SENT US', ...summary.map((r) => `${r.label}: ${r.value}`), '', 'Forgot something? Just reply to this email.', ''] : []),
    ...textContact,
    '',
    `You are getting this because you sent an enquiry through horizonvantage.ie. We only use your details to reply to you - Privacy Policy: ${SITE}/privacy/`,
    'Horizon Vantage - sole trader, CRO number SR9692490, Co. Wicklow, Ireland.',
  ].join('\n');

  return { html, text };
}

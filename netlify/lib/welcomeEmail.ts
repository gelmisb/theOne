// Branded welcome email for new newsletter subscribers (see
// netlify/functions/subscribe.ts). Layout pieces live in ./emailLayout.
import {
  BRASS, DIM, PAPER, SITE, REGISTRATION, button, contactBlock, eyebrow, shell, stepsTable, textContact,
} from './emailLayout';

const expect: [string, string, string][] = [
  ['1', 'New work', 'Fresh shoots, websites and projects for local businesses across Wicklow and beyond.'],
  ['2', 'Practical ideas', 'Plain-English tips on photos, Google listings and getting found locally.'],
  ['3', 'Occasional offers', 'First notice of founder-shoot slots and packages when they open up.'],
];

export function buildWelcomeEmail() {
  const bodyRows = `
  <tr><td style="padding:24px 32px 0;">
    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${PAPER};">You're on the list.</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${DIM};">Thanks for signing up. We will email you <strong style="color:${PAPER};">occasionally - no fixed schedule, never spam</strong> - and every newsletter has an unsubscribe link.</p>
  </td></tr>

  <tr><td style="padding:8px 32px 0;">
    ${eyebrow('What to expect')}
    ${stepsTable(expect)}
  </td></tr>

  <tr><td style="padding:4px 32px 0;">
    <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:${DIM};">Thinking about a shoot or a website? Reply to this email and it reaches the founder directly - or start with a free listing audit.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${DIM};">Tip: if this landed in Gmail's Promotions tab, drag it to Primary so you don't miss what comes next.</p>
  </td></tr>

  <tr><td align="center" style="padding:24px 32px 8px;">
    ${button(`${SITE}/contact/`, 'Get a free listing audit')}${button(`${SITE}/`, 'See our work', false)}
  </td></tr>

  ${contactBlock()}`;

  const html = shell({
    title: "You're on the list - Horizon Vantage",
    preheader: 'Thanks for signing up. Here is what to expect from us.',
    bodyRows,
    footerHtml: `You are getting this because you signed up for updates at horizonvantage.ie. You can unsubscribe at any time using the link in any newsletter we send, or just reply and tell us. See our <a href="${SITE}/privacy/" style="color:#7d858e;">Privacy Policy</a> for how we use your details.<br><br>${REGISTRATION}`,
  });

  const text = [
    "You're on the list.",
    '',
    'Thanks for signing up. We will email you occasionally - no fixed schedule, never spam - and every newsletter has an unsubscribe link.',
    '',
    'WHAT TO EXPECT',
    ...expect.map(([n, t, d]) => `${n}. ${t} - ${d}`),
    '',
    'Thinking about a shoot or a website? Reply to this email and it reaches the founder directly, or start with a free listing audit: ' + `${SITE}/contact/`,
    '',
    "Tip: if this landed in Gmail's Promotions tab, drag it to Primary so you don't miss what comes next.",
    '',
    ...textContact,
    '',
    `You are getting this because you signed up for updates at horizonvantage.ie. Unsubscribe any time using the link in any newsletter, or reply and tell us. Privacy Policy: ${SITE}/privacy/`,
    'Horizon Vantage - sole trader, CRO number SR9692490, Co. Wicklow, Ireland.',
  ].join('\n');

  return { html, text };
}

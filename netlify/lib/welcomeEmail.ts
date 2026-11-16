// Branded welcome email for new newsletter subscribers (see
// netlify/functions/subscribe.ts), sent the moment they sign up. It says who we
// are and what we do, and gives the subscriber code they can quote in an email
// enquiry. Layout pieces live in ./emailLayout; the code and the current offer
// come from src/data/offers.ts.
import { isOfferActive, offerEndLabel, salePrice, seasonalOffer, subscriberOffer } from '../../src/data/offers';
import {
  BRASS, DIM, EMAIL, PAPER, SITE, REGISTRATION, button, codeBox, contactBlock, eyebrow, shell, stepsTable, textContact,
} from './emailLayout';

const whatWeDo: [string, string, string][] = [
  ['1', 'Photography', 'On-site photos of your business, shot where you work - never stock, never AI-generated.'],
  ['2', 'Video', 'Short vertical clips and promo film, shot alongside the photography.'],
  ['3', 'Websites', 'Fast, custom-built sites designed around your own photos.'],
  ['4', 'Local SEO', 'Your Google Business Profile set up and tidied so people can find and choose you.'],
];

export function buildWelcomeEmail() {
  const code = subscriberOffer.code;
  const subject = encodeURIComponent(`Enquiry - subscriber code ${code}`);
  const body = encodeURIComponent(`Hi,\n\nMy subscriber code is ${code}. I'd like ${subscriberOffer.benefit}.\n\nBusiness name:\nWhat I'm after:\n`);
  const mailto = `mailto:${EMAIL}?subject=${subject}&body=${body}`;

  const offerActive = isOfferActive();
  const offerLine = `Right now: ${seasonalOffer.discountPercent}% off the ${seasonalOffer.name} (${seasonalOffer.season} photography) - from €${salePrice}. ${offerEndLabel()}.`;

  const bodyRows = `
  <tr><td style="padding:24px 32px 0;">
    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${PAPER};">You're on the list.</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${DIM};">Thanks for signing up to Horizon Vantage. We're a one-person photography, video, web design and local SEO business in Co. Wicklow, helping local businesses look as good online as they do in person. We'll email you <strong style="color:${PAPER};">occasionally - no fixed schedule, never spam</strong>.</p>
  </td></tr>

  <tr><td style="padding:8px 32px 0;">
    ${eyebrow('Your subscriber code')}
    ${codeBox(code)}
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${DIM};">Email us and quote this code to get <strong style="color:${PAPER};">${subscriberOffer.benefit}</strong>. Just hit the button below, or send it to <a href="mailto:${EMAIL}" style="color:${PAPER};">${EMAIL}</a>.</p>
    <div style="text-align:center;padding:4px 0 8px;">${button(mailto, 'Email us with your code')}</div>
  </td></tr>

  ${
    offerActive
      ? `<tr><td style="padding:8px 32px 0;"><div style="border:1px solid ${BRASS};border-radius:12px;padding:14px 18px;font-size:14px;line-height:1.55;color:${PAPER};">${offerLine}</div></td></tr>`
      : ''
  }

  <tr><td style="padding:20px 32px 0;">
    ${eyebrow('What we do')}
    ${stepsTable(whatWeDo)}
  </td></tr>

  <tr><td align="center" style="padding:8px 32px 8px;">
    ${button(`${SITE}/contact/`, 'Get a free listing audit', false)}${button(`${SITE}/`, 'See our work', false)}
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${DIM};">Tip: if this landed in Gmail's Promotions tab, drag it to Primary so you don't miss what comes next.</p>
  </td></tr>

  ${contactBlock()}`;

  const html = shell({
    title: "You're on the list - Horizon Vantage",
    preheader: `Thanks for signing up. Your subscriber code is ${code}.`,
    bodyRows,
    footerHtml: `You are getting this because you signed up for updates at horizonvantage.ie. You can unsubscribe at any time using the link in any newsletter we send, or just reply and tell us. See our <a href="${SITE}/privacy/" style="color:#7d858e;">Privacy Policy</a> for how we use your details.<br><br>${REGISTRATION}`,
  });

  const text = [
    "You're on the list.",
    '',
    "Thanks for signing up to Horizon Vantage. We're a one-person photography, video, web design and local SEO business in Co. Wicklow, helping local businesses look as good online as they do in person. We'll email you occasionally - no fixed schedule, never spam.",
    '',
    'YOUR SUBSCRIBER CODE',
    code,
    `Email us and quote this code to get ${subscriberOffer.benefit}: ${EMAIL}`,
    '',
    ...(offerActive ? [offerLine, ''] : []),
    'WHAT WE DO',
    ...whatWeDo.map(([n, t, d]) => `${n}. ${t} - ${d}`),
    '',
    `Free listing audit: ${SITE}/contact/`,
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

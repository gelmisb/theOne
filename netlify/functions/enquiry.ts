import type { Handler } from '@netlify/functions';

// Contact form (Contact.astro) email delivery. Netlify Forms only stores
// submissions - it sends no email until a notification is configured in the
// dashboard, and never emails the visitor. This function sends both:
//   1. a notification to the founder with the full enquiry (reply-to = visitor)
//   2. a confirmation to the visitor
// Reuses the Brevo env vars from subscribe.ts:
//   BREVO_API_KEY, BREVO_SENDER_EMAIL (must be a verified Brevo sender)
// Optional: ENQUIRY_NOTIFY_EMAIL - where enquiries go (default info@horizonvantage.ie)
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const NOTIFY_EMAIL = process.env.ENQUIRY_NOTIFY_EMAIL || 'info@horizonvantage.ie';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sendEmail = (body: object) =>
  fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY as string },
    body: JSON.stringify(body),
  });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    console.error('enquiry: BREVO_API_KEY / BREVO_SENDER_EMAIL not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Email service is not configured yet.' }) };
  }

  let p: Record<string, string>;
  try {
    p = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  // Honeypot: pretend success for bots.
  if (p['bot-field']) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  const clean = (k: string) => String(p[k] ?? '').trim().slice(0, 5000);
  const name = clean('name');
  const email = clean('email');
  if (!name || !EMAIL_RE.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and a valid email are required.' }) };
  }

  const rows: [string, string][] = [
    ['Name', name],
    ['Business', clean('business')],
    ['Email', email],
    ['Business type', clean('business_type')],
    ['Town or area', clean('town')],
    ['Website / listing', clean('listing_url')],
    ['Message', clean('message')],
  ];
  const sender = { name: 'Horizon Vantage', email: BREVO_SENDER_EMAIL };

  const notifyRes = await sendEmail({
    sender,
    to: [{ email: NOTIFY_EMAIL }],
    replyTo: { email, name },
    subject: `New enquiry: ${clean('business') || name}`,
    htmlContent: `<div style="font-family:sans-serif;max-width:560px;color:#1a1a1a">
      <h2>New website enquiry</h2>
      ${rows
        .filter(([, v]) => v)
        .map(([k, v]) => `<p style="margin:0 0 10px"><strong>${k}:</strong><br>${esc(v).replace(/\n/g, '<br>')}</p>`)
        .join('')}
    </div>`,
  });
  if (!notifyRes.ok) {
    console.error('enquiry: notify email failed', notifyRes.status, await notifyRes.text());
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not send right now.' }) };
  }

  // Visitor confirmation is best-effort - the enquiry already reached us.
  try {
    const r = await sendEmail({
      sender,
      to: [{ email, name }],
      replyTo: { email: NOTIFY_EMAIL },
      subject: 'Thanks for your enquiry - Horizon Vantage',
      htmlContent: `<div style="font-family:sans-serif;max-width:480px;color:#1a1a1a">
        <h1 style="font-size:22px;font-weight:600">Thanks, ${esc(name)} - your enquiry is in.</h1>
        <p style="font-size:15px;line-height:1.6">We'll reply within one business day. If you'd like to add anything in the meantime, just reply to this email.</p>
        <p style="font-size:15px;line-height:1.6">- Horizon Vantage</p>
      </div>`,
    });
    if (!r.ok) console.error('enquiry: confirmation email failed', r.status, await r.text());
  } catch (err) {
    console.error('enquiry: confirmation email failed', err);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

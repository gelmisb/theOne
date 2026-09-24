import type { Handler } from '@netlify/functions';

// Brevo (formerly Sendinblue) - founder's pick for the newsletter signup
// (NewsletterSignup.astro), chosen over hand-building transactional email
// because the ask was "send a welcome email now, and promotional emails
// later": that's what an actual email marketing platform is for (built-in
// unsubscribe links, consent records, campaign sending), not something
// worth half-reinventing with a bare transactional-email API.
//
// Needs three things set as Netlify environment variables before this
// actually works (Site settings > Environment variables) - until they're
// set, this returns a clear "not configured yet" error instead of a
// confusing failure:
//   BREVO_API_KEY  - Brevo dashboard > SMTP & API > API Keys
//   BREVO_LIST_ID  - the numeric ID of the contact list to subscribe to
//                    (Brevo dashboard > Contacts > Lists > open the list,
//                    the ID is in the URL)
//   BREVO_SENDER_EMAIL - the "from" address for the welcome email below;
//                    must be a verified sender in Brevo (dashboard >
//                    Senders & IP) or Brevo will reject the send
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  if (!BREVO_API_KEY || !BREVO_LIST_ID || !BREVO_SENDER_EMAIL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Email service is not configured yet.' }),
    };
  }

  let payload: { email?: string; botField?: string };
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  // Honeypot - a real visitor never fills this in (it's visually hidden in
  // the form), so a non-empty value means a bot. Silently report success
  // without actually subscribing anything, rather than telling the bot its
  // submission was rejected.
  if (payload.botField) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const email = payload.email?.trim();
  if (!email || !EMAIL_RE.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }

  // updateEnabled: true makes this an upsert - a returning subscriber
  // re-submitting (e.g. from a different browser) updates the existing
  // Brevo contact instead of erroring on a duplicate.
  const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
    body: JSON.stringify({ email, listIds: [Number(BREVO_LIST_ID)], updateEnabled: true }),
  });

  if (!contactRes.ok) {
    const detail = await contactRes.text();
    console.error('Brevo contact create/update failed:', contactRes.status, detail);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not subscribe right now.' }) };
  }

  // Welcome email is best-effort: the subscription itself already
  // succeeded above (the visitor is on the list either way), so a failure
  // here - e.g. the sender identity not verified in Brevo yet - shouldn't
  // turn a real success into an error message for the visitor.
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'Horizon Vantage', email: BREVO_SENDER_EMAIL },
        to: [{ email }],
        subject: "You're on the list - Horizon Vantage",
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
            <h1 style="font-size: 22px; font-weight: 600;">Thanks for signing up.</h1>
            <p style="font-size: 15px; line-height: 1.6;">
              You'll hear from Horizon Vantage occasionally with new work, offers, and updates -
              never spam, and you can unsubscribe any time from the link in any email we send.
            </p>
            <p style="font-size: 15px; line-height: 1.6;">
              In the meantime, if you're thinking about a shoot or a website, just reply to this
              email - it reaches the founder directly.
            </p>
          </div>
        `,
      }),
    });
  } catch (err) {
    console.error('Brevo welcome email failed (contact was still subscribed):', err);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

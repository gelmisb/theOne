# From audit to booked shoot

The working process behind the site's promise: free audit first, written quote
next, nothing booked until the deposit is paid. No site code involved - it is
email, Stripe and a calendar. Every rule below comes from `src/pages/terms.astro`
("Quotes, Fees & Payment", "Bookings, Rescheduling & Cancellations"); if the
terms change, change this too.

## The flow

1. **Enquiry** comes in through the form (Netlify Forms + the `enquiry` function).
2. **Free listing audit** - you review their photos, Google profile and website
   or booking page and email back three quick wins. This is a review, not a
   meeting.
3. **Talk it through** (optional) - include the scheduling link in the audit
   email. The link lives in `src/data/booking.ts`; the site shows it in the
   Process section, the Offer CTA and the Contact page once that is filled in.
4. **Written quote** - scope, price in EUR, what is *not* included, valid for
   30 days.
5. **Deposit** - 50%, non-refundable, sent as a Stripe invoice (or payment link).
   The terms say a booking is secured by the deposit, and "shoot dates are
   confirmed once the deposit is received".
6. **Calendar invite** - sent only after the deposit lands.
7. **Shoot, delivery, balance** - balance is due on delivery/completion, or per
   the payment schedule written into the quote.

## Stripe: invoice or payment link?

- **Invoice** for quoted work. The deposit is 50% of a project-specific number,
  so an invoice for the exact amount is the cleanest fit. It gives the client a
  hosted page to pay on and a receipt.
- **Payment link** only if you standardise deposit amounts (e.g. one fixed
  deposit for the Launch package). Easy to reuse, but awkward for variable quotes.
- Set the currency to EUR. You are not VAT-registered, so no VAT line - the
  site says "Prices shown, no VAT charged". If that changes, the terms say
  clients are told in advance.
- Name the line item so it matches the quote: "Deposit (50%) - [package] -
  [business name]".
- Stripe takes processing fees; check the current Irish rates before deciding
  who absorbs them, and say so in the quote if it is the client.

## Templates

**Audit reply** (end of the email)

> That is your audit - three quick wins above, no obligation.
> If it would help to go through it together, you can pick a time here:
> [CALL_BOOKING_URL]. Otherwise reply with any questions and I will put a
> written quote together.

**Quote email**

> Hi [name], here is the written quote for [business]: [scope, price, what is
> not included]. It is valid for 30 days from today.
>
> To secure a shoot date, the next step is a 50% deposit of €[amount]:
> [STRIPE INVOICE LINK]. The deposit is non-refundable, as set out in the terms
> ([link to /terms/]). Once it is paid I will send a calendar invite for the
> shoot. The balance of €[amount] is due on delivery.

**Deposit received + calendar invite**

> Deposit received, thank you - your shoot is confirmed for [date, time] at
> [address]. Calendar invite attached. It is a [half-day] shoot; I will arrive
> [x] minutes early to look at the light.
>
> If anything changes, tell me more than 5 business days ahead and rescheduling
> is free (subject to availability); within 48 hours a fee of up to 50% of the
> project fee can apply. If I have to move it (illness, equipment, weather), I
> will offer the next available date at no extra cost.

## Calendar invite

- Title: `Horizon Vantage shoot - [business]`
- Location: the client's premises (it is an on-site shoot)
- Length: the half-day from the quote, plus travel
- Description: what to have ready (staff available, tidy areas, products out),
  and the rescheduling terms above. Weather and light matter for outdoor and
  exterior shots, so agree a fallback date in the same message.

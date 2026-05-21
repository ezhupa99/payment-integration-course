# Online Payments In Albania: PokPay Integration Demo

This repository is the course demo for learning how online card payment integrations work in Albania.

It uses PokPay as the working implementation because it provides a practical developer path for testing payment flows with API credentials, staging access, documentation, and a CDN-based payment component.

This course and repository are not sponsored by, affiliated with, or paid by PokPay. You should still evaluate payment providers for pricing, contracts, settlement timelines, reliability, support, compliance, and fit before choosing one for a real business.

## What You Will Learn

The demo focuses on the payment flows developers usually need to understand first:

1. Guest checkout with a hosted/CDN card form.
2. Saving a card safely through tokenization.
3. Paying with a saved card and 3-D Secure.
4. Authorizing a payment now and capturing it later.
5. Why browser payment success is not enough for production.

The goal is to understand the architecture and the trust boundaries, not to ship this repository directly to production.

## Who This Is For

This is for intermediate developers who can already read JavaScript/TypeScript, understand HTTP requests, and run a local backend.

You do not need previous payment-gateway experience, but this is not a beginner web development course.

## Important Warning

This repository is a learning harness. It is not a production payment system, SaaS starter kit, accounting system, or compliance template.

Throughout the course, keep this pattern in mind:

```text
For the demo, we do X so the payment flow is visible.
For production, you must do Y before trusting the payment state.
```

In production, your backend should not treat a browser callback as final proof that money was collected. Final payment state should come from trusted server-side verification, gateway order lookup, signed webhooks, and later settlement/reconciliation processes.

## Project Structure

```text
payment-integration-pok-pay-cdn/
├── plan.md
├── README.md
├── frontend/
│   ├── index.html          # Single-page demo UI
│   └── app.js              # Vanilla JS frontend logic
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts        # Bun HTTP server and router
    │   ├── db.ts           # SQLite schema and dev migrations
    │   ├── logger.ts       # Structured logging helper
    │   ├── pokpay.ts       # PokPay API client
    │   └── routes/         # API route handlers
    └── data/
        └── pokpay.db       # Created locally at runtime
```

The backend serves both the API and the static frontend. Open the app at `http://localhost:4000` after starting the backend.

## Requirements

- Bun installed locally.
- PokPay staging credentials.
- A modern browser.
- Optional: a public HTTPS tunnel such as ngrok or Cloudflare Tunnel if you want to test webhooks locally.

## Setup

Install backend dependencies:

```bash
cd backend
bun install
```

Create a local `backend/.env` file:

```env
POKPAY_KEY_ID=your_key_id
POKPAY_KEY_SECRET=your_key_secret
POKPAY_MERCHANT_ID=your_merchant_id
POKPAY_ENV=staging
PUBLIC_BASE_URL=https://your-public-tunnel-url
PORT=4000
```

Do not commit real credentials.

`PUBLIC_BASE_URL` is used when the backend creates PokPay orders with a webhook URL. If you are not testing webhooks, you can still run the main browser demo flows locally.

## Run The Demo

From the `backend` folder:

```bash
bun run dev
```

Then open:

```text
http://localhost:4000
```

There is no separate frontend build step. The frontend is plain HTML and JavaScript served by the Bun backend.

## Demo Flows

### Guest Checkout

Use this flow when the customer pays once without saving a card.

The frontend asks the backend to create a PokPay SDK order. The backend authenticates with PokPay and returns an order ID. The frontend mounts the PokPay CDN payment form. After the browser callback, the backend attempts to confirm the order state server-side where possible.

Relevant files:

- `frontend/app.js`
- `backend/src/routes/createOrder.ts`
- `backend/src/routes/confirmOrder.ts`

### Save Card

Use this flow to learn tokenization.

The card is entered into the PokPay CDN component, not into a custom card form owned by this app. The backend stores a PokPay card reference and safe display metadata. It must not store raw card numbers or CVV values.

Relevant files:

- `frontend/app.js`
- `backend/src/routes/createUser.ts`
- `backend/src/routes/saveCard.ts`
- `backend/src/db.ts`

### Pay With Saved Card

Use this flow to learn saved-card payments with 3-D Secure.

A saved card makes checkout faster, but it does not remove the need for authentication, authorization, backend verification, or settlement checks.

Relevant files:

- `frontend/app.js`
- `backend/src/routes/payWithSaved.ts`
- `backend/src/routes/confirmOrder.ts`

### Authorize Now, Capture Later

Use this flow when a business wants to authorize the payment first and capture it after another business event, such as delivery, booking approval, inventory confirmation, or service completion.

Relevant files:

- `frontend/app.js`
- `backend/src/routes/captureOrder.ts`
- `backend/src/pokpay.ts`

## Local Webhook Testing

PokPay cannot call `localhost` directly. To receive webhooks locally, expose the backend through a public HTTPS tunnel and set `PUBLIC_BASE_URL` to that tunnel URL.

Example:

```env
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

The backend sends this webhook URL when creating SDK orders:

```text
${PUBLIC_BASE_URL}/api/webhooks/pokpay
```

In staging, webhook delivery may require provider-side enablement, whitelisting, static domains, or event configuration. If no webhook arrives during the course, use the browser-visible flow and server-side order lookup as the teaching fallback.

## Demo Database

The local database is SQLite and is created under `backend/data/` at runtime.

The demo tables are:

- `users`: local demo customer profile.
- `cards`: saved PokPay card references.
- `orders`: local view of created, authorized, and captured orders.

This database is intentionally minimal. It is not a production ledger.

## Production Checklist

Before using these ideas in a real application, you need to add production hardening in your own system:

1. Add authentication and authorization.
2. Enforce ownership checks for users, cards, and orders.
3. Validate every request body and amount.
4. Calculate amounts on the backend from trusted business data.
5. Add idempotency for order creation, confirmation, capture, and webhook processing.
6. Use trusted server-side verification or signed webhooks before marking an order as paid.
7. Redact sensitive payment data from logs and stored responses.
8. Store secrets securely outside source control.
9. Use HTTPS everywhere.
10. Add rate limiting and abuse protection.
11. Add monitoring, alerting, and operational dashboards.
12. Add refund, void, failed-payment, dispute, and reconciliation handling.
13. Confirm provider amount format, currencies, rounding rules, and capture/refund behavior.
14. Confirm PCI, privacy, fiscalization, accounting, and legal obligations with qualified professionals.

## Course Notes

The full course outline is in `plan.md`.

The planned playlist covers:

1. Online Payments in Albania: What Developers Need to Know.
2. Payment Gateway Architecture: Frontend, Backend, Gateway, Bank.
3. Setting Up a Local Payment Integration Project.
4. Guest Checkout with a Hosted/CDN Payment Form.
5. Saving Cards Safely with Tokenization.
6. Charging a Saved Card with 3-D Secure.
7. Authorize Now, Capture Later.
8. Why Browser Payment Success Is Not Enough.
9. Refunds, Failures, Disputes, and Reconciliation.
10. Production Checklist for Payment Integrations.

## Legal And Compliance Note

This course teaches technical payment integration concepts. It does not replace accounting, tax, legal, PCI, privacy, or fiscalization advice.

For a real Albanian business, confirm your obligations with qualified professionals before going live.

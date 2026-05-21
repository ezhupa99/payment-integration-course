# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A validation harness for integrating with the PokPay payment gateway. Tests three payment flows:
1. **Guest Checkout** — create an order, render PokPay CDN form, capture payment
2. **Save Card** — tokenize a card via CDN, persist the permanent token in SQLite
3. **Pay with Saved Card** — 3DS setup on backend, client-side challenge via CDN

## Commands

```bash
# Start backend (from backend/)
bun run --watch src/index.ts

# Install backend deps
cd backend && bun install

# No build step — Bun transpiles TypeScript directly
# No test suite — validation is done manually through the browser UI
```

Frontend is served as static files by the backend. Access everything at `http://localhost:4000`.

## Environment

Copy `.env.example` to `.env` and fill in PokPay credentials:
- `POKPAY_KEY_ID`, `POKPAY_KEY_SECRET`, `POKPAY_MERCHANT_ID`
- `POKPAY_ENV=staging` (or `production`)
- `PORT=4000`

## Architecture

**Backend** (`backend/src/`): Bun HTTP server using `Bun.serve()`. No framework.
- `index.ts` — router: dispatches requests to route handlers, serves static frontend files for non-API paths
- `db.ts` — SQLite schema (users, cards, orders) using `bun:sqlite`
- `pokpay.ts` — typed PokPay API client (auth, order creation, card tokenization, 3DS setup)
- `routes/` — one file per endpoint

**Frontend** (`frontend/`): Vanilla JS + PokPay CDN component loaded from `https://static.pokpay.io/public/dist/pokpayments/pok-payment.js`. No build step.

**Data flow**: Frontend calls backend API → backend authenticates with PokPay → backend returns tokens/order IDs → frontend mounts CDN components for sensitive card handling → backend persists results to SQLite.

**PokPay API base**: `https://api-staging.pokpay.io` (staging) or `https://api.pokpay.io` (production), driven by `POKPAY_ENV`.

## Database

SQLite at `backend/data/pokpay.db` (auto-created). Schema:
- `users(id, name, created_at)`
- `cards(id, user_id, pokpay_card_id, last4, brand, expiry_month, expiry_year, created_at)`
- `orders(id, user_id, pokpay_order_id, amount, status, raw_response, created_at)` — status: `PENDING | PENDING_3DS | AUTHORIZED | CAPTURED`

## API Endpoints

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/users` | `routes/createUser.ts` |
| POST | `/api/orders` | `routes/createOrder.ts` |
| GET | `/api/cards/:userId` | inline in `index.ts` |
| POST | `/api/cards` | `routes/saveCard.ts` |
| POST | `/api/prepare-token-payment` | `routes/payWithSaved.ts` |
| POST | `/api/orders/:orderId/confirm` | `routes/confirmOrder.ts` (browser-callback finalization) |
| POST | `/api/orders/:orderId/capture` | `routes/captureOrder.ts` (manual capture for autoCapture=false orders) |

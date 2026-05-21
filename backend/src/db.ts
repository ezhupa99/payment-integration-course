import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(import.meta.dir, "..", "data", "pokpay.db");
export const db = new Database(dbPath, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pokpay_card_id TEXT NOT NULL UNIQUE,  -- The permanent token from PokPay
    last4 TEXT,
    holder_first_name TEXT,
    holder_last_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Idempotent migration: bring existing dev DBs up to the current schema.
for (const col of ["brand", "expiry_month", "expiry_year"]) {
  try { db.run(`ALTER TABLE cards DROP COLUMN ${col}`); } catch {}
}
for (const col of ["holder_first_name", "holder_last_name"]) {
  try { db.run(`ALTER TABLE cards ADD COLUMN ${col} TEXT`); } catch {}
}

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    pokpay_order_id TEXT UNIQUE, -- The order ID we get back from PokPay
    amount INTEGER NOT NULL,     -- Amount in smallest currency unit
    status TEXT NOT NULL,        -- PENDING | PENDING_3DS | AUTHORIZED | CAPTURED | FAILED
    raw_response TEXT,           -- Full JSON response stored for debugging
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

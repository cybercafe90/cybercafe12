-- Additive Smart QR reconciliation for the already-created D1 databases.
-- Safe to run after smartqr-live-d1.sql; does not rebuild or delete existing data.
ALTER TABLE smartqr_shops ADD COLUMN monthly_option TEXT NOT NULL DEFAULT 'none'
  CHECK (monthly_option IN ('none','growth','vip'));
ALTER TABLE smartqr_shops ADD COLUMN logo_url TEXT;
ALTER TABLE smartqr_shops ADD COLUMN owner_display_name TEXT;

ALTER TABLE smartqr_events ADD COLUMN dedupe_hash TEXT;
CREATE INDEX IF NOT EXISTS smartqr_events_dedupe_idx
  ON smartqr_events(dedupe_hash, created_at);

CREATE TABLE IF NOT EXISTS smartqr_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES smartqr_shops(id) ON DELETE CASCADE,
  location_code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  address_text TEXT,
  phone TEXT,
  opening_hours TEXT NOT NULL DEFAULT '{}',
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS smartqr_locations_shop_idx ON smartqr_locations(shop_id);

CREATE TABLE IF NOT EXISTS smartqr_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES smartqr_shops(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES smartqr_locations(id) ON DELETE SET NULL,
  qr_code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Main QR',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS smartqr_qr_shop_idx ON smartqr_qr_codes(shop_id, is_active);

CREATE TABLE IF NOT EXISTS smartqr_subscriptions (
  id TEXT PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES smartqr_shops(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('growth','vip')),
  monthly_fee_paise INTEGER NOT NULL CHECK (monthly_fee_paise IN (9900,19900)),
  status TEXT NOT NULL CHECK (status IN ('created','authenticated','active','past_due','cancelled','expired')),
  razorpay_subscription_id TEXT UNIQUE,
  consent_at TEXT NOT NULL,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS smartqr_subscriptions_shop_idx ON smartqr_subscriptions(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS smartqr_payments (
  id TEXT PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES smartqr_shops(id) ON DELETE CASCADE,
  payment_kind TEXT NOT NULL CHECK (payment_kind IN ('setup','subscription')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL CHECK (status IN ('created','authorized','captured','failed','cancelled','refunded')),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter','growth','vip')),
  monthly_option TEXT NOT NULL CHECK (monthly_option IN ('none','growth','vip')),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS smartqr_payments_shop_idx ON smartqr_payments(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS smartqr_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smartqr_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS smartqr_events_dedupe_unique ON smartqr_events(dedupe_hash) WHERE dedupe_hash IS NOT NULL;

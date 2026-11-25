PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS smartqr_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'merchant' CHECK (role IN ('merchant','platform_admin')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartqr_shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_code TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES smartqr_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  shop_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  phone TEXT,
  whatsapp TEXT,
  address_text TEXT,
  opening_hours TEXT NOT NULL DEFAULT '{}',
  social_links TEXT NOT NULL DEFAULT '{}',
  payment_url TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  plan_code TEXT NOT NULL DEFAULT 'starter' CHECK (plan_code IN ('starter','growth','vip')),
  subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('inactive','active','past_due','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartqr_email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES smartqr_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('setup','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartqr_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES smartqr_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartqr_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES smartqr_shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('scan','whatsapp','call','directions','payment_tap','share')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartqr_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT,
  shop_id INTEGER,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS smartqr_shops_owner_idx ON smartqr_shops(owner_user_id);
CREATE INDEX IF NOT EXISTS smartqr_shops_status_idx ON smartqr_shops(approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS smartqr_events_shop_time_idx ON smartqr_events(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS smartqr_tokens_user_idx ON smartqr_email_tokens(user_id, purpose, expires_at);
CREATE INDEX IF NOT EXISTS smartqr_sessions_user_idx ON smartqr_sessions(user_id, expires_at);

CREATE TRIGGER IF NOT EXISTS smartqr_shop_slug_immutable
BEFORE UPDATE OF slug ON smartqr_shops
WHEN NEW.slug <> OLD.slug
BEGIN
  SELECT RAISE(ABORT, 'The permanent shop URL cannot be changed');
END;

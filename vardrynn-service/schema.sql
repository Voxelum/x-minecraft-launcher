-- Vardrynn account storage (Cloudflare D1, binding `DB`). Apply with:
--   wrangler d1 execute <database> --file=vardrynn-service/schema.sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
-- One external identity belongs to exactly one account.
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  display_name TEXT,
  linked_by TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS identities_account ON identities(account_id);
-- Tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  access_hash TEXT NOT NULL,
  refresh_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_access ON sessions(access_hash);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS oauth_transactions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  state TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  account_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

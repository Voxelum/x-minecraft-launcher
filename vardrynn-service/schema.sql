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
-- Vardrynn packs (packs.js). A version's manifest is the launcher's instance manifest as JSON.
CREATE TABLE IF NOT EXISTS packs (
  slug TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_sha1 TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pack_versions (
  id TEXT PRIMARY KEY,
  pack_slug TEXT NOT NULL REFERENCES packs(slug),
  version TEXT NOT NULL,
  changelog TEXT NOT NULL,
  minecraft TEXT NOT NULL,
  loaders TEXT NOT NULL,
  manifest TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (pack_slug, version)
);
CREATE INDEX IF NOT EXISTS pack_versions_pack ON pack_versions(pack_slug, published_at);

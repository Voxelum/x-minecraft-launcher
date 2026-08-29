-- Run this migration in the Supabase SQL editor.
-- All application access goes through the Cloudflare Worker.

create table if not exists public.offline_accounts (
  id uuid primary key,
  username text not null,
  normalized_username text not null unique,
  offline_uuid uuid not null unique,
  password_hash text not null,
  skin_url text,
  cape_url text,
  skin_model text not null default 'steve' check (skin_model in ('steve', 'slim')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offline_sessions (
  id uuid primary key,
  account_id uuid not null references public.offline_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists offline_sessions_account_id_idx
  on public.offline_sessions(account_id);

alter table public.offline_accounts enable row level security;
alter table public.offline_sessions enable row level security;

-- No public/authenticated policies are intentional. The Worker uses the
-- Supabase secret key server-side and is the only application data boundary.
revoke all on public.offline_accounts from anon, authenticated;
revoke all on public.offline_sessions from anon, authenticated;

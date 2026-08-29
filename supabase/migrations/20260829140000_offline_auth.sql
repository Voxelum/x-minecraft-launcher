create extension if not exists pgcrypto;

create table if not exists public.offline_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  normalized_username text not null unique,
  offline_uuid uuid not null unique,
  password_hash text not null,
  skin_url text,
  skin_model text not null default 'steve' check (skin_model in ('steve', 'slim')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offline_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.offline_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists offline_sessions_token_hash_idx on public.offline_sessions(token_hash);
create index if not exists offline_sessions_expiry_idx on public.offline_sessions(expires_at);
alter table public.offline_accounts enable row level security;
alter table public.offline_sessions enable row level security;
revoke all on public.offline_accounts from anon, authenticated;
revoke all on public.offline_sessions from anon, authenticated;

alter table public.offline_accounts
  add column if not exists cape_url text;

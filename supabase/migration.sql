-- Run this once in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table if not exists ledger_data (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  students    jsonb not null default '[]'::jsonb,
  classes     jsonb not null default '[]'::jsonb,
  payments    jsonb not null default '[]'::jsonb,
  class_types jsonb,
  updated_at  timestamptz not null default now()
);

alter table ledger_data enable row level security;

-- Each user can only read and write their own row
create policy "own data only"
  on ledger_data for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

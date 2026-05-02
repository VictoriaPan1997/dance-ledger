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

-- ── Run this second block after adding student emails in the app ──────────────
-- Students can read their teacher's row when their email is in the students list.
-- auth.email() returns the currently-authenticated user's email address.
-- This policy is permissive (OR'd with the one above), so writes remain
-- restricted to the row owner only.
create policy "students can read their studio"
  on ledger_data for select
  using (
    students @> jsonb_build_array(jsonb_build_object('email', auth.email()))
  );

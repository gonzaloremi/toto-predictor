-- ============================================================================
-- User Credits Table for Toto Brief
-- ============================================================================
-- Run this SQL manually in your Supabase Dashboard:
--   1. Go to https://supabase.com/dashboard → your project
--   2. Click "SQL Editor" in the left sidebar
--   3. Paste this entire file and click "Run"
-- ============================================================================

-- User credits table
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 3,
  has_full_pass boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS policies
alter table public.user_credits enable row level security;

create policy "Users can read own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

create policy "Users can update own credits"
  on public.user_credits for update
  using (auth.uid() = user_id);

create policy "Users can insert own credits"
  on public.user_credits for insert
  with check (auth.uid() = user_id);

-- Auto-create credits row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_credits (user_id, credits, has_full_pass)
  values (new.id, 3, false);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

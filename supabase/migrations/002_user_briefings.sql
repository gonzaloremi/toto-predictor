-- Exécuter ce SQL dans le Supabase SQL Editor pour créer la table user_briefings.

create table if not exists public.user_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id integer not null,
  analysis jsonb not null,
  sources jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, match_id)
);

alter table public.user_briefings enable row level security;

create policy "Users can read own briefings"
  on public.user_briefings for select
  using (auth.uid() = user_id);

create policy "Users can insert own briefings"
  on public.user_briefings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own briefings"
  on public.user_briefings for update
  using (auth.uid() = user_id);

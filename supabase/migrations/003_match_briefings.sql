-- Table partagee : un briefing par match, accessible a tous les users.
-- Seule la Vercel API route (service role key) peut ecrire.

create table if not exists public.match_briefings (
  id uuid primary key default gen_random_uuid(),
  match_id integer not null unique,
  analysis jsonb not null,
  sources jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.match_briefings enable row level security;

-- Lecture pour tous (anon + authenticated)
create policy "Anyone can read match briefings"
  on public.match_briefings for select
  using (true);

-- Pas de policy insert/update/delete : seule la service_role key peut ecrire.

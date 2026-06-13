-- WC2026 Predictor: Supabase migration
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Table: briefings (stores generated match briefings)
CREATE TABLE IF NOT EXISTS briefings (
  match_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: reports (stores generated match reports)
CREATE TABLE IF NOT EXISTS reports (
  match_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: eurosport_cache (cached Eurosport context, ~12h TTL enforced app-side)
CREATE TABLE IF NOT EXISTS eurosport_cache (
  match_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Table: figaro_cache (cached Figaro pronostics, ~12h TTL enforced app-side)
CREATE TABLE IF NOT EXISTS figaro_cache (
  match_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS but allow all operations (single-user app, no auth)
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON briefings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE eurosport_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON eurosport_cache FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE figaro_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON figaro_cache FOR ALL USING (true) WITH CHECK (true);

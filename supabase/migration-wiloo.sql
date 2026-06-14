-- WC2026 Predictor: Wiloo summaries migration
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Table: wiloo_summaries (stores per-country Wiloo analysis data)
CREATE TABLE IF NOT EXISTS wiloo_summaries (
  country TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with allow_all policy (single-user app, no auth)
ALTER TABLE wiloo_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON wiloo_summaries FOR ALL USING (true) WITH CHECK (true);

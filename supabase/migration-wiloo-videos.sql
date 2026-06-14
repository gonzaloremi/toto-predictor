CREATE TABLE IF NOT EXISTS wiloo_videos (
  video_id TEXT PRIMARY KEY,
  title TEXT,
  transcript TEXT,
  language TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wiloo_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON wiloo_videos FOR ALL USING (true) WITH CHECK (true);

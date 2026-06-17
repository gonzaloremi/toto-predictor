-- ============================================================================
-- Security hardening migration
-- Covers: V-01 (credits RLS), V-04 (match_briefings), V-05 (legacy tables)
-- ============================================================================

-- ── V-01: Lock down user_credits ──────────────────────────────────────────

-- Remove client-side UPDATE/INSERT policies (the signup trigger uses
-- SECURITY DEFINER and bypasses RLS, so it still works).
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits;

-- Prevent negative credits at the DB level
ALTER TABLE public.user_credits ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);

-- Atomic credit consumption RPC — the ONLY way to decrement credits.
-- Uses SELECT ... FOR UPDATE to prevent race conditions.
CREATE OR REPLACE FUNCTION public.consume_credit()
RETURNS boolean AS $$
DECLARE
  current_pass boolean;
  updated_credits integer;
BEGIN
  SELECT has_full_pass INTO current_pass
  FROM public.user_credits
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_pass THEN
    RETURN true;
  END IF;

  UPDATE public.user_credits
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = auth.uid() AND credits > 0
  RETURNING credits INTO updated_credits;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── V-04: match_briefings ──────────────────────────────────────────────────
-- Keep public read access: the data is non-sensitive sports predictions,
-- and the economic model is protected by the atomic consume_credit() RPC
-- (credits can no longer be faked client-side).
-- No policy change needed — existing "Anyone can read match briefings" stays.

-- ── V-05: Replace allow_all on legacy tables with read-only ───────────────

DROP POLICY IF EXISTS "allow_all" ON briefings;
CREATE POLICY "read_only" ON briefings FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all" ON reports;
CREATE POLICY "read_only" ON reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all" ON eurosport_cache;
CREATE POLICY "read_only" ON eurosport_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all" ON figaro_cache;
CREATE POLICY "read_only" ON figaro_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all" ON wiloo_summaries;
CREATE POLICY "read_only" ON wiloo_summaries FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all" ON wiloo_videos;
CREATE POLICY "read_only" ON wiloo_videos FOR SELECT USING (true);

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuthOrFreeMatch } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await verifyAuthOrFreeMatch(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { match_id, analysis, sources } = req.body;
  if (!match_id || !analysis) {
    return res.status(400).json({ error: 'Missing match_id or analysis' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await adminClient
    .from('match_briefings')
    .upsert(
      {
        match_id,
        analysis,
        sources: sources ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'match_id' },
    );

  if (error) {
    console.error('Failed to save briefing:', error);
    return res.status(500).json({ error: 'Failed to save briefing' });
  }

  return res.status(200).json({ ok: true });
}

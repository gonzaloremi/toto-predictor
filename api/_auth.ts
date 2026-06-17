import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { isNextMatch } from './_next-match';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://faydwdlxexnzvnzcbdrp.supabase.co';

async function verifyJwt(req: VercelRequest): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = createClient(supabaseUrl, 'anonymous', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

/**
 * Strict auth — requires a valid Supabase JWT.
 */
export async function verifyAuth(req: VercelRequest): Promise<string | null> {
  return verifyJwt(req);
}

/**
 * Auth with free-match fallback — accepts either a valid JWT
 * or an anonymous request with a valid `x-free-match-id` header
 * pointing to the current next match.
 */
export async function verifyAuthOrFreeMatch(req: VercelRequest): Promise<string | null> {
  const userId = await verifyJwt(req);
  if (userId) return userId;

  const freeMatchHeader = req.headers['x-free-match-id'];
  const freeMatchId = typeof freeMatchHeader === 'string' ? parseInt(freeMatchHeader, 10) : NaN;

  if (!isNaN(freeMatchId) && isNextMatch(freeMatchId)) {
    return 'anonymous-free';
  }

  return null;
}

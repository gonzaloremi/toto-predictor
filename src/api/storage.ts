import { supabase } from '../lib/supabase';

/**
 * Storage abstraction: localStorage as fast read-through cache,
 * Supabase as persistent cloud store.
 */

export async function getFromStore<T>(table: string, matchId: string, localStorageKey: string): Promise<T | null> {
  // Try localStorage first (fast path)
  try {
    const local = JSON.parse(localStorage.getItem(localStorageKey) ?? '{}');
    if (local[matchId]) return local[matchId] as T;
  } catch { /* ignore parse errors */ }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('match_id', matchId)
    .single();

  if (error || !data) return null;

  // Hydrate localStorage
  const parsed = data.data as T;
  try {
    const local = JSON.parse(localStorage.getItem(localStorageKey) ?? '{}');
    local[matchId] = parsed;
    localStorage.setItem(localStorageKey, JSON.stringify(local));
  } catch { /* ignore */ }

  return parsed;
}

export async function getAllFromStore<T>(table: string, localStorageKey: string): Promise<Record<string, T>> {
  // Try localStorage first
  try {
    const local = JSON.parse(localStorage.getItem(localStorageKey) ?? '{}');
    if (Object.keys(local).length > 0) return local as Record<string, T>;
  } catch { /* ignore */ }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from(table)
    .select('match_id, data');

  if (error || !data) return {};

  const result: Record<string, T> = {};
  for (const row of data) {
    result[row.match_id] = row.data as T;
  }

  // Hydrate localStorage
  if (Object.keys(result).length > 0) {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(result));
    } catch { /* ignore */ }
  }

  return result;
}

export async function saveToStore<T>(table: string, matchId: string, value: T, localStorageKey: string): Promise<void> {
  // Write to localStorage immediately
  try {
    const local = JSON.parse(localStorage.getItem(localStorageKey) ?? '{}');
    local[matchId] = value;
    localStorage.setItem(localStorageKey, JSON.stringify(local));
  } catch { /* ignore */ }

  // Write to Supabase (fire-and-forget for speed, but await to catch errors in dev)
  await supabase
    .from(table)
    .upsert({ match_id: matchId, data: value }, { onConflict: 'match_id' });
}

/**
 * Sync localStorage from Supabase on startup (call once).
 * Hydrates localStorage for all tables so subsequent sync reads are instant.
 */
export async function hydrateFromSupabase(): Promise<void> {
  const tables = [
    { table: 'briefings', key: 'wc2026_briefings' },
    { table: 'reports', key: 'wc2026_reports' },
    { table: 'eurosport_cache', key: 'wc2026_eurosport_v2' },
    { table: 'figaro_cache', key: 'wc2026_figaro_v2' },
  ];

  await Promise.allSettled(
    tables.map(async ({ table, key }) => {
      try {
        const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
        if (Object.keys(existing).length > 0) return; // already have local data
      } catch { /* ignore */ }

      const { data } = await supabase.from(table).select('match_id, data');
      if (data && data.length > 0) {
        const record: Record<string, unknown> = {};
        for (const row of data) {
          record[row.match_id] = row.data;
        }
        localStorage.setItem(key, JSON.stringify(record));
      }
    })
  );
}

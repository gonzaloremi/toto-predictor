import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BriefingsContextValue {
  briefingMatchIds: Set<number>;
  hasBriefing: (matchId: number) => boolean;
  addBriefingMatchId: (matchId: number) => void;
  isPending: (matchId: number) => boolean;
  addPendingMatchId: (matchId: number) => void;
  removePendingMatchId: (matchId: number) => void;
}

const BriefingsContext = createContext<BriefingsContextValue | null>(null);

export function useBriefings() {
  const ctx = useContext(BriefingsContext);
  if (!ctx) throw new Error('useBriefings must be used within BriefingsProvider');
  return ctx;
}

export function BriefingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [briefingMatchIds, setBriefingMatchIds] = useState<Set<number>>(new Set());
  const [pendingMatchIds, setPendingMatchIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchBriefingIds() {
      const ids = new Set<number>();

      // Per-user briefings only (for badge on MatchCard)
      if (user) {
        const { data: personal } = await supabase
          .from('user_briefings')
          .select('match_id')
          .eq('user_id', user.id);
        if (personal) {
          for (const r of personal) ids.add(r.match_id);
        }
      } else {
        // Anonymous: check localStorage
        try {
          const seen = JSON.parse(localStorage.getItem('seen_briefings') || '{}');
          for (const id of Object.keys(seen)) ids.add(Number(id));
        } catch {}
      }

      setBriefingMatchIds(ids);
    }

    fetchBriefingIds();
  }, [user]);

  const hasBriefing = useCallback(
    (matchId: number) => briefingMatchIds.has(matchId),
    [briefingMatchIds],
  );

  const addBriefingMatchId = useCallback((matchId: number) => {
    setBriefingMatchIds((prev) => new Set([...prev, matchId]));
    setPendingMatchIds((prev) => {
      if (!prev.has(matchId)) return prev;
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
  }, []);

  const isPending = useCallback(
    (matchId: number) => pendingMatchIds.has(matchId),
    [pendingMatchIds],
  );

  const addPendingMatchId = useCallback((matchId: number) => {
    setPendingMatchIds((prev) => new Set([...prev, matchId]));
  }, []);

  const removePendingMatchId = useCallback((matchId: number) => {
    setPendingMatchIds((prev) => {
      if (!prev.has(matchId)) return prev;
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
  }, []);

  return (
    <BriefingsContext.Provider value={{ briefingMatchIds, hasBriefing, addBriefingMatchId, isPending, addPendingMatchId, removePendingMatchId }}>
      {children}
    </BriefingsContext.Provider>
  );
}

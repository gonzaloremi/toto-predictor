import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  credits: number;
  hasFullPass: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  consumeCredit: () => Promise<boolean>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function fetchOrCreateCredits(userId: string): Promise<{ credits: number; hasFullPass: boolean }> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('credits, has_full_pass')
    .eq('user_id', userId)
    .single();

  if (data) return { credits: data.credits, hasFullPass: data.has_full_pass };

  if (error?.code === 'PGRST116') {
    const { data: inserted, error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: userId, credits: 3, has_full_pass: false })
      .select('credits, has_full_pass')
      .single();

    if (insertError) {
      console.error('Failed to create credits row:', insertError);
      return { credits: 0, hasFullPass: false };
    }
    return { credits: inserted!.credits, hasFullPass: inserted!.has_full_pass };
  }

  console.error('Failed to fetch credits:', error);
  return { credits: 0, hasFullPass: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [hasFullPass, setHasFullPass] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCredits = useCallback(async (u: User) => {
    const result = await fetchOrCreateCredits(u.id);
    setCredits(result.credits);
    setHasFullPass(result.hasFullPass);
  }, []);

  const handleSession = useCallback(async (session: Session | null) => {
    if (session?.user) {
      setUser(session.user);
      await loadCredits(session.user);
    } else {
      setUser(null);
      setCredits(0);
      setHasFullPass(false);
    }
    setLoading(false);
  }, [loadCredits]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(session);
      if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname + '#app');
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCredits(0);
    setHasFullPass(false);
  }, []);

  const consumeCredit = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (hasFullPass) return true;
    if (credits <= 0) return false;

    const newCredits = credits - 1;
    const { error } = await supabase
      .from('user_credits')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to consume credit:', error);
      return false;
    }

    setCredits(newCredits);
    return true;
  }, [user, credits, hasFullPass]);

  const refreshCredits = useCallback(async () => {
    if (user) await loadCredits(user);
  }, [user, loadCredits]);

  return (
    <AuthContext.Provider value={{ user, credits, hasFullPass, loading, signInWithGoogle, signOut, consumeCredit, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
}

import { useState, useEffect } from 'react';
import type { ScheduleMatch } from './types';
import MatchList from './components/MatchList';
import MatchReportView from './components/MatchReportView';
import LandingPage from './pages/LandingPage';
import { isRealTeam } from './data/nameMapping';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CreditsModalProvider, useCreditsModal } from './components/CreditsModal';
import { BriefingsProvider } from './hooks/useBriefings';

function useHashRoute() {
  const getRoute = (h: string) => {
    if (h.includes('access_token') || h.includes('refresh_token')) return '#app';
    return h;
  };

  const [hash, setHash] = useState(getRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setHash(getRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return hash;
}

function UserMenu() {
  const { user, credits, hasFullPass, loading, signInWithGoogle, signOut } = useAuth();
  const { openCreditsModal } = useCreditsModal();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1.5 text-xs font-semibold text-wc-text border border-wc-border hover:border-wc-gold/50 hover:text-wc-gold transition px-3 py-1.5 rounded-lg cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Connexion
      </button>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Joueur';

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 cursor-pointer"
      >
        <button
          onClick={(e) => { e.stopPropagation(); openCreditsModal(); }}
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition hover:border-wc-gold/50"
          style={{
            borderColor: hasFullPass ? 'var(--color-wc-gold)' : credits > 0 ? 'var(--color-wc-border)' : '#ef4444',
            color: hasFullPass ? 'var(--color-wc-gold)' : credits > 0 ? 'var(--color-wc-muted)' : '#ef4444',
          }}
        >
          {hasFullPass ? 'Pass illimité' : `${credits} crédit${credits !== 1 ? 's' : ''}`}
        </button>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full border border-wc-border" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-wc-gold/20 border border-wc-border flex items-center justify-center text-xs font-bold text-wc-gold">
            {name[0].toUpperCase()}
          </div>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-wc-card border border-wc-border rounded-xl p-3 min-w-[180px] shadow-xl space-y-2">
            <div className="px-1">
              <p className="text-xs font-bold text-wc-text truncate">{name}</p>
              <p className="text-[10px] text-wc-muted truncate">{user.email}</p>
            </div>
            <div className="border-t border-wc-border/50" />
            <button
              onClick={() => { openCreditsModal(); setMenuOpen(false); }}
              className="w-full text-left text-xs text-wc-muted hover:text-wc-text transition px-1 py-1 cursor-pointer"
            >
              {hasFullPass ? 'Pass illimité ✓' : `${credits} crédit${credits !== 1 ? 's' : ''} — Recharger`}
            </button>
            <button
              onClick={() => { signOut(); setMenuOpen(false); }}
              className="w-full text-left text-xs text-red-400/80 hover:text-red-400 transition px-1 py-1 cursor-pointer"
            >
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AppContent() {
  const hash = useHashRoute();
  const { user, loading } = useAuth();
  const [selectedMatch, setSelectedMatch] = useState<ScheduleMatch | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedMatch, hash]);

  if (!user) {
    if (loading) return null;
    return <LandingPage onEnterApp={() => { window.location.hash = '#app'; }} />;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-wc-border bg-wc-card/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center relative">
          {selectedMatch && (
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute left-4 text-lg text-wc-muted hover:text-wc-text transition cursor-pointer"
              aria-label="Retour aux matchs"
            >
              ←
            </button>
          )}
          <button onClick={() => setSelectedMatch(null)} className="flex items-center gap-2 cursor-pointer mx-auto">
            <span className="text-2xl">⚽</span>
            <h1 className="text-xl font-extrabold italic text-wc-gold tracking-tight">MPP Brief</h1>
          </button>
          <div className="absolute right-4">
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4">
        {!selectedMatch ? (
          <MatchList
            onSelectMatch={(m) => {
              if (isRealTeam(m.team1) && isRealTeam(m.team2)) {
                setSelectedMatch(m);
              }
            }}
            selectedMatchId={undefined}
          />
        ) : (
          <MatchReportView match={selectedMatch} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BriefingsProvider>
        <CreditsModalProvider>
          <AppContent />
        </CreditsModalProvider>
      </BriefingsProvider>
    </AuthProvider>
  );
}

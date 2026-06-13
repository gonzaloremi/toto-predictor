import { useState, useEffect } from 'react';
import type { ScheduleMatch } from './types';
import MatchList from './components/MatchList';
import MatchReportView from './components/MatchReportView';
import { isRealTeam } from './data/nameMapping';

export default function App() {
  const [selectedMatch, setSelectedMatch] = useState<ScheduleMatch | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedMatch]);

  return (
    <div className="min-h-screen bg-wc-dark">
      {/* Header */}
      <header className="border-b border-wc-border bg-wc-card/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between relative">
          <button onClick={() => setSelectedMatch(null)} className="flex items-center gap-3 cursor-pointer">
            <span className="text-2xl">⚽</span>
            <div className="text-left">
              <h1 className="text-lg font-bold text-wc-gold">WC 2026 Predictor</h1>
              <p className="text-xs text-wc-muted">Pronostics Coupe du Monde</p>
            </div>
          </button>
          {selectedMatch && (
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-wc-muted hover:text-wc-text transition"
              aria-label="Retour aux matchs"
            >
              ←
            </button>
          )}
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

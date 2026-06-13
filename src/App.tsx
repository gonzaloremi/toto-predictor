import { useState } from 'react';
import type { ScheduleMatch } from './types';
import MatchList from './components/MatchList';
import MatchReportView from './components/MatchReportView';
import { isRealTeam } from './data/nameMapping';

export default function App() {
  const [selectedMatch, setSelectedMatch] = useState<ScheduleMatch | null>(null);

  return (
    <div className="min-h-screen bg-wc-dark">
      {/* Header */}
      <header className="border-b border-wc-border bg-wc-card/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚽</span>
            <div>
              <h1 className="text-lg font-bold text-wc-gold">WC 2026 Predictor</h1>
              <p className="text-xs text-wc-muted">Pronostics Coupe du Monde</p>
            </div>
          </div>
          {selectedMatch && (
            <button
              onClick={() => setSelectedMatch(null)}
              className="text-sm text-wc-muted hover:text-wc-text transition"
            >
              ← Retour aux matchs
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

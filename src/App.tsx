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
            <h1 className="text-xl font-extrabold italic text-wc-gold tracking-tight">Toto Brief</h1>
          </button>
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

import { useState } from 'react';
import type { TeamLastMatch, TeamWcHistory, TeamStats, HeadToHeadRecord } from '../types';
import { getFlag, getFr } from '../data/nameMapping';

interface Props {
  team1: string;
  team2: string;
  data: {
    team1LastMatches: TeamLastMatch[];
    team2LastMatches: TeamLastMatch[];
    team1WcHistory: TeamWcHistory | undefined;
    team2WcHistory: TeamWcHistory | undefined;
    team1Stats: TeamStats | undefined;
    team2Stats: TeamStats | undefined;
    headToHead: HeadToHeadRecord | null;
  };
}

const RESULT_FR: Record<string, string> = { W: 'V', D: 'N', L: 'D' };

function FormBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    W: 'bg-green-600 text-white',
    D: 'bg-yellow-600 text-white',
    L: 'bg-red-600 text-white',
  };
  return (
    <span className={`w-6 h-6 rounded text-xs font-bold inline-flex items-center justify-center shrink-0 ${colors[result] ?? 'bg-gray-600'}`}>
      {RESULT_FR[result] ?? result}
    </span>
  );
}

function TeamFullView({ team, stats, wcHistory, lastMatches }: {
  team: string;
  stats: TeamStats | undefined;
  wcHistory: TeamWcHistory | undefined;
  lastMatches: TeamLastMatch[];
}) {
  return (
    <div className="space-y-4">
      {stats && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-wc-muted">Forme récente</span>
          </div>
          <div className="flex gap-1.5">
            {stats.recentForm.split('').map((r, i) => (
              <FormBadge key={i} result={r} />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
              <div className="text-2xl font-bold text-green-400">{stats.last10.won}</div>
              <div className="text-xs text-wc-muted">Victoires</div>
            </div>
            <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
              <div className="text-2xl font-bold text-yellow-400">{stats.last10.drawn}</div>
              <div className="text-xs text-wc-muted">Nuls</div>
            </div>
            <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
              <div className="text-2xl font-bold text-red-400">{stats.last10.lost}</div>
              <div className="text-xs text-wc-muted">Défaites</div>
            </div>
          </div>

          <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-wc-muted">Buts marqués (moy.)</span>
              <span className="font-bold">{stats.avgGoalsScored}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-wc-muted">Buts encaissés (moy.)</span>
              <span className="font-bold">{stats.avgGoalsConceded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-wc-muted">Participations CdM</span>
              <span className="font-bold">{wcHistory?.appearances ?? 0}</span>
            </div>
            {wcHistory && (
              <>
                <div className="border-t border-wc-border pt-2 mt-2">
                  <div className="text-xs text-wc-gold font-bold mb-2">Bilan Coupe du Monde</div>
                </div>
                <div className="flex justify-between">
                  <span className="text-wc-muted">Matchs joués</span>
                  <span>{wcHistory.stats.played}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-wc-muted">V / N / D</span>
                  <span>{wcHistory.stats.won} / {wcHistory.stats.drawn} / {wcHistory.stats.lost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-wc-muted">Buts (pour / contre)</span>
                  <span>{wcHistory.stats.goalsFor} / {wcHistory.stats.goalsAgainst}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
        <div className="text-xs text-wc-muted font-bold mb-3 uppercase tracking-wider">10 derniers matchs</div>
        <div className="space-y-1.5">
          {lastMatches.slice(0, 10).map((m, i) => (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <span className="text-wc-muted text-xs w-20 shrink-0">{m.date}</span>
              <span className="truncate flex-1">
                {m.home ? 'vs' : '@'} {m.opponent}
              </span>
              <span className="font-mono font-bold shrink-0">{m.score[0]}-{m.score[1]}</span>
              <FormBadge result={m.result} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeadToHeadView({ team1, team2, h2h }: { team1: string; team2: string; h2h: HeadToHeadRecord | null }) {
  if (!h2h || h2h.totalMatches === 0) {
    return (
      <div className="bg-wc-dark/50 rounded-lg p-6 border border-wc-border text-center text-wc-muted">
        Aucune confrontation directe entre {team1} et {team2}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
          <div className="text-2xl font-bold text-green-400">{h2h.wins[team1] ?? 0}</div>
          <div className="text-xs text-wc-muted">{team1}</div>
        </div>
        <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
          <div className="text-2xl font-bold text-yellow-400">{h2h.wins['draws'] ?? h2h.wins.draws ?? 0}</div>
          <div className="text-xs text-wc-muted">Nuls</div>
        </div>
        <div className="bg-wc-dark/50 rounded-lg p-3 border border-wc-border">
          <div className="text-2xl font-bold text-green-400">{h2h.wins[team2] ?? 0}</div>
          <div className="text-xs text-wc-muted">{team2}</div>
        </div>
      </div>

      <div className="text-sm text-wc-muted text-center">
        Buts : {team1} {h2h.goals[team1] ?? 0} - {h2h.goals[team2] ?? 0} {team2}
      </div>

      {h2h.inWorldCup.length > 0 && (
        <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
          <div className="text-xs text-wc-gold font-bold mb-3 uppercase tracking-wider">En Coupe du Monde</div>
          <div className="space-y-2">
            {h2h.inWorldCup.map((m, i) => {
              const isTeam1Home = m.homeTeam === team1;
              const t1Score = isTeam1Home ? m.score[0] : m.score[1];
              const t2Score = isTeam1Home ? m.score[1] : m.score[0];
              const result = t1Score > t2Score ? 'team1' : t2Score > t1Score ? 'team2' : 'draw';
              return (
                <div key={i} className="flex items-center gap-2 bg-wc-card/60 rounded-lg px-3 py-2">
                  <span className="text-xs text-wc-muted w-24 shrink-0">{m.date}</span>
                  <div className="flex items-center gap-1 flex-1 justify-center text-sm">
                    <span className={result === 'team1' ? 'font-bold text-green-400' : ''}>{getFlag(team1)}</span>
                    <span className="font-mono font-black text-wc-gold px-1">{t1Score} - {t2Score}</span>
                    <span className={result === 'team2' ? 'font-bold text-green-400' : ''}>{getFlag(team2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
        <div className="text-xs text-wc-muted font-bold mb-3 uppercase tracking-wider">Toutes les rencontres</div>
        <div className="space-y-2">
          {h2h.lastMeetings.slice(0, 8).map((m, i) => {
            const isTeam1Home = m.homeTeam === team1;
            const t1Score = isTeam1Home ? m.score[0] : m.score[1];
            const t2Score = isTeam1Home ? m.score[1] : m.score[0];
            const result = t1Score > t2Score ? 'team1' : t2Score > t1Score ? 'team2' : 'draw';
            const isWc = m.tournament === 'FIFA World Cup';
            return (
              <div key={i} className="flex items-center gap-2 bg-wc-card/40 rounded-lg px-3 py-2">
                <span className="text-xs text-wc-muted w-24 shrink-0">{m.date}</span>
                <div className="flex items-center gap-1 flex-1 justify-center text-sm">
                  <span className={result === 'team1' ? 'font-bold text-green-400' : 'text-wc-text/80'}>{getFlag(team1)}</span>
                  <span className="font-mono font-bold text-wc-text px-1">{t1Score} - {t2Score}</span>
                  <span className={result === 'team2' ? 'font-bold text-green-400' : 'text-wc-text/80'}>{getFlag(team2)}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${isWc ? 'bg-wc-gold/15 text-wc-gold' : 'bg-wc-border/50 text-wc-muted'}`}>
                  {m.tournament.replace('FIFA ', '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SubTab = 'team1' | 'team2' | 'h2h';

export default function QuantitativeSection({ team1, team2, data }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('team1');

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'team1', label: getFr(team1) },
    { key: 'team2', label: getFr(team2) },
    { key: 'h2h', label: 'Face à face' },
  ];

  return (
    <div>
      <div className="flex border-b border-wc-border mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold italic whitespace-nowrap transition ${
              subTab === tab.key
                ? 'text-wc-gold border-b-2 border-wc-gold'
                : 'text-wc-muted hover:text-wc-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'team1' && (
        <TeamFullView
          team={team1}
          stats={data.team1Stats}
          wcHistory={data.team1WcHistory}
          lastMatches={data.team1LastMatches}
        />
      )}
      {subTab === 'team2' && (
        <TeamFullView
          team={team2}
          stats={data.team2Stats}
          wcHistory={data.team2WcHistory}
          lastMatches={data.team2LastMatches}
        />
      )}
      {subTab === 'h2h' && (
        <HeadToHeadView team1={team1} team2={team2} h2h={data.headToHead} />
      )}
    </div>
  );
}

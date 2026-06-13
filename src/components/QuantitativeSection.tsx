import type { TeamLastMatch, TeamWcHistory, TeamStats, HeadToHeadRecord } from '../types';
import { getFlag } from '../data/nameMapping';

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
    <span className={`w-6 h-6 rounded text-xs font-bold inline-flex items-center justify-center ${colors[result] ?? 'bg-gray-600'}`}>
      {RESULT_FR[result] ?? result}
    </span>
  );
}

function TeamStatsCard({ team, stats, wcHistory, lastMatches }: {
  team: string;
  stats: TeamStats | undefined;
  wcHistory: TeamWcHistory | undefined;
  lastMatches: TeamLastMatch[];
}) {
  if (!stats) return null;
  return (
    <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{getFlag(team)}</span>
        <h4 className="font-bold">{team}</h4>
      </div>

      <div className="mb-3">
        <span className="text-xs text-wc-muted">Forme recente</span>
        <div className="flex gap-1 mt-1">
          {stats.recentForm.split('').map((r, i) => (
            <FormBadge key={i} result={r} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="bg-wc-card rounded p-2">
          <div className="text-lg font-bold text-green-400">{stats.last10.won}</div>
          <div className="text-[10px] text-wc-muted">Victoires</div>
        </div>
        <div className="bg-wc-card rounded p-2">
          <div className="text-lg font-bold text-yellow-400">{stats.last10.drawn}</div>
          <div className="text-[10px] text-wc-muted">Nuls</div>
        </div>
        <div className="bg-wc-card rounded p-2">
          <div className="text-lg font-bold text-red-400">{stats.last10.lost}</div>
          <div className="text-[10px] text-wc-muted">Defaites</div>
        </div>
      </div>

      <div className="text-sm space-y-1 mb-3">
        <div className="flex justify-between">
          <span className="text-wc-muted">Buts marques (moy.)</span>
          <span className="font-medium">{stats.avgGoalsScored}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-wc-muted">Buts encaisses (moy.)</span>
          <span className="font-medium">{stats.avgGoalsConceded}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-wc-muted">Participations CdM</span>
          <span className="font-medium">{wcHistory?.appearances ?? 0}</span>
        </div>
      </div>

      {wcHistory && (
        <div className="text-sm space-y-1 border-t border-wc-border pt-2">
          <div className="text-xs text-wc-muted font-bold mb-1">Bilan Coupe du Monde</div>
          <div className="flex justify-between">
            <span className="text-wc-muted">Matchs joues</span>
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
        </div>
      )}

    </div>
  );
}

function LastMatchesCard({ team, lastMatches }: { team: string; lastMatches: TeamLastMatch[] }) {
  if (!lastMatches.length) return null;
  return (
    <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{getFlag(team)}</span>
        <h4 className="font-bold">{team}</h4>
        <span className="text-xs text-wc-muted ml-auto">10 derniers matchs</span>
      </div>
      <div className="space-y-1">
        {lastMatches.slice(0, 10).map((m, i) => (
          <div key={i} className="flex items-center justify-between text-xs gap-2">
            <span className="text-wc-muted w-20 shrink-0">{m.date}</span>
            <span className="truncate flex-1">
              {m.home ? 'vs' : '@'} {m.opponent}
            </span>
            <span className="font-mono font-bold">{m.score[0]}-{m.score[1]}</span>
            <FormBadge result={m.result} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuantitativeSection({ team1, team2, data }: Props) {
  return (
    <div className="space-y-4">
      {/* Last matches first */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LastMatchesCard team={team1} lastMatches={data.team1LastMatches} />
        <LastMatchesCard team={team2} lastMatches={data.team2LastMatches} />
      </div>

      {/* Head to head */}
      {data.headToHead && data.headToHead.totalMatches > 0 && (
        <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border">
          <h4 className="font-bold text-wc-gold mb-3">
            Confrontations directes ({data.headToHead.totalMatches} matchs)
          </h4>

          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="bg-wc-card rounded p-3">
              <div className="text-lg font-bold text-green-400">
                {data.headToHead.wins[team1] ?? 0}
              </div>
              <div className="text-xs text-wc-muted">{team1}</div>
            </div>
            <div className="bg-wc-card rounded p-3">
              <div className="text-lg font-bold text-yellow-400">
                {data.headToHead.wins['draws'] ?? data.headToHead.wins.draws ?? 0}
              </div>
              <div className="text-xs text-wc-muted">Nuls</div>
            </div>
            <div className="bg-wc-card rounded p-3">
              <div className="text-lg font-bold text-green-400">
                {data.headToHead.wins[team2] ?? 0}
              </div>
              <div className="text-xs text-wc-muted">{team2}</div>
            </div>
          </div>

              <div className="text-sm text-wc-muted mb-2">
            Buts : {team1} {data.headToHead.goals[team1] ?? 0} - {data.headToHead.goals[team2] ?? 0} {team2}
          </div>

          {data.headToHead.inWorldCup.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-wc-gold font-bold mb-2 uppercase tracking-wider">En Coupe du Monde</div>
              <div className="space-y-1.5">
                {data.headToHead.inWorldCup.map((m, i) => {
                  const isTeam1Home = m.homeTeam === team1;
                  const t1Score = isTeam1Home ? m.score[0] : m.score[1];
                  const t2Score = isTeam1Home ? m.score[1] : m.score[0];
                  const result = t1Score > t2Score ? 'team1' : t2Score > t1Score ? 'team2' : 'draw';
                  return (
                    <div key={i} className="flex items-center gap-2 bg-wc-card/60 rounded-lg px-3 py-2">
                      <span className="text-xs text-wc-muted w-24 shrink-0">{m.date}</span>
                      <div className="flex items-center gap-2 flex-1 justify-center">
                        <span className={`text-sm font-bold ${result === 'team1' ? 'text-green-400' : 'text-wc-text'}`}>{getFlag(team1)} {team1}</span>
                        <span className="font-mono text-lg font-black text-wc-gold px-2">{t1Score} - {t2Score}</span>
                        <span className={`text-sm font-bold ${result === 'team2' ? 'text-green-400' : 'text-wc-text'}`}>{team2} {getFlag(team2)}</span>
                      </div>
                      <span className="text-[10px] bg-wc-gold/15 text-wc-gold px-2 py-0.5 rounded-full shrink-0">CdM</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-wc-muted font-bold mb-2 uppercase tracking-wider">Toutes les rencontres</div>
            <div className="space-y-1.5">
              {data.headToHead.lastMeetings.slice(0, 6).map((m, i) => {
                const isTeam1Home = m.homeTeam === team1;
                const t1Score = isTeam1Home ? m.score[0] : m.score[1];
                const t2Score = isTeam1Home ? m.score[1] : m.score[0];
                const result = t1Score > t2Score ? 'team1' : t2Score > t1Score ? 'team2' : 'draw';
                const isWc = m.tournament === 'FIFA World Cup';
                return (
                  <div key={i} className="flex items-center gap-2 bg-wc-card/40 rounded-lg px-3 py-2">
                    <span className="text-xs text-wc-muted w-24 shrink-0">{m.date}</span>
                    <div className="flex items-center gap-2 flex-1 justify-center">
                      <span className={`text-sm ${result === 'team1' ? 'font-bold text-green-400' : 'text-wc-text/80'}`}>{getFlag(team1)} {team1}</span>
                      <span className="font-mono text-base font-black text-wc-text px-2">{t1Score} - {t2Score}</span>
                      <span className={`text-sm ${result === 'team2' ? 'font-bold text-green-400' : 'text-wc-text/80'}`}>{team2} {getFlag(team2)}</span>
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
      )}

      {data.headToHead && data.headToHead.totalMatches === 0 && (
        <div className="bg-wc-dark/50 rounded-lg p-4 border border-wc-border text-center text-wc-muted">
          Aucune confrontation directe entre {team1} et {team2}
        </div>
      )}

      {/* Stats & bilan CdM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamStatsCard
          team={team1}
          stats={data.team1Stats}
          wcHistory={data.team1WcHistory}
          lastMatches={data.team1LastMatches}
        />
        <TeamStatsCard
          team={team2}
          stats={data.team2Stats}
          wcHistory={data.team2WcHistory}
          lastMatches={data.team2LastMatches}
        />
      </div>
    </div>
  );
}

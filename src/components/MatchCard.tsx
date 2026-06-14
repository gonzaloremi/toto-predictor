import type { ScheduleMatch } from '../types';
import { getFlag, isRealTeam, getFr } from '../data/nameMapping';
import { useWeather } from '../hooks/useWeather';
import { getMatchTimes } from '../utils/matchTime';
import oddsData from '../data/generated/tournament-odds.json';

interface TeamOdds {
  odds: number;
  rank: number;
  probability: number;
}

const teamsOdds = oddsData.teams as Record<string, TeamOdds>;

function OddsBadge({ team }: { team: string }) {
  const info = teamsOdds[team];
  if (!info) return null;
  const isFavori = info.rank <= 10;
  return (
    <span className={`text-[10px] ${isFavori ? 'text-wc-gold' : 'text-wc-muted'}`}>
      #{info.rank} · {info.probability}%
    </span>
  );
}

interface Props {
  match: ScheduleMatch;
  time: string;
  onSelect?: (match: ScheduleMatch) => void;
  isSelected?: boolean;
  hasReport?: boolean;
}

function MatchCardWeather({ match }: { match: ScheduleMatch }) {
  const weather = useWeather(match.ground, match.date, match.time);
  return (
    <div className="flex items-center justify-between mt-1">
      <span className="text-[11px] text-wc-muted">{match.ground.replace(/\s*\(.*?\)/g, '')}</span>
      {weather && (
        <span className="text-[11px] text-wc-muted">
          {weather.icon} {weather.temp}°C
        </span>
      )}
    </div>
  );
}

export default function MatchCard({ match, time, onSelect, isSelected, hasReport }: Props) {
  const team1Real = isRealTeam(match.team1);
  const team2Real = isRealTeam(match.team2);
  const canClick = team1Real && team2Real && onSelect;
  const played = !!match.score?.ft;

  return (
    <button
      onClick={() => canClick && onSelect(match)}
      disabled={!canClick}
      className={`
        w-full text-left rounded-xl border p-4 transition-all
        ${isSelected
          ? 'border-wc-gold bg-wc-gold/10 ring-1 ring-wc-gold/30'
          : played
            ? 'border-wc-border/50 bg-wc-card/50 opacity-75 hover:opacity-100 hover:border-wc-border'
            : 'border-wc-border bg-wc-card hover:border-wc-gold/40'
        }
        ${!canClick ? 'opacity-60 cursor-default' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {played ? (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-wc-muted/15 text-wc-muted px-2 py-0.5 rounded-full">
              Terminé
            </span>
          ) : (
            <>
              <span className="text-xs font-semibold text-wc-text">🇫🇷 {getMatchTimes(match.date, match.time, match.ground).france}</span>
              <span className="text-[10px] text-wc-muted">{getMatchTimes(match.date, match.time, match.ground).local} loc.</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasReport && (
            <span className="text-[10px] bg-wc-green/20 text-green-400 w-2 h-2 rounded-full" />
          )}
          {match.group && (
            <span className="text-[10px] text-wc-muted bg-wc-border/40 px-2 py-0.5 rounded-full font-medium">
              {match.group}
            </span>
          )}
          {!match.group && <span className="text-xs text-wc-muted italic">{match.round}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-xl">{team1Real ? getFlag(match.team1) : '❓'}</span>
          <span className="font-semibold italic truncate text-sm">{getFr(match.team1)}</span>
        </div>
        {played ? (
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-wc-gold/20 text-wc-gold font-black text-lg flex items-center justify-center">
              {match.score!.ft[0]}
            </span>
            <span className="text-wc-muted text-xs mx-0.5">-</span>
            <span className="w-8 h-8 rounded-lg bg-wc-gold/20 text-wc-gold font-black text-lg flex items-center justify-center">
              {match.score!.ft[1]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-wc-muted font-bold italic shrink-0">vs</span>
        )}
        <div className="flex items-center gap-2.5 justify-end flex-1 min-w-0">
          <span className="font-semibold italic truncate text-sm text-right">{getFr(match.team2)}</span>
          <span className="text-xl">{team2Real ? getFlag(match.team2) : '❓'}</span>
        </div>
      </div>
      <MatchCardWeather match={match} />
    </button>
  );
}

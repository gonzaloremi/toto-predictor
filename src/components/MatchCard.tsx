import type { ScheduleMatch } from '../types';
import { getFlag, isRealTeam } from '../data/nameMapping';
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

export default function MatchCard({ match, time, onSelect, isSelected, hasReport }: Props) {
  const team1Real = isRealTeam(match.team1);
  const team2Real = isRealTeam(match.team2);
  const canClick = team1Real && team2Real && onSelect;

  return (
    <button
      onClick={() => canClick && onSelect(match)}
      disabled={!canClick}
      className={`
        w-full text-left rounded-lg border p-3 transition-all
        ${isSelected
          ? 'border-wc-gold bg-wc-gold/10 ring-1 ring-wc-gold/30'
          : 'border-wc-border bg-wc-card hover:border-wc-gold/40'
        }
        ${!canClick ? 'opacity-60 cursor-default' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-wc-text">{time}</span>
        <div className="flex items-center gap-1.5">
          {hasReport && (
            <span className="text-[10px] bg-wc-green/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
              RAPPORT
            </span>
          )}
          {match.group && (
            <span className="text-[10px] text-wc-muted bg-wc-border/40 px-1.5 py-0.5 rounded">
              {match.group}
            </span>
          )}
          <span className="text-xs text-wc-muted">{match.round}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{team1Real ? getFlag(match.team1) : '❓'}</span>
          <span className="font-medium truncate text-sm">{match.team1}</span>
        </div>
        <span className="text-xs text-wc-muted font-bold shrink-0">vs</span>
        <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
          <span className="font-medium truncate text-sm text-right">{match.team2}</span>
          <span className="text-lg">{team2Real ? getFlag(match.team2) : '❓'}</span>
        </div>
      </div>
      <div className="text-[11px] text-wc-muted mt-1">{match.ground}</div>
    </button>
  );
}

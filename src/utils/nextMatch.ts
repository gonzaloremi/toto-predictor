import scheduleData from '../data/generated/schedule.json';
import type { ScheduleMatch } from '../types';

let _nextMatch: ScheduleMatch | null | undefined = undefined;

function parseUtcMinutes(date: string, time: string): number {
  const [hh, rest] = time.split(':');
  const mm = rest.slice(0, 2);
  const utcOffset = rest.includes('UTC') ? parseInt(rest.split('UTC')[1], 10) : 0;
  return new Date(`${date}T${hh}:${mm}:00Z`).getTime() - utcOffset * 60 * 60 * 1000;
}

function computeNextMatch(): ScheduleMatch | null {
  const schedule = scheduleData as ScheduleMatch[];
  const now = Date.now();
  const grace = 15 * 60 * 1000;

  const upcoming = schedule
    .filter((m) => !m.score?.ft)
    .sort((a, b) => parseUtcMinutes(a.date, a.time) - parseUtcMinutes(b.date, b.time));

  for (const m of upcoming) {
    const kickoff = parseUtcMinutes(m.date, m.time);
    if (kickoff > now - grace) return m;
  }

  return upcoming[0] ?? null;
}

export function getNextMatch(): ScheduleMatch | null {
  if (_nextMatch === undefined) {
    _nextMatch = computeNextMatch();
  }
  return _nextMatch;
}

export function getNextMatchId(): number | null {
  return getNextMatch()?.id ?? null;
}

export function isNextMatch(matchId: number): boolean {
  return getNextMatchId() === matchId;
}

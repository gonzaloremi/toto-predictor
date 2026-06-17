import { readFileSync } from 'fs';
import { join } from 'path';

interface ScheduleMatch {
  id: number;
  date: string;
  time: string;
  score?: { ft: [number, number] };
}

let _schedule: ScheduleMatch[] | null = null;

function loadSchedule(): ScheduleMatch[] {
  if (_schedule) return _schedule;
  const raw = readFileSync(join(process.cwd(), 'src/data/generated/schedule.json'), 'utf-8');
  _schedule = JSON.parse(raw);
  return _schedule!;
}

function parseUtcMinutes(date: string, time: string): number {
  const [hh, rest] = time.split(':');
  const mm = rest.slice(0, 2);
  const utcOffset = rest.includes('UTC') ? parseInt(rest.split('UTC')[1], 10) : 0;
  return new Date(`${date}T${hh}:${mm}:00Z`).getTime() - utcOffset * 60 * 60 * 1000;
}

export function getNextMatchId(): number | null {
  const schedule = loadSchedule();
  const now = Date.now();
  const grace = 15 * 60 * 1000;

  const upcoming = schedule
    .filter((m) => !m.score?.ft)
    .sort((a, b) => parseUtcMinutes(a.date, a.time) - parseUtcMinutes(b.date, b.time));

  for (const m of upcoming) {
    const kickoff = parseUtcMinutes(m.date, m.time);
    if (kickoff > now - grace) return m.id;
  }

  return upcoming[0]?.id ?? null;
}

export function isNextMatch(matchId: number): boolean {
  return getNextMatchId() === matchId;
}

import { useMemo, useEffect, useRef } from 'react';
import type { ScheduleMatch } from '../types';
import MatchCard from './MatchCard';
import scheduleData from '../data/generated/schedule.json';
import { getReport } from '../api/reportGenerator';
import { getCachedBriefing } from '../api/briefing';

interface Props {
  onSelectMatch: (match: ScheduleMatch) => void;
  selectedMatchId?: number;
}

function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function extractTime(timeField: string): string {
  return timeField.split(' ')[0];
}

function findNextMatchDate(sortedDates: string[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  for (const date of sortedDates) {
    if (date >= today) return date;
  }
  return sortedDates[sortedDates.length - 1] ?? null;
}

export default function MatchList({ onSelectMatch, selectedMatchId }: Props) {
  const schedule = scheduleData as ScheduleMatch[];
  const scrollTargetRef = useRef<HTMLDivElement>(null);

  const matchesByDate = useMemo(() => {
    const grouped: Record<string, ScheduleMatch[]> = {};
    for (const m of schedule) {
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    }
    for (const date of Object.keys(grouped)) {
      grouped[date].sort((a, b) => extractTime(a.time).localeCompare(extractTime(b.time)));
    }
    return grouped;
  }, [schedule]);

  const sortedDates = useMemo(
    () => Object.keys(matchesByDate).sort(),
    [matchesByDate]
  );

  const nextDate = useMemo(() => findNextMatchDate(sortedDates), [sortedDates]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollTargetRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }, [nextDate]);

  return (
    <div className="space-y-8">
      {sortedDates.map((date) => (
        <section key={date} ref={date === nextDate ? scrollTargetRef : undefined} style={{ scrollMarginTop: '60px' }}>
          <h2 className="text-sm font-semibold italic text-wc-gold uppercase tracking-widest mb-3 py-2">
            {formatDateHeader(date)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {matchesByDate[date].map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                time={extractTime(m.time)}
                onSelect={onSelectMatch}
                isSelected={m.id === selectedMatchId}
                hasReport={!!(getReport(m.id) || getCachedBriefing(m.id))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

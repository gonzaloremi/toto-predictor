import { useState } from 'react';
import type { ScheduleMatch } from '../types';
import { getFlag, getFr } from '../data/nameMapping';
import oddsData from '../data/generated/tournament-odds.json';
import QuantitativeSection from './QuantitativeSection';
import AgenticTab from './AgenticTab';
import { getQuantitativeData } from '../api/reportGenerator';
import { getMatchTimes } from '../utils/matchTime';

const teamsOdds = oddsData.teams as Record<string, { odds: number; rank: number; probability: number }>;

import { useWeather } from '../hooks/useWeather';

function WeatherBadge({ match }: { match: ScheduleMatch }) {
  const weather = useWeather(match.ground, match.date, match.time);
  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 bg-wc-dark/40 border border-wc-border/50 rounded-full px-3 py-1">
      <span className="text-lg">{weather.icon}</span>
      <span className="text-sm font-bold">{weather.temp}°C</span>
      <span className="text-[10px] text-wc-muted">💨 {weather.wind} km/h</span>
      <span className="text-[10px] text-wc-muted">💧 {weather.humidity}%</span>
    </div>
  );
}

function OddsBadge({ team }: { team: string }) {
  const info = teamsOdds[team];
  if (!info) return null;
  return (
    <span className={`text-[10px] ${info.rank <= 10 ? 'text-wc-gold' : 'text-wc-muted'}`}>
      #{info.rank} · {info.probability}%
    </span>
  );
}

function computeMatch1X2(team1: string, team2: string): { win1: number; draw: number; win2: number } | null {
  const t1 = teamsOdds[team1];
  const t2 = teamsOdds[team2];
  if (!t1 || !t2) return null;

  const p1 = t1.probability;
  const p2 = t2.probability;
  const total = p1 + p2;
  const s1 = p1 / total;
  const s2 = p2 / total;

  const drawBase = 0.27 - 0.15 * Math.abs(s1 - s2);
  const pDraw = Math.max(0.15, Math.min(0.30, drawBase));
  const pWin1 = (1 - pDraw) * s1;
  const pWin2 = (1 - pDraw) * s2;

  const margin = 1.05;
  return {
    win1: Math.round((margin / pWin1) * 100) / 100,
    draw: Math.round((margin / pDraw) * 100) / 100,
    win2: Math.round((margin / pWin2) * 100) / 100,
  };
}

function MatchOdds1X2({ team1, team2 }: { team1: string; team2: string }) {
  const odds = computeMatch1X2(team1, team2);
  if (!odds) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <div className="inline-flex items-center gap-1 bg-wc-dark/50 border border-wc-border/60 rounded-full px-3.5 py-1.5">
        <span className="text-[10px] text-wc-muted uppercase tracking-wider font-bold mr-1">Cotes</span>
        <span className="text-sm font-bold italic text-wc-gold">{odds.win1.toFixed(1)}</span>
        <span className="text-wc-muted text-xs">·</span>
        <span className="text-sm font-bold italic text-wc-text/80">{odds.draw.toFixed(1)}</span>
        <span className="text-wc-muted text-xs">·</span>
        <span className="text-sm font-bold italic text-wc-gold">{odds.win2.toFixed(1)}</span>
      </div>
    </div>
  );
}

interface Props {
  match: ScheduleMatch;
}

type TabKey = 'stats' | 'briefing';

export default function MatchReportView({ match }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('briefing');

  const quantData = getQuantitativeData(match.team1, match.team2);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'stats', label: 'Stats détaillées' },
    { key: 'briefing', label: 'Briefing' },
  ];

  return (
    <div className="bg-wc-card border border-wc-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-wc-green/20 border-b border-wc-border p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-xs text-wc-muted">
            {match.date} · {match.group ?? match.round}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-wc-text font-medium">
              🇫🇷 {getMatchTimes(match.date, match.time, match.ground).france}
            </span>
            <span className="text-xs text-wc-muted">
              {getMatchTimes(match.date, match.time, match.ground).local} loc.
            </span>
            <WeatherBadge match={match} />
          </div>
          <span className="text-xs text-wc-muted">{match.ground}</span>
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{getFlag(match.team1)}</span>
            <div>
              <span className="text-xl font-bold italic">{getFr(match.team1)}</span>
              <div><OddsBadge team={match.team1} /></div>
            </div>
          </div>
          <span className="text-wc-muted font-bold italic text-lg">vs</span>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xl font-bold italic">{getFr(match.team2)}</span>
              <div><OddsBadge team={match.team2} /></div>
            </div>
            <span className="text-4xl">{getFlag(match.team2)}</span>
          </div>
        </div>
        <MatchOdds1X2 team1={match.team1} team2={match.team2} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-wc-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-bold italic whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'text-wc-gold border-b-2 border-wc-gold'
                : 'text-wc-muted hover:text-wc-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'briefing' && (
          <AgenticTab match={match} />
        )}
        {activeTab === 'stats' && (
          <QuantitativeSection team1={match.team1} team2={match.team2} data={quantData} />
        )}
      </div>
    </div>
  );
}

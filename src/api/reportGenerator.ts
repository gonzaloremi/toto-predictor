import type { MatchReport, HeadToHeadRecord, TeamLastMatch, TeamWcHistory, TeamStats } from '../types';
import { fetchOdds, fetchPressAnalysis, fetchHistoricalBehavior, fetchEurosportContext } from './perplexity';
import { synthesizeReport } from './openai';
import { fetchFigaroPronostic, figaroToPromptContext } from './figaro';
import { saveToStore } from './storage';

export interface EurosportContext {
  content: string;
  citations: string[];
  fetchedAt: string;
}

const EUROSPORT_CACHE_KEY = 'wc2026_eurosport_v2';
const EUROSPORT_TTL_MS = 12 * 60 * 60 * 1000;

function getEurosportCache(): Record<string, EurosportContext> {
  try {
    return JSON.parse(localStorage.getItem(EUROSPORT_CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Contexte Eurosport via Perplexity (filtre eurosport.fr), cache 12h par match.
 * Appele a l'ouverture de l'onglet Analyse expert et lors de la generation du rapport.
 */
export async function getEurosportContext(
  matchId: number,
  team1: string,
  team2: string,
  date: string
): Promise<EurosportContext> {
  const cached = getEurosportCache()[String(matchId)];
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < EUROSPORT_TTL_MS) {
    return cached;
  }

  const result = await fetchEurosportContext(team1, team2, date);
  const ctx: EurosportContext = {
    content: result.content,
    citations: result.citations,
    fetchedAt: new Date().toISOString(),
  };
  const cache = getEurosportCache();
  cache[String(matchId)] = ctx;
  localStorage.setItem(EUROSPORT_CACHE_KEY, JSON.stringify(cache));
  // Persist to Supabase
  saveToStore('eurosport_cache', String(matchId), ctx, EUROSPORT_CACHE_KEY);
  return ctx;
}

import lastMatchesData from '../data/generated/lastMatches.json';
import wcHistoryData from '../data/generated/wcHistory.json';
import headToHeadData from '../data/generated/headToHead.json';
import teamStatsData from '../data/generated/teamStats.json';
import wilooSummariesData from '../data/generated/wiloo-summaries.json';

export interface WilooTeamSummary {
  tier: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  players: string;
  videos: string[];
}

export function getWilooContext(team1: string, team2: string): { team1: WilooTeamSummary | null; team2: WilooTeamSummary | null; combined: string } {
  const data = wilooSummariesData as Record<string, WilooTeamSummary>;
  const t1 = data[team1] ?? null;
  const t2 = data[team2] ?? null;

  const parts: string[] = [];
  if (t1?.summary) parts.push(`${team1} (${t1.tier}) : ${t1.summary} Forces : ${t1.strengths}. Faiblesses : ${t1.weaknesses}.`);
  if (t2?.summary) parts.push(`${team2} (${t2.tier}) : ${t2.summary} Forces : ${t2.strengths}. Faiblesses : ${t2.weaknesses}.`);

  return { team1: t1, team2: t2, combined: parts.join('\n\n') };
}

const CACHE_KEY = 'wc2026_reports';

function getCachedReports(): Record<string, MatchReport> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveReport(report: MatchReport) {
  const cache = getCachedReports();
  cache[String(report.matchId)] = report;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  // Persist to Supabase
  saveToStore('reports', String(report.matchId), report, CACHE_KEY);
}

export function getReport(matchId: number): MatchReport | null {
  const cache = getCachedReports();
  return cache[String(matchId)] ?? null;
}

export function getQuantitativeData(team1: string, team2: string) {
  const t1Last = (lastMatchesData as unknown as Record<string, TeamLastMatch[]>)[team1] ?? [];
  const t2Last = (lastMatchesData as unknown as Record<string, TeamLastMatch[]>)[team2] ?? [];
  const t1Wc = (wcHistoryData as unknown as Record<string, TeamWcHistory>)[team1];
  const t2Wc = (wcHistoryData as unknown as Record<string, TeamWcHistory>)[team2];
  const t1Stats = (teamStatsData as Record<string, TeamStats>)[team1];
  const t2Stats = (teamStatsData as Record<string, TeamStats>)[team2];

  const h2hKey = [team1, team2].sort().join('_vs_');
  const h2h = (headToHeadData as unknown as Record<string, HeadToHeadRecord>)[h2hKey] ?? null;

  return {
    team1LastMatches: t1Last,
    team2LastMatches: t2Last,
    team1WcHistory: t1Wc,
    team2WcHistory: t2Wc,
    team1Stats: t1Stats,
    team2Stats: t2Stats,
    headToHead: h2h,
  };
}

export async function generateReport(
  matchId: number,
  team1: string,
  team2: string,
  date: string,
  group: string,
  onProgress?: (step: string) => void
): Promise<MatchReport> {
  const existing = getReport(matchId);
  if (existing) return existing;

  onProgress?.('Recuperation des cotes bookmakers...');
  const odds = await fetchOdds(team1, team2, date);

  onProgress?.('Analyse de la presse sportive...');
  const press = await fetchPressAnalysis(team1, team2, date, group);

  onProgress?.('Analyse historique et comportement...');
  const history = await fetchHistoricalBehavior(team1, team2);

  const quantData = getQuantitativeData(team1, team2);
  const wiloo = getWilooContext(team1, team2);

  onProgress?.('Recuperation du pronostic Le Figaro...');
  const figaro = await fetchFigaroPronostic(matchId, team1, team2, date).catch(() => null);

  onProgress?.('Recuperation du contexte Eurosport...');
  const eurosport = await getEurosportContext(matchId, team1, team2, date).catch(() => null);

  onProgress?.('Synthese finale et pronostic (OpenAI)...');
  const prediction = await synthesizeReport({
    team1,
    team2,
    oddsReport: odds.content,
    pressReport: press.content,
    historyReport: history.content,
    quantitativeData: quantData,
    wilooContext: wiloo.combined || undefined,
    figaroContext: figaro ? figaroToPromptContext(figaro, team1, team2) : undefined,
    eurosportContext: eurosport?.content || undefined,
  });

  const report: MatchReport = {
    matchId,
    generatedAt: new Date().toISOString(),
    team1,
    team2,
    odds: { raw: odds.content, citations: odds.citations },
    pressAnalysis: { raw: press.content, citations: press.citations },
    historicalBehavior: { raw: history.content, citations: history.citations },
    prediction,
  };

  saveReport(report);
  return report;
}

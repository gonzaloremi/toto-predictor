import type { ScheduleMatch } from '../types';
import { getQuantitativeData, getWilooContext, getEurosportContext } from './reportGenerator';
import { fetchFigaroPronostic, figaroToPromptContext } from './figaro';
import { saveToStore } from './storage';
import oddsData from '../data/generated/tournament-odds.json';

const teamsOdds = oddsData.teams as Record<string, { odds: number; rank: number; probability: number }>;

export interface Briefing {
  matchId: number;
  score: [number, number];
  confidence: number;
  briefing: string;
  generatedAt: string;
  sources: BriefingSources;
}

export interface BriefingSources {
  quantiText: string;
  wilooText: string;
  figaroText: string;
  eurosportText: string;
  eurosportCitations: string[];
  figaroUrl?: string;
  figaroWinProb?: { team1: number; team2: number };
}

const CACHE_KEY = 'wc2026_briefings';

function getCache(): Record<string, Briefing> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function getCachedBriefing(matchId: number): Briefing | null {
  return getCache()[String(matchId)] ?? null;
}

function saveBriefing(briefing: Briefing) {
  const cache = getCache();
  cache[String(briefing.matchId)] = briefing;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  // Persist to Supabase in background
  saveToStore('briefings', String(briefing.matchId), briefing, CACHE_KEY);
}

function formatQuantiContext(team1: string, team2: string): string {
  const q = getQuantitativeData(team1, team2);
  const lines: string[] = [];

  const formatForm = (name: string, stats: typeof q.team1Stats, last: typeof q.team1LastMatches) => {
    if (!stats) return;
    lines.push(`${name} : forme récente ${stats.recentForm} (${stats.last10.won}V ${stats.last10.drawn}N ${stats.last10.lost}D sur 10 matchs, ${stats.avgGoalsScored.toFixed(1)} buts/match, ${stats.avgGoalsConceded.toFixed(1)} encaissés/match, ${stats.wcAppearances} CdM).`);
    if (last.length > 0) {
      const recent = last.slice(0, 5).map(m => `${m.date} ${m.home ? 'vs' : '@'} ${m.opponent} ${m.score[0]}-${m.score[1]} (${m.result})`).join(', ');
      lines.push(`  5 derniers matchs : ${recent}`);
    }
  };

  formatForm(team1, q.team1Stats, q.team1LastMatches);
  formatForm(team2, q.team2Stats, q.team2LastMatches);

  if (q.team1WcHistory) {
    const s = q.team1WcHistory.stats;
    lines.push(`${team1} en CdM : ${q.team1WcHistory.appearances} participations, ${s.played}J ${s.won}V ${s.drawn}N ${s.lost}D (${s.goalsFor} buts pour, ${s.goalsAgainst} contre).`);
  }
  if (q.team2WcHistory) {
    const s = q.team2WcHistory.stats;
    lines.push(`${team2} en CdM : ${q.team2WcHistory.appearances} participations, ${s.played}J ${s.won}V ${s.drawn}N ${s.lost}D (${s.goalsFor} buts pour, ${s.goalsAgainst} contre).`);
  }

  if (q.headToHead && q.headToHead.totalMatches > 0) {
    const h = q.headToHead;
    const w1 = h.wins[team1] ?? 0;
    const w2 = h.wins[team2] ?? 0;
    const draws = h.totalMatches - w1 - w2;
    lines.push(`Confrontations directes : ${h.totalMatches} matchs (${team1} ${w1}V - ${draws}N - ${w2}V ${team2}).`);
    if (h.inWorldCup.length > 0) {
      const wcMeetings = h.inWorldCup.map(m => `${m.date} ${m.score[0]}-${m.score[1]}`).join(', ');
      lines.push(`  En CdM : ${wcMeetings}`);
    }
    if (h.lastMeetings.length > 0) {
      const last = h.lastMeetings[0];
      lines.push(`  Dernier match : ${last.date} ${last.homeTeam} ${last.score[0]}-${last.score[1]} (${last.tournament})`);
    }
  }

  return lines.join('\n');
}

export async function generateBriefing(
  match: ScheduleMatch,
  onProgress?: (step: string) => void
): Promise<Briefing> {
  const cached = getCachedBriefing(match.id);
  if (cached) return cached;

  onProgress?.('Collecte des données quantitatives...');
  const quantiText = formatQuantiContext(match.team1, match.team2);

  const wiloo = getWilooContext(match.team1, match.team2);
  const wilooText = wiloo.combined || 'Pas d\'analyse Wiloo disponible.';

  onProgress?.('Récupération du contexte Figaro + Eurosport...');
  const [figaro, eurosport] = await Promise.all([
    fetchFigaroPronostic(match.id, match.team1, match.team2, match.date).catch(() => null),
    getEurosportContext(match.id, match.team1, match.team2, match.date).catch(() => null),
  ]);

  const figaroText = figaro ? figaroToPromptContext(figaro, match.team1, match.team2) : 'Pas encore d\'article Le Figaro.';
  const eurosportText = eurosport?.content || 'Pas de contexte Eurosport.';

  const odds1 = teamsOdds[match.team1];
  const odds2 = teamsOdds[match.team2];
  const oddsText = [
    odds1 ? `${match.team1} : cote ${odds1.odds}, rang #${odds1.rank}, proba ${odds1.probability}%` : '',
    odds2 ? `${match.team2} : cote ${odds2.odds}, rang #${odds2.rank}, proba ${odds2.probability}%` : '',
  ].filter(Boolean).join('\n');

  const userContent = `## Match : ${match.team1} vs ${match.team2}
Date : ${match.date} · ${match.group ?? match.round} · ${match.ground}

## Cotes tournoi (Winamax)
${oddsText || 'Non disponible'}

## Données quantitatives
${quantiText}

## Analyse Wiloo (expert YouTube, 1M+ abonnés)
${wilooText}

## Le Figaro — Pronostic
${figaroText}

## Eurosport — Articles récents
${eurosportText}`;

  onProgress?.('Génération du briefing GPT-5.5...');

  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [
        {
          role: 'system',
          content: `Tu es un analyste football d'élite qui rédige des briefings pré-match pour un pronostiqueur expert.

Tu reçois TOUT le contexte disponible sur un match de la Coupe du Monde 2026.
Ton rôle : synthétiser ce contexte en un BRIEFING UNIQUE, sharp, factuel et opinioné.

FORMAT STRICT :
1. Commence par ton PRONOSTIC : score exact + niveau de confiance (1 à 5 étoiles)
2. Puis le briefing en ~800-1200 mots, structuré en paragraphes fluides (pas de bullet points)
3. Couvre dans l'ordre : dynamique des équipes, forces/faiblesses clés, contexte tactique, ce que les experts disent (Wiloo, presse, bookmakers), confrontations passées, facteurs X
4. Termine par 3 "facteurs décisifs" et 2 "risques" en une ligne chacun

STYLE : dense, direct, zéro remplissage. Chaque phrase doit apporter de l'info.
Écris ENTIÈREMENT en français.

Réponds en JSON :
{
  "score": [buts_equipe1, buts_equipe2],
  "confidence": 1-5,
  "briefing": "texte markdown du briefing complet"
}`,
        },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);

  const briefing: Briefing = {
    matchId: match.id,
    score: parsed.score ?? [0, 0],
    confidence: parsed.confidence ?? 3,
    briefing: parsed.briefing ?? '',
    generatedAt: new Date().toISOString(),
    sources: {
      quantiText,
      wilooText,
      figaroText,
      eurosportText,
      eurosportCitations: eurosport?.citations ?? [],
      figaroUrl: figaro?.url,
      figaroWinProb: figaro?.winProbability ?? undefined,
    },
  };

  saveBriefing(briefing);
  return briefing;
}

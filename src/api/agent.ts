import { supabase } from '../lib/supabase';
import { getQuantitativeData } from './reportGenerator';
import { getFr } from '../data/nameMapping';
import oddsData from '../data/generated/tournament-odds.json';
import scheduleData from '../data/generated/schedule.json';
import type { ScheduleMatch } from '../types';

const teamsOdds = oddsData.teams as Record<string, { odds: number; rank: number; probability: number }>;
const schedule = scheduleData as ScheduleMatch[];

// ─── Tool definitions (OpenAI function calling format) ─────────────────────

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_wiloo',
      description:
        'Recherche dans les transcripts vidéo de Wiloo (YouTubeur foot expert, 1M+ abonnés) ce qu\'il dit sur les équipes données. Retourne les extraits pertinents de ses analyses.',
      parameters: {
        type: 'object',
        properties: {
          teams: {
            type: 'array',
            items: { type: 'string' },
            description: 'Liste des noms d\'équipes à rechercher (en anglais, ex: ["Brazil", "Morocco"])',
          },
        },
        required: ['teams'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_match_stats',
      description:
        'Retourne les statistiques quantitatives du match : forme récente des deux équipes, historique en Coupe du Monde, confrontations directes, et derniers résultats.',
      parameters: {
        type: 'object',
        properties: {
          team1: { type: 'string', description: 'Première équipe (en anglais)' },
          team2: { type: 'string', description: 'Deuxième équipe (en anglais)' },
        },
        required: ['team1', 'team2'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tournament_odds',
      description:
        'Retourne les cotes Winamax de victoire du tournoi pour les deux équipes : cote, rang mondial, probabilité implicite.',
      parameters: {
        type: 'object',
        properties: {
          team1: { type: 'string', description: 'Première équipe (en anglais)' },
          team2: { type: 'string', description: 'Deuxième équipe (en anglais)' },
        },
        required: ['team1', 'team2'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_group_context',
      description:
        'Retourne le contexte complet du groupe : les 4 équipes avec leurs cotes, le calendrier des matchs du groupe, et quel groupe croise en phase éliminatoire.',
      parameters: {
        type: 'object',
        properties: {
          group: { type: 'string', description: 'Nom du groupe (ex: "Group F")' },
        },
        required: ['group'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_sofoot',
      description:
        'Recherche et lit les articles So Foot (presse football française experte) sur une équipe donnée. Retourne le contenu des articles trouvés : analyses, compositions, contexte.',
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Nom de l\'équipe à rechercher (en anglais, ex: "Brazil")' },
        },
        required: ['team'],
      },
    },
  },
];

// ─── Tool executors ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const TEAM_SEARCH_VARIANTS: Record<string, string[]> = {
  // Teams whose English name differs from French — all 48 WC teams covered
  'algeria': ['algérie', 'algerie', 'algérien'],
  'argentina': ['argentine', 'argentin'],
  'australia': ['australie', 'australien'],
  'austria': ['autriche', 'autrichien'],
  'belgium': ['belgique', 'belge'],
  'bosnia & herzegovina': ['bosnie', 'herzégovine', 'bosnien'],
  'bosnia and herzegovina': ['bosnie', 'herzégovine', 'bosnien'],
  'brazil': ['brésil', 'bresil', 'brésilien', 'bresilien'],
  'cape verde': ['cap-vert', 'cap vert', 'capverdien'],
  'colombia': ['colombie', 'colombien'],
  'croatia': ['croatie', 'croate'],
  'curacao': ['curaçao', 'curacao'],
  'curaçao': ['curaçao', 'curacao'],
  'czech republic': ['tchéquie', 'tcheque', 'république tchèque', 'republique tcheque'],
  'dr congo': ['rd congo', 'congo', 'congolais'],
  'ecuador': ['équateur', 'equateur', 'équatorien'],
  'egypt': ['égypte', 'egypte', 'égyptien'],
  'england': ['angleterre', 'anglais'],
  'germany': ['allemagne', 'allemand'],
  'haiti': ['haïti', 'haiti', 'haïtien', 'haitien'],
  'iran': ['iran', 'iranien'],
  'iraq': ['irak', 'irakien'],
  'ivory coast': ['côte d\'ivoire', 'cote d\'ivoire', 'ivoirien'],
  'japan': ['japon', 'japonais'],
  'jordan': ['jordanie', 'jordanien'],
  'mexico': ['mexique', 'mexicain'],
  'morocco': ['maroc', 'marocain'],
  'netherlands': ['pays-bas', 'pays bas', 'néerlandais', 'hollandais', 'hollande'],
  'new zealand': ['nouvelle-zélande', 'nouvelle zelande', 'néo-zélandais', 'all whites'],
  'norway': ['norvège', 'norvege', 'norvégien'],
  'saudi arabia': ['arabie saoudite', 'saoudien', 'saudi'],
  'scotland': ['écosse', 'ecosse', 'écossais'],
  'senegal': ['sénégal', 'senegal', 'sénégalais'],
  'south africa': ['afrique du sud', 'sud-africain'],
  'south korea': ['corée du sud', 'coree du sud', 'coréen', 'coreen'],
  'spain': ['espagne', 'espagnol'],
  'sweden': ['suède', 'suede', 'suédois'],
  'switzerland': ['suisse'],
  'tunisia': ['tunisie', 'tunisien'],
  'turkey': ['turquie', 'turc'],
  'turkiye': ['turquie', 'turc', 'türkiye'],
  'usa': ['états-unis', 'etats-unis', 'usa', 'américain', 'americain'],
  'united states': ['états-unis', 'etats-unis', 'usa', 'américain', 'americain'],
  'uzbekistan': ['ouzbékistan', 'ouzbekistan', 'ouzbek'],
};

function getSearchTerms(team: string): string[] {
  const key = team.toLowerCase();
  const variants = TEAM_SEARCH_VARIANTS[key] ?? [];
  const base = [team.toLowerCase(), normalize(team)];
  return [...new Set([...base, ...variants])];
}

async function executeSearchWiloo(args: { teams: string[] }): Promise<string> {
  const { data, error } = await supabase
    .from('wiloo_videos')
    .select('video_id, transcript');

  if (error || !data || data.length === 0) {
    return 'Aucun transcript Wiloo disponible en base.';
  }

  const results: string[] = [];

  for (const team of args.teams) {
    const searchTerms = getSearchTerms(team);

    // Collect all match positions across all videos
    const rawHits: { videoId: string; pos: number; transcript: string }[] = [];

    for (const row of data) {
      const transcript = row.transcript as string;
      const normalized = normalize(transcript);

      for (const term of searchTerms) {
        const normTerm = normalize(term);
        let pos = normalized.indexOf(normTerm);
        while (pos !== -1) {
          rawHits.push({ videoId: row.video_id as string, pos, transcript });
          pos = normalized.indexOf(normTerm, pos + normTerm.length);
        }
      }
    }

    if (rawHits.length === 0) {
      results.push(`## ${team}\nAucune mention trouvée dans les transcripts Wiloo.`);
      continue;
    }

    // Extract wide windows (200 before, 300 after) and merge overlapping ones
    const windows: { videoId: string; start: number; end: number; transcript: string }[] = [];
    for (const hit of rawHits) {
      const start = Math.max(0, hit.pos - 200);
      const end = Math.min(hit.transcript.length, hit.pos + 300);
      // Merge with existing window from same video if overlapping
      const existing = windows.find(
        (w) => w.videoId === hit.videoId && w.transcript === hit.transcript && start <= w.end + 50 && end >= w.start - 50,
      );
      if (existing) {
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
      } else {
        windows.push({ videoId: hit.videoId, start, end, transcript: hit.transcript });
      }
    }

    // Sort by position within each video for coherent reading order
    windows.sort((a, b) => {
      if (a.videoId !== b.videoId) return a.videoId.localeCompare(b.videoId);
      return a.start - b.start;
    });

    const excerpts = windows.map(
      (w) => `[${w.videoId}] ...${w.transcript.slice(w.start, w.end)}...`,
    );

    results.push(
      `## ${team} (${rawHits.length} mentions dans ${new Set(rawHits.map((h) => h.videoId)).size} vidéos)\n\n${excerpts.join('\n\n---\n\n')}`,
    );
  }

  const full = results.join('\n\n===\n\n');
  // Allow up to 30K — the LLM can handle it, and completeness is critical
  return full.length > 30000 ? full.slice(0, 30000) + '\n\n[... tronqué]' : full;
}

function executeGetMatchStats(args: { team1: string; team2: string }): string {
  const q = getQuantitativeData(args.team1, args.team2);
  const lines: string[] = [];

  const formatTeam = (name: string, stats: typeof q.team1Stats, last: typeof q.team1LastMatches, wc: typeof q.team1WcHistory) => {
    if (stats) {
      lines.push(`## ${name}`);
      lines.push(`Forme récente : ${stats.recentForm} (${stats.last10.won}V ${stats.last10.drawn}N ${stats.last10.lost}D sur 10 matchs)`);
      lines.push(`Buts/match : ${stats.avgGoalsScored.toFixed(1)} marqués, ${stats.avgGoalsConceded.toFixed(1)} encaissés`);
      lines.push(`Participations CdM : ${stats.wcAppearances}`);
    }
    if (last.length > 0) {
      lines.push(`Derniers matchs :`);
      for (const m of last.slice(0, 5)) {
        lines.push(`  ${m.date} ${m.home ? 'vs' : '@'} ${m.opponent} ${m.score[0]}-${m.score[1]} (${m.result}) [${m.tournament}]`);
      }
    }
    if (wc) {
      const s = wc.stats;
      lines.push(`Historique CdM : ${wc.appearances} participations, ${s.played}J ${s.won}V ${s.drawn}N ${s.lost}D (${s.goalsFor} bp, ${s.goalsAgainst} bc)`);
    }
  };

  formatTeam(args.team1, q.team1Stats, q.team1LastMatches, q.team1WcHistory);
  lines.push('');
  formatTeam(args.team2, q.team2Stats, q.team2LastMatches, q.team2WcHistory);

  if (q.headToHead && q.headToHead.totalMatches > 0) {
    const h = q.headToHead;
    const w1 = h.wins[args.team1] ?? 0;
    const w2 = h.wins[args.team2] ?? 0;
    const draws = h.totalMatches - w1 - w2;
    lines.push('');
    lines.push(`## Confrontations directes`);
    lines.push(`${h.totalMatches} matchs : ${args.team1} ${w1}V - ${draws}N - ${w2}V ${args.team2}`);
    if (h.inWorldCup.length > 0) {
      lines.push(`En CdM : ${h.inWorldCup.map(m => `${m.date} ${m.homeTeam} ${m.score[0]}-${m.score[1]}`).join(', ')}`);
    }
    if (h.lastMeetings.length > 0) {
      lines.push(`Dernières rencontres :`);
      for (const m of h.lastMeetings.slice(0, 3)) {
        lines.push(`  ${m.date} ${m.homeTeam} ${m.score[0]}-${m.score[1]} (${m.tournament})`);
      }
    }
  }

  return lines.join('\n');
}

function executeGetTournamentOdds(args: { team1: string; team2: string }): string {
  const lines: string[] = [];
  for (const team of [args.team1, args.team2]) {
    const odds = teamsOdds[team];
    if (odds) {
      lines.push(`${team} : cote victoire tournoi ${odds.odds}, rang #${odds.rank}, probabilité implicite ${odds.probability}%`);
    } else {
      lines.push(`${team} : cotes non disponibles`);
    }
  }
  return lines.join('\n');
}

const KNOCKOUT_CROSSINGS: Record<string, string> = {
  'Group A': 'Le 1er du A croise le 2e du B en 8e. Le 2e du A croise le 1er du B.',
  'Group B': 'Le 1er du B croise le 2e du A en 8e. Le 2e du B croise le 1er du A.',
  'Group C': 'Le 1er du C croise le 2e du D en 8e. Le 2e du C croise le 1er du D.',
  'Group D': 'Le 1er du D croise le 2e du C en 8e. Le 2e du D croise le 1er du C.',
  'Group E': 'Le 1er du E croise le 2e du F en 8e. Le 2e du E croise le 1er du F.',
  'Group F': 'Le 1er du F croise le 2e du E en 8e. Le 2e du F croise le 1er du E.',
  'Group G': 'Le 1er du G croise le 2e du H en 8e. Le 2e du G croise le 1er du H.',
  'Group H': 'Le 1er du H croise le 2e du G en 8e. Le 2e du H croise le 1er du G.',
  'Group I': 'Le 1er du I croise le 2e du J en 8e. Le 2e du I croise le 1er du J.',
  'Group J': 'Le 1er du J croise le 2e du I en 8e. Le 2e du J croise le 1er du I.',
  'Group K': 'Le 1er du K croise le 2e du L en 8e. Le 2e du K croise le 1er du L.',
  'Group L': 'Le 1er du L croise le 2e du K en 8e. Le 2e du L croise le 1er du K.',
};

function executeGetGroupContext(args: { group: string }): string {
  const groupMatches = schedule.filter(
    (m) => m.group === args.group && m.team1 && !m.team1.match(/^\d/),
  );
  if (groupMatches.length === 0) return `Aucun match trouvé pour ${args.group}.`;

  const teams = new Set<string>();
  for (const m of groupMatches) {
    if (m.team1) teams.add(m.team1);
    if (m.team2) teams.add(m.team2);
  }

  const lines: string[] = [`## ${args.group}`];

  lines.push('\n### Équipes et cotes victoire finale');
  for (const t of teams) {
    const o = teamsOdds[t];
    lines.push(o
      ? `- ${t} : cote ${o.odds}, rang #${o.rank}, proba ${o.probability}%`
      : `- ${t} : cotes non disponibles`);
  }

  lines.push('\n### Calendrier');
  for (const m of groupMatches.sort((a, b) => a.date.localeCompare(b.date))) {
    const scoreStr = m.score ? ` → ${m.score.ft[0]}-${m.score.ft[1]}` : '';
    lines.push(`- ${m.date} ${m.round}: ${m.team1} vs ${m.team2}${scoreStr} (${m.ground})`);
  }

  const crossing = KNOCKOUT_CROSSINGS[args.group];
  if (crossing) {
    lines.push(`\n### Phase éliminatoire\n${crossing}`);
    const crossGroup = crossing.match(/du ([A-L])/)?.[1];
    if (crossGroup) {
      const crossGroupName = `Group ${crossGroup}`;
      const crossMatches = schedule.filter((m) => m.group === crossGroupName && m.team1 && !m.team1.match(/^\d/));
      const crossTeams = new Set<string>();
      for (const m of crossMatches) {
        if (m.team1) crossTeams.add(m.team1);
        if (m.team2) crossTeams.add(m.team2);
      }
      lines.push(`Équipes du ${crossGroupName} : ${[...crossTeams].map((t) => {
        const o = teamsOdds[t];
        return o ? `${t} (cote ${o.odds})` : t;
      }).join(', ')}`);
    }
  }

  return lines.join('\n');
}

async function executeSearchSofoot(args: { team: string }): Promise<string> {
  const frName = getFr(args.team);

  // Step 1: Use Perplexity to discover So Foot article URLs
  let articleUrls: string[] = [];
  try {
    const res = await fetch('/api/perplexity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Trouve les articles So Foot sur cette équipe pour la Coupe du Monde 2026.' },
          { role: 'user', content: `Articles So Foot sur ${frName} coupe du monde 2026` },
        ],
        web_search_options: { search_context_size: 'high' },
        search_domain_filter: ['sofoot.com'],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const citations: string[] = data.citations ?? [];
      const searchResults: Array<{ url: string }> = data.search_results ?? [];

      // Collect URLs from both citations and search_results
      const allUrls = [
        ...citations,
        ...searchResults.map((r) => r.url),
      ];
      articleUrls = [...new Set(allUrls)]
        .filter((url: string) => url.includes('sofoot.com/') && (url.includes('/articles/') || url.includes('/breves/')))
        .slice(0, 3);
    }
  } catch {
    // Perplexity failed, we'll return empty
  }

  if (articleUrls.length === 0) {
    return `Aucun article So Foot trouvé pour ${frName}.`;
  }

  // Step 2: Fetch each article via the CORS proxy
  const articles: string[] = [];
  for (const url of articleUrls) {
    try {
      const proxyUrl = `/api/sofoot?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;

      const html = await res.text();
      const text = parseSofootHtml(html);
      if (text.length > 100) {
        articles.push(`=== ${url} ===\n${text}`);
      }
    } catch {
      continue;
    }
  }

  if (articles.length === 0) {
    return `Aucun article So Foot trouvé pour ${frName}.`;
  }

  const full = `## So Foot — ${frName} (${articles.length} articles)\n\n${articles.join('\n\n---\n\n')}`;
  return full.length > 25000 ? full.slice(0, 25000) + '\n\n[... tronqué]' : full;
}

function parseSofootHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove nav, footer, scripts, style, ads, comments section
  for (const sel of ['nav', 'footer', 'script', 'style', '.sidebar', '.comments', '.pub', '.ad', '[class*="partner"]', '[class*="tendance"]']) {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  }

  // Try to get the article content specifically
  const article = doc.querySelector('article') ?? doc.querySelector('.article-content') ?? doc.querySelector('main');
  const target = article ?? doc.body;

  // Extract text, clean up whitespace
  const text = (target.textContent ?? '')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1')
    .trim();

  return text.length > 8000 ? text.slice(0, 8000) + '...' : text;
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_wiloo':
      return executeSearchWiloo(args as { teams: string[] });
    case 'get_match_stats':
      return executeGetMatchStats(args as { team1: string; team2: string });
    case 'get_tournament_odds':
      return executeGetTournamentOdds(args as { team1: string; team2: string });
    case 'get_group_context':
      return executeGetGroupContext(args as { group: string });
    case 'search_sofoot':
      return executeSearchSofoot(args as { team: string });
    default:
      return `Outil inconnu : ${name}`;
  }
}

// ─── LLM call (non-streaming for tool iterations, reliable through Vite proxy) ─

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

async function callLLM(
  messages: Array<Record<string, unknown>>,
  tools: typeof TOOLS,
  signal?: AbortSignal,
): Promise<LLMResponse> {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, tools }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? null,
    toolCalls: (choice?.message?.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    })),
    finishReason: choice?.finish_reason ?? null,
  };
}

// ─── Anthropic API call ─────────────────────────────────────────────────────

async function callClaude(
  system: string,
  userContent: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      system,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 4096,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const block = data.content?.[0];
  return block?.text ?? '';
}

// ─── Structured output types ────────────────────────────────────────────────

export interface AgentSource {
  type: 'wiloo' | 'sofoot';
  label: string;
  url: string;
}

export interface StructuredAnalysis {
  team1: TeamAnalysis;
  team2: TeamAnalysis;
  headToHead: string;
  wilooVerdict: WilooVerdict;
  prediction: Prediction;
  keyFactors: KeyFactor[];
  sources?: AgentSource[];
}

interface TeamAnalysis {
  name: string;
  form: string;
  strengths: string[];
  weaknesses: string[];
  keyPlayers: string[];
  wilooQuote: string;
}

interface WilooVerdict {
  groupRanking: string[];
  favorite: string;
  keyArgument: string;
  coachComparison: string;
}

interface Prediction {
  score1: number;
  score2: number;
  confidence: number;
  reasoning: string;
}

interface KeyFactor {
  team: string;
  advantage: string;
  description: string;
}

// ─── Agent loop ─────────────────────────────────────────────────────────────

const GATHERING_PROMPT = `Tu es un assistant de collecte de données pour l'analyse de matchs de la Coupe du Monde 2026.

Tu as accès à 5 outils :
1. search_wiloo — Recherche dans les transcripts vidéo de Wiloo (YouTubeur foot expert, 1M+ abonnés)
2. get_match_stats — Stats quantitatives (forme, historique CdM, confrontations directes)
3. get_tournament_odds — Cotes Winamax de victoire du tournoi
4. get_group_context — Composition du groupe, calendrier, croisements en phase éliminatoire
5. search_sofoot — Recherche et lit les articles So Foot (presse football française experte) sur une équipe

MÉTHODE OBLIGATOIRE — appelle TOUS ces outils dans cet ordre :
1. search_wiloo avec les deux équipes du match
2. get_match_stats avec les deux équipes
3. get_tournament_odds avec les deux équipes
4. get_group_context avec le groupe du match
5. search_sofoot pour la première équipe
6. search_sofoot pour la deuxième équipe

Une fois que tu as les résultats de tous les outils, réponds simplement "DONNÉES COLLECTÉES" sans analyse.
Ne fais AUCUNE synthèse, ne donne AUCUN pronostic. Contente-toi de collecter les données.`;

const SYNTHESIS_PROMPT = `Tu es un analyste football d'élite. Tu dois produire une analyse structurée d'un match de Coupe du Monde 2026 au format JSON.

CADRE D'ANALYSE :
- Cite EXPLICITEMENT les arguments de Wiloo (YouTubeur foot expert, 1M+ abonnés) : son classement du groupe, ses joueurs clés, son verdict
- Intègre les analyses de So Foot (presse football française de référence) : reportages, compositions, contexte des équipes
- Compare la qualité des sélectionneurs (un thème clé chez Wiloo)
- Identifie les joueurs spécifiques mentionnés par Wiloo et So Foot avec leur contexte (club, stats)
- Analyse le parcours en phase éliminatoire (qui croise le groupe)
- Évalue la forme récente et les confrontations directes

RÈGLES :
- Écris en français
- Sois précis et factuel, cite les chiffres
- Le champ "confidence" va de 1 (très incertain) à 5 (quasi certain)
- Le "wilooQuote" doit être une vraie citation ou paraphrase de ce que Wiloo a dit
- Le "groupRanking" est l'ordre prédit par Wiloo pour le groupe (4 équipes)
- Les "keyFactors" sont les 3-4 facteurs décisifs du match

Réponds UNIQUEMENT avec un objet JSON valide respectant ce schéma :
{
  "team1": {
    "name": "string",
    "form": "description courte de la forme récente",
    "strengths": ["force 1", "force 2"],
    "weaknesses": ["faiblesse 1"],
    "keyPlayers": ["Joueur (Club) — contexte"],
    "wilooQuote": "citation/paraphrase de Wiloo sur cette équipe"
  },
  "team2": { ... même structure ... },
  "headToHead": "résumé des confrontations directes",
  "wilooVerdict": {
    "groupRanking": ["1er", "2e", "3e", "4e"],
    "favorite": "nom de l'équipe favorite selon Wiloo",
    "keyArgument": "argument principal de Wiloo",
    "coachComparison": "comparaison des sélectionneurs par Wiloo"
  },
  "prediction": {
    "score1": 1,
    "score2": 0,
    "confidence": 3,
    "reasoning": "explication du pronostic en 2-3 phrases"
  },
  "keyFactors": [
    { "team": "nom", "advantage": "titre court", "description": "détail" }
  ]
}`;

export interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_done' | 'done' | 'error' | 'llm_call' | 'llm_response' | 'thinking' | 'structured';
  text?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  iteration?: number;
  messageCount?: number;
  structured?: StructuredAnalysis;
}

export async function runAgent(
  match: ScheduleMatch,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  // ── Phase 1: Data gathering with GPT-4o-mini ──
  const messages: Array<{ role: string; content?: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string }> = [
    { role: 'system', content: GATHERING_PROMPT },
    {
      role: 'user',
      content: `Collecte toutes les données pour ce match :\n\n**${getFr(match.team1)} vs ${getFr(match.team2)}**\n(noms anglais pour les tools : ${match.team1} / ${match.team2})\nDate : ${match.date}\n${match.group ? `Groupe : ${match.group}` : `Tour : ${match.round}`}\nStade : ${match.ground}`,
    },
  ];

  const MAX_ITERATIONS = 8;
  const collectedData: { toolName: string; result: string }[] = [];
  const sources: AgentSource[] = [];

  onEvent({ type: 'thinking', text: 'Phase 1 — Collecte des données (GPT-4o-mini)' });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) return;

    onEvent({ type: 'llm_call', iteration: i + 1, messageCount: messages.length, text: `Itération ${i + 1} — GPT-4o-mini (collecte)` });

    let response: LLMResponse;
    try {
      response = await callLLM(messages, TOOLS, signal);
    } catch (err) {
      onEvent({ type: 'error', text: err instanceof Error ? err.message : String(err) });
      return;
    }

    onEvent({
      type: 'llm_response',
      iteration: i + 1,
      text: response.finishReason === 'tool_calls'
        ? `Le modèle veut appeler ${response.toolCalls.length} outil(s)`
        : 'Collecte terminée',
    });

    if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {
      const assistantMsg = {
        role: 'assistant',
        content: null as string | null,
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
      messages.push(assistantMsg);

      for (const tc of response.toolCalls) {
        const name = tc.function.name;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        onEvent({ type: 'tool_start', toolName: name, toolArgs: JSON.stringify(args, null, 2) });

        const result = await executeTool(name, args);
        collectedData.push({ toolName: name, result });
        onEvent({ type: 'tool_done', toolName: name, toolResult: result });

        // Extract sources for the final references section
        if (name === 'search_wiloo') {
          const videoIds = [...new Set(Array.from(result.matchAll(/\[([a-zA-Z0-9_-]{11})\]/g), (m) => m[1]))];
          for (const vid of videoIds) {
            if (!sources.some((s) => s.url.includes(vid))) {
              sources.push({ type: 'wiloo', label: `Wiloo — ${vid}`, url: `https://www.youtube.com/watch?v=${vid}` });
            }
          }
        } else if (name === 'search_sofoot') {
          const urls = Array.from(result.matchAll(/=== (https:\/\/www\.sofoot\.com\/[^\s]+) ===/g), (m) => m[1]);
          for (const url of urls) {
            if (!sources.some((s) => s.url === url)) {
              const slug = url.split('/').pop()?.replace(/-/g, ' ').slice(0, 60) ?? 'Article';
              sources.push({ type: 'sofoot', label: `So Foot — ${slug}`, url });
            }
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    break;
  }

  if (signal?.aborted) return;

  // ── Phase 2: Synthesis with Claude Opus 4.6 ──
  onEvent({ type: 'thinking', text: 'Phase 2 — Synthèse par Claude Opus 4.6' });
  onEvent({ type: 'llm_call', iteration: 0, messageCount: 1, text: 'Envoi du contexte complet à Claude Opus 4.6 pour synthèse structurée' });

  const contextParts = collectedData.map(
    (d) => `=== ${d.toolName} ===\n${d.result}`,
  );

  const userPrompt = `Analyse ce match de Coupe du Monde 2026 et produis ton analyse structurée en JSON.

**${getFr(match.team1)} vs ${getFr(match.team2)}**
Date : ${match.date}
${match.group ? `Groupe : ${match.group}` : `Tour : ${match.round}`}
Stade : ${match.ground}

IMPORTANT : Utilise les noms français des équipes dans toute l'analyse (ex: "Côte d'Ivoire" pas "Ivory Coast", "Pays-Bas" pas "Netherlands", "Équateur" pas "Ecuador").

Voici toutes les données collectées :

${contextParts.join('\n\n')}`;

  try {
    const raw = await callClaude(SYNTHESIS_PROMPT, userPrompt, signal);

    onEvent({ type: 'llm_response', iteration: 0, text: 'Claude Opus 4.6 a terminé la synthèse' });

    // Extract JSON from the response (Claude may wrap it in markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      onEvent({ type: 'text', text: raw });
      onEvent({ type: 'done' });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as StructuredAnalysis;
    parsed.sources = sources;
    onEvent({ type: 'structured', structured: parsed });
    onEvent({ type: 'done' });
  } catch (err) {
    onEvent({ type: 'error', text: `Erreur synthèse Claude: ${err instanceof Error ? err.message : String(err)}` });
  }
}

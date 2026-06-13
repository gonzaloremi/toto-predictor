interface PerplexityResult {
  content: string;
  citations: string[];
}

async function query(
  prompt: string,
  opts: {
    domainFilter?: string[];
    recency?: 'day' | 'week' | 'month' | 'year';
    contextSize?: 'low' | 'medium' | 'high';
  } = {}
): Promise<PerplexityResult> {
  const body: Record<string, unknown> = {
    messages: [
      { role: 'system', content: 'Tu es un expert en football. Tu dois TOUJOURS répondre entièrement en français, quelles que soient les sources consultées. Traduis tout contenu anglais en français.' },
      { role: 'user', content: prompt },
    ],
    web_search_options: { search_context_size: opts.contextSize ?? 'medium' },
  };
  if (opts.domainFilter?.length) {
    body.search_domain_filter = opts.domainFilter;
  }
  if (opts.recency) {
    body.search_recency_filter = opts.recency;
  }

  const res = await fetch('/api/perplexity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const citations = data.citations ?? [];
  return { content, citations };
}

export async function fetchOdds(team1: string, team2: string, date: string): Promise<PerplexityResult> {
  return query(
    `Cotes des bookmakers pour le match ${team1} vs ${team2}, Coupe du Monde 2026, ${date}.

Donne les cotes 1X2 (victoire ${team1}, nul, victoire ${team2}) de chaque bookmaker trouvé parmi :
Bet365, Unibet, Winamax, Betclic, William Hill, Pinnacle.

Donne aussi les cotes Over/Under 2.5 buts et BTTS (les deux equipes marquent) si disponibles.

IMPORTANT : Formate les cotes en tableau markdown avec colonnes : Bookmaker, Victoire ${team1}, Nul, Victoire ${team2}, Over 2.5, Under 2.5, BTTS Oui, BTTS Non.
Ajoute un paragraphe d'analyse résumant qui est favori et pourquoi.

Réponds entièrement en français.`,
    {
      domainFilter: ['oddschecker.com', 'oddsportal.com', 'betclic.fr', 'winamax.fr', 'unibet.fr', 'flashscore.com'],
      recency: 'day',
      contextSize: 'low',
    }
  );
}

export async function fetchPressAnalysis(team1: string, team2: string, date: string, group: string): Promise<PerplexityResult> {
  return query(
    `Analyse pré-match détaillée pour ${team1} vs ${team2} (Coupe du Monde 2026, ${group}, ${date}).

Synthétise les analyses récentes des experts et journalistes sportifs :
1. Forme actuelle des deux équipes (résultats récents, dynamique)
2. Joueurs clés, blessés, suspendus, incertains
3. Système tactique attendu pour chaque équipe
4. Points forts et faiblesses de chaque équipe
5. Pronostics et prédictions des experts/consultants

Cherche dans la presse française (L'Équipe, Eurosport, RMC Sport, So Foot),
la presse anglophone (The Guardian, BBC Sport, ESPN, The Athletic),
et la presse des deux pays si disponible.

IMPORTANT : Réponds entièrement en français. Traduis tout contenu anglophone en français.
Cite tes sources.`,
    {
      domainFilter: [
        'lequipe.fr', 'eurosport.fr', 'rmcsport.bfmtv.com', 'sofoot.com',
        'theguardian.com', 'bbc.com', 'espn.com', 'theathletic.com',
      ],
      recency: 'week',
      contextSize: 'high',
    }
  );
}

export async function fetchEurosportContext(team1: string, team2: string, date: string): Promise<PerplexityResult> {
  return query(
    `Résumé COURT (500 mots MAXIMUM) de ce que dit Eurosport récemment sur ${team1} et ${team2}, Coupe du Monde 2026 (match le ${date}).

Pour chaque équipe en 2-3 phrases max : forme récente, blessés majeurs, choix tactique du sélectionneur.
Puis en 2-3 phrases : la lecture du match par Eurosport (favori, dynamique attendue, facteur clé).

CONTRAINTES STRICTES :
- 500 mots MAXIMUM. Sois dense et factuel, pas de remplissage.
- Réponds entièrement en français.
- Structure en markdown : ## ${team1}, ## ${team2}, ## Le match vu par Eurosport.
- Cite les articles utilisés.
- Si Eurosport n'a rien publié, dis-le en une phrase.
- Termine directement : AUCUNE question, AUCUNE proposition de suite.`,
    {
      domainFilter: ['eurosport.fr', 'eurosport.com'],
      recency: 'week',
      contextSize: 'medium',
    }
  );
}

export async function fetchHistoricalBehavior(team1: string, team2: string): Promise<PerplexityResult> {
  return query(
    `Analyse historique et culturelle de ${team1} et ${team2} en tant que nations de football,
dans le contexte de la Coupe du Monde 2026 :

Pour chaque équipe :
1. Comment le pays s'est comporté dans les dernières grandes compétitions (Coupe du Monde, compétitions continentales, Ligue des Nations)
2. Tendances récentes : le football dans ce pays est-il en phase ascendante ou descendante ?
3. Génération actuelle vs générations précédentes (qualité du vivier de joueurs)
4. Style de jeu historique et évolution tactique récente
5. Facteurs psychologiques : comment cette équipe gère-t-elle la pression des grands matchs ?
6. Impact du sélectionneur actuel

IMPORTANT : Réponds entièrement en français. Traduis tout contenu anglophone en français.
Cite des sources et des analyses d'experts.`,
    {
      recency: 'month',
      contextSize: 'high',
    }
  );
}

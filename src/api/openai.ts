export interface SynthesisInput {
  team1: string;
  team2: string;
  oddsReport: string;
  pressReport: string;
  historyReport: string;
  quantitativeData: object;
  wilooContext?: string;
  figaroContext?: string;
  eurosportContext?: string;
}

export interface PredictionResult {
  suggestedScore: [number, number];
  confidence: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
  keyFactors: string[];
  riskFactors: string[];
}

export async function summarizeFigaroArticle(
  team1: string,
  team2: string,
  articleContent: string
): Promise<string> {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un rédacteur sportif concis. Rédige un résumé en français de 500 mots MAXIMUM à partir de l'article fourni. Structure en markdown avec des sections courtes : **Enjeux**, **Forme des équipes**, **Blessés / Incertains**, **Lecture du match**, **Paris suggérés**. Sois factuel et dense. Ne dépasse JAMAIS 500 mots.`,
        },
        {
          role: 'user',
          content: `Résume cet article du Figaro sur ${team1} vs ${team2} (Coupe du Monde 2026) :\n\n${articleContent}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function synthesizeReport(input: SynthesisInput): Promise<PredictionResult> {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un analyste football expert spécialisé dans les pronostics de Coupe du Monde.
À partir des données fournies (cotes bookmakers, analyse presse, historique, et statistiques),
produis un pronostic argumenté avec score exact.

IMPORTANT : Tu DOIS répondre ENTIÈREMENT en français. Tout le contenu textuel (reasoning, keyFactors, riskFactors) doit être rédigé en français.

Réponds UNIQUEMENT en JSON valide avec ce schéma exact :
{
  "suggestedScore": [number, number],
  "confidence": number (1 à 5),
  "reasoning": "string EN FRANÇAIS (2-3 paragraphes argumentés)",
  "keyFactors": ["string EN FRANÇAIS", ...] (3 à 5 facteurs décisifs),
  "riskFactors": ["string EN FRANÇAIS", ...] (2 à 3 risques)
}

Le pronostic doit être cohérent avec l'ensemble des données. Si les cotes, la presse
et les stats convergent, confiance haute. Si divergence, confiance plus basse et explique pourquoi.
suggestedScore[0] = buts ${input.team1}, suggestedScore[1] = buts ${input.team2}.`,
        },
        {
          role: 'user',
          content: `## Match : ${input.team1} vs ${input.team2} (Coupe du Monde 2026)

## Cotes bookmakers
${input.oddsReport}

## Analyse presse sportive
${input.pressReport}

## Analyse historique et comportement
${input.historyReport}

## Donnees quantitatives (derniers matchs, confrontations, historique CdM)
${JSON.stringify(input.quantitativeData, null, 2)}${input.wilooContext ? `

## Analyse YouTube (Wiloo, expert football français, 1M+ abonnés)
${input.wilooContext}` : ''}${input.figaroContext ? `

## Pronostics Le Figaro (paris-sportifs.lefigaro.fr, analyse pre-match)
${input.figaroContext}` : ''}${input.eurosportContext ? `

## Articles recents Eurosport
${input.eurosportContext}` : ''}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content) as PredictionResult;
}

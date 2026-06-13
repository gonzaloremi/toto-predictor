/**
 * Auto-update Wiloo summaries.
 *
 * 1. Detect last fetched video date from wiloo-transcripts.json
 * 2. Run fetch-wiloo.py --since <next day> to get new transcripts
 * 3. For each new transcript, ask GPT-4o-mini to extract per-country content
 * 4. For each impacted country, merge old summary + new content via GPT-4o-mini
 * 5. Write updated wiloo-summaries.json and wiloo-transcripts.json
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TRANSCRIPTS_PATH = join(ROOT, 'src', 'data', 'generated', 'wiloo-transcripts.json');
const SUMMARIES_PATH = join(ROOT, 'src', 'data', 'generated', 'wiloo-summaries.json');
const NEW_TRANSCRIPTS_PATH = join(ROOT, 'src', 'data', 'generated', 'wiloo-new-transcripts.json');

interface Transcript {
  videoId: string;
  title: string;
  uploadDate: string;
  url: string;
  transcript: string;
}

interface WilooSummary {
  tier: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  players: string;
  videos: string[];
}

function loadEnv(): string {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    throw new Error('.env file not found');
  }
  const content = readFileSync(envPath, 'utf-8');
  const match = content.match(/VITE_OPENAI_API_KEY=(.+)/);
  if (!match) throw new Error('VITE_OPENAI_API_KEY not found in .env');
  return match[1].trim();
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '{}';
}

function nextDay(yyyymmdd: string): string {
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const date = new Date(y, m, d + 1);
  const yy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

// ─── Step 1: Detect last fetch date ──────────────────────────────────────────

function getLastFetchDate(): string {
  if (!existsSync(TRANSCRIPTS_PATH)) return '20260523';
  const transcripts: Transcript[] = JSON.parse(readFileSync(TRANSCRIPTS_PATH, 'utf-8'));
  if (transcripts.length === 0) return '20260523';
  const dates = transcripts.map((t) => t.uploadDate).sort();
  return dates[dates.length - 1];
}

function getExistingVideoIds(): Set<string> {
  if (!existsSync(TRANSCRIPTS_PATH)) return new Set();
  const transcripts: Transcript[] = JSON.parse(readFileSync(TRANSCRIPTS_PATH, 'utf-8'));
  return new Set(transcripts.map((t) => t.videoId));
}

// ─── Step 2: Fetch new transcripts via Python ────────────────────────────────

function fetchNewTranscripts(since: string, excludeIds: string[]): Transcript[] {
  const excludeArgs = excludeIds.length > 0 ? ['--exclude', ...excludeIds] : [];
  const cmd = [
    'python3',
    join(ROOT, 'scripts', 'fetch-wiloo.py'),
    '--since', since,
    '--output', NEW_TRANSCRIPTS_PATH,
    ...excludeArgs,
  ];

  console.log(`\n  Running: ${cmd.join(' ')}\n`);

  try {
    execSync(cmd.join(' '), { stdio: 'inherit', cwd: ROOT });
  } catch {
    console.error('  fetch-wiloo.py failed, continuing with empty result');
    return [];
  }

  if (!existsSync(NEW_TRANSCRIPTS_PATH)) return [];
  const data: Transcript[] = JSON.parse(readFileSync(NEW_TRANSCRIPTS_PATH, 'utf-8'));
  return data.filter((t) => t.transcript && t.transcript.length > 100);
}

// ─── Step 3: Extract per-country content from each transcript ────────────────

async function extractCountries(
  apiKey: string,
  transcript: Transcript
): Promise<Record<string, string>> {
  console.log(`  Extracting countries from: ${transcript.title.slice(0, 60)}...`);

  const systemPrompt = `Tu es un analyste football expert. A partir du transcript d'une video YouTube de Wiloo (expert football francais, 1M+ abonnes), identifie chaque PAYS / EQUIPE NATIONALE mentionne de facon substantielle et resume ce que Wiloo dit sur chacun.

REGLES :
- Utilise les noms anglais des pays (Spain, France, England, Brazil, Argentina, etc.)
- N'inclus un pays que si Wiloo en parle de facon substantielle (au moins 2-3 phrases d'analyse)
- Resume en 100-200 mots par pays, en francais
- Capture : avis de Wiloo, forces/faiblesses mentionnees, joueurs cites, pronostic
- Reponds UNIQUEMENT en JSON valide : { "NomPays": "resume..." }`;

  const content = await callOpenAI(apiKey, systemPrompt, transcript.transcript.slice(0, 15000));

  try {
    return JSON.parse(content);
  } catch {
    console.error(`    Failed to parse country extraction for ${transcript.videoId}`);
    return {};
  }
}

// ─── Step 4: Update summary for a country ────────────────────────────────────

async function updateCountrySummary(
  apiKey: string,
  country: string,
  existingSummary: WilooSummary | null,
  newContent: string,
  videoIds: string[]
): Promise<WilooSummary> {
  console.log(`  Updating summary for: ${country}`);

  const existingBlock = existingSummary
    ? `Tier: ${existingSummary.tier}
Resume: ${existingSummary.summary}
Forces: ${existingSummary.strengths}
Faiblesses: ${existingSummary.weaknesses}
Joueurs cles: ${existingSummary.players}`
    : '(Aucun resume existant)';

  const systemPrompt = `Tu es un redacteur sportif expert. Tu mets a jour le resume des analyses Wiloo (expert football francais YouTube) pour un pays.

REGLES :
- Le NOUVEAU contenu de Wiloo doit etre mis en EXERGUE : mentionne-le EN PREMIER dans le summary, signale-le comme "Derniere analyse Wiloo"
- Garde le signal pertinent de l'ancien resume (ne supprime pas les infos encore valides)
- Si le nouveau contenu contredit l'ancien, privilegie le nouveau
- Ecris en francais
- Reponds UNIQUEMENT en JSON valide avec ce schema exact :
{
  "tier": "categorie courte (ex: Favori #1, Outsider, etc.)",
  "summary": "resume complet 150-250 mots",
  "strengths": "forces principales, virgule-separees",
  "weaknesses": "faiblesses principales, virgule-separees",
  "players": "joueurs cles mentionnes, virgule-separes"
}`;

  const userPrompt = `PAYS : ${country}

RESUME EXISTANT :
---
${existingBlock}
---

NOUVELLES ANALYSES WILOO (videos plus recentes, a mettre en exergue) :
---
${newContent}
---`;

  const content = await callOpenAI(apiKey, systemPrompt, userPrompt);

  try {
    const parsed = JSON.parse(content);
    return {
      tier: parsed.tier || existingSummary?.tier || 'Non classe',
      summary: parsed.summary || '',
      strengths: parsed.strengths || '',
      weaknesses: parsed.weaknesses || '',
      players: parsed.players || '',
      videos: videoIds,
    };
  } catch {
    console.error(`    Failed to parse updated summary for ${country}`);
    return existingSummary || {
      tier: 'Non classe',
      summary: newContent,
      strengths: '',
      weaknesses: '',
      players: '',
      videos: videoIds,
    };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══ Wiloo Auto-Update ═══\n');

  const apiKey = loadEnv();

  // Step 1
  const lastDate = getLastFetchDate();
  const since = nextDay(lastDate);
  const existingIds = getExistingVideoIds();
  console.log(`Last fetched video date: ${lastDate}`);
  console.log(`Looking for videos since: ${since}`);
  console.log(`Known video IDs: ${existingIds.size}`);

  // Step 2
  console.log('\n── Fetching new videos ──');
  const newTranscripts = fetchNewTranscripts(since, [...existingIds]);

  if (newTranscripts.length === 0) {
    console.log('\nNo new Wiloo videos found. Summaries are up to date.');
    return;
  }

  console.log(`\n${newTranscripts.length} new transcript(s) to process`);

  // Step 3: Extract per-country content
  console.log('\n── Extracting per-country content (GPT-4o-mini) ──');
  const countryContent: Record<string, { texts: string[]; videoIds: string[] }> = {};

  for (const t of newTranscripts) {
    const countries = await extractCountries(apiKey, t);
    for (const [country, text] of Object.entries(countries)) {
      if (!countryContent[country]) {
        countryContent[country] = { texts: [], videoIds: [] };
      }
      countryContent[country].texts.push(text);
      countryContent[country].videoIds.push(t.videoId);
    }
  }

  const impactedCountries = Object.keys(countryContent);
  console.log(`\n${impactedCountries.length} countries impacted: ${impactedCountries.join(', ')}`);

  // Step 4: Update summaries
  console.log('\n── Updating country summaries (GPT-4o-mini) ──');
  const summaries: Record<string, WilooSummary> = JSON.parse(
    readFileSync(SUMMARIES_PATH, 'utf-8')
  );

  for (const country of impactedCountries) {
    const existing = summaries[country] || null;
    const newText = countryContent[country].texts.join('\n\n---\n\n');
    const existingVideoIds = existing?.videos || [];
    const allVideoIds = [...new Set([...existingVideoIds, ...countryContent[country].videoIds])];

    summaries[country] = await updateCountrySummary(
      apiKey,
      country,
      existing,
      newText,
      allVideoIds
    );
  }

  // Step 5: Write updated files
  console.log('\n── Writing updated files ──');

  writeFileSync(SUMMARIES_PATH, JSON.stringify(summaries, null, 2), 'utf-8');
  console.log(`  Updated: ${SUMMARIES_PATH}`);

  const existingTranscripts: Transcript[] = existsSync(TRANSCRIPTS_PATH)
    ? JSON.parse(readFileSync(TRANSCRIPTS_PATH, 'utf-8'))
    : [];
  const allTranscripts = [...newTranscripts, ...existingTranscripts];
  allTranscripts.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
  writeFileSync(TRANSCRIPTS_PATH, JSON.stringify(allTranscripts, null, 2), 'utf-8');
  console.log(`  Updated: ${TRANSCRIPTS_PATH}`);

  console.log(`\n═══ Done! ${newTranscripts.length} new video(s), ${impactedCountries.length} country summaries updated ═══`);
}

main().catch((err) => {
  console.error('Update failed:', err.message);
  process.exit(1);
});

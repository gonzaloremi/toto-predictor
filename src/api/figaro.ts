// Recuperation des pronostics Le Figaro (paris-sportifs.lefigaro.fr).
// Les articles paraissent ~2 jours avant chaque match sur une URL predictible :
//   /pronostics/{equipe1-fr}-{equipe2-fr}-{jj-mm-aaaa}/
// Le fetch passe par le proxy Vite (/api/figaro) pour contourner CORS.

import { summarizeFigaroArticle } from './openai';

// Certaines equipes ont plusieurs slugs possibles (orthographe incertaine cote Figaro)
const FR_SLUGS: Record<string, string[]> = {
  'Algeria': ['algerie'],
  'Argentina': ['argentine'],
  'Australia': ['australie'],
  'Austria': ['autriche'],
  'Belgium': ['belgique'],
  'Bosnia & Herzegovina': ['bosnie-herzegovine'],
  'Brazil': ['bresil'],
  'Canada': ['canada'],
  'Cape Verde': ['cap-vert'],
  'Colombia': ['colombie'],
  'Croatia': ['croatie'],
  'Curaçao': ['curacao'],
  'Czech Republic': ['republique-tcheque', 'tchequie'],
  'DR Congo': ['rd-congo', 'republique-democratique-du-congo', 'rdc'],
  'Ecuador': ['equateur'],
  'Egypt': ['egypte'],
  'England': ['angleterre'],
  'France': ['france'],
  'Germany': ['allemagne'],
  'Ghana': ['ghana'],
  'Haiti': ['haiti'],
  'Iran': ['iran'],
  'Iraq': ['irak'],
  'Ivory Coast': ['cote-d-ivoire', 'cote-divoire'],
  'Japan': ['japon'],
  'Jordan': ['jordanie'],
  'Mexico': ['mexique'],
  'Morocco': ['maroc'],
  'Netherlands': ['pays-bas'],
  'New Zealand': ['nouvelle-zelande'],
  'Norway': ['norvege'],
  'Panama': ['panama'],
  'Paraguay': ['paraguay'],
  'Portugal': ['portugal'],
  'Qatar': ['qatar'],
  'Saudi Arabia': ['arabie-saoudite'],
  'Scotland': ['ecosse'],
  'Senegal': ['senegal'],
  'South Africa': ['afrique-du-sud'],
  'South Korea': ['coree-du-sud'],
  'Spain': ['espagne'],
  'Sweden': ['suede'],
  'Switzerland': ['suisse'],
  'Tunisia': ['tunisie'],
  'Turkey': ['turquie'],
  'USA': ['etats-unis'],
  'Uruguay': ['uruguay'],
  'Uzbekistan': ['ouzbekistan'],
};

export interface FigaroPronostic {
  url: string;
  winProbability: { team1: number; team2: number } | null;
  tips: string[];
  keyPoints: string[];
  overview: string;
  team1News: string;
  team2News: string;
  summary: string;
  fetchedAt: string;
}

const CACHE_KEY = 'wc2026_figaro_v2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // les cotes evoluent, on rafraichit toutes les 12h

function getCache(): Record<string, FigaroPronostic> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveToCache(matchId: number, data: FigaroPronostic) {
  const cache = getCache();
  cache[String(matchId)] = data;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// La date de l'URL Figaro peut differer d'un jour de notre calendrier (fuseau horaire)
function candidateDates(isoDate: string): string[] {
  const d = new Date(isoDate + 'T12:00:00Z');
  const fmt = (dt: Date) =>
    `${String(dt.getUTCDate()).padStart(2, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${dt.getUTCFullYear()}`;
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return [fmt(d), fmt(next)];
}

interface UrlCandidate {
  url: string;
  flipped: boolean; // true si l'URL est dans l'ordre team2-team1
}

function candidateUrls(team1: string, team2: string, isoDate: string): UrlCandidate[] {
  const slugs1 = FR_SLUGS[team1] ?? [];
  const slugs2 = FR_SLUGS[team2] ?? [];
  const urls: UrlCandidate[] = [];
  for (const date of candidateDates(isoDate)) {
    for (const flipped of [false, true]) {
      const [a, b] = flipped ? [slugs2, slugs1] : [slugs1, slugs2];
      for (const s1 of a) {
        for (const s2 of b) {
          urls.push({ url: `/api/figaro/pronostics/${s1}-${s2}-${date}/`, flipped });
        }
      }
    }
  }
  return urls;
}

function collectSections(doc: Document): Array<{ title: string; text: string }> {
  const sections: Array<{ title: string; text: string }> = [];
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
  for (const h of headings) {
    const title = h.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!title) continue;
    let text = '';
    let node = h.nextElementSibling;
    while (node && !/^H[1-3]$/.test(node.tagName)) {
      text += ' ' + (node.textContent ?? '');
      node = node.nextElementSibling;
    }
    sections.push({ title, text: text.replace(/\s+/g, ' ').trim() });
  }
  return sections;
}

function parseArticle(html: string, url: string, flipped: boolean): FigaroPronostic {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fullText = doc.body.textContent?.replace(/\s+/g, ' ') ?? '';
  const sections = collectSections(doc);

  // Probabilites de victoire : "9% Chances de victoire 82%" (dans l'ordre de la page)
  const probaMatch = fullText.match(/(\d+)\s*%\s*Chances de victoire\s*(\d+)\s*%/);
  let winProbability: FigaroPronostic['winProbability'] = null;
  if (probaMatch) {
    const left = Number(probaMatch[1]);
    const right = Number(probaMatch[2]);
    winProbability = flipped ? { team1: right, team2: left } : { team1: left, team2: right };
  }

  // Conseils de paris : "Nos Pronostics 3 conseils 1 ... chez Unibet 2,70 2 ..."
  const tips: string[] = [];
  const tipsBlock = fullText.match(/Nos Pronostics\s*\d+\s*conseils?(.*?)Cliquez sur un conseil/);
  if (tipsBlock) {
    const parts = tipsBlock[1].split(/\s\d+\s+(?=[A-ZÀ-Ü])/).map((s) => s.trim()).filter(Boolean);
    tips.push(...parts);
  }

  // Points cles : liste qui suit le titre "Points clés"
  const keyPoints: string[] = [];
  const kpHeading = Array.from(doc.querySelectorAll('h1, h2, h3, h4')).find(
    (h) => /Points cl/i.test(h.textContent ?? '')
  );
  if (kpHeading) {
    let node = kpHeading.nextElementSibling;
    while (node && !/^H[1-4]$/.test(node.tagName)) {
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        for (const li of Array.from(node.querySelectorAll('li'))) {
          const t = li.textContent?.replace(/\s+/g, ' ').trim();
          if (t) keyPoints.push(t);
        }
        break;
      }
      node = node.nextElementSibling;
    }
  }

  const overview = sections.find((s) => /Aperçu du match/i.test(s.title))?.text ?? '';

  // Deux sections "X : Actualité et forme", une par equipe, dans l'ordre de la page
  const newsSections = sections.filter((s) => /Actualité et forme/i.test(s.title));
  const pageNews1 = newsSections[0]?.text ?? '';
  const pageNews2 = newsSections[1]?.text ?? '';

  return {
    url: url.replace('/api/figaro', 'https://paris-sportifs.lefigaro.fr'),
    winProbability,
    tips,
    keyPoints,
    overview: overview.slice(0, 1500),
    team1News: (flipped ? pageNews2 : pageNews1).slice(0, 1200),
    team2News: (flipped ? pageNews1 : pageNews2).slice(0, 1200),
    summary: '',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Recupere le pronostic Figaro pour un match.
 * Retourne null si l'article n'est pas (encore) publie.
 */
export async function fetchFigaroPronostic(
  matchId: number,
  team1: string,
  team2: string,
  isoDate: string
): Promise<FigaroPronostic | null> {
  const cached = getCache()[String(matchId)];
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return cached;
  }

  for (const candidate of candidateUrls(team1, team2, isoDate)) {
    try {
      const res = await fetch(candidate.url);
      if (!res.ok) continue;
      const html = await res.text();
      // Verification basique que c'est bien une page article
      if (!/Chances de victoire|Points cl/i.test(html)) continue;
      const parsed = parseArticle(html, candidate.url, candidate.flipped);
      // Build raw text for the summarizer
      const rawParts = [
        parsed.tips.length ? `Paris conseillés : ${parsed.tips.join(' | ')}` : '',
        parsed.keyPoints.length ? `Points clés :\n- ${parsed.keyPoints.join('\n- ')}` : '',
        parsed.overview ? `Aperçu : ${parsed.overview}` : '',
        parsed.team1News ? `Forme équipe 1 : ${parsed.team1News}` : '',
        parsed.team2News ? `Forme équipe 2 : ${parsed.team2News}` : '',
      ].filter(Boolean).join('\n\n');
      try {
        parsed.summary = await summarizeFigaroArticle(team1, team2, rawParts);
      } catch {
        parsed.summary = '';
      }
      saveToCache(matchId, parsed);
      return parsed;
    } catch {
      continue;
    }
  }
  return cached ?? null;
}

/** Construit le texte a injecter dans le prompt OpenAI */
export function figaroToPromptContext(f: FigaroPronostic, team1: string, team2: string): string {
  const lines: string[] = [];
  if (f.winProbability) {
    lines.push(`Chances de victoire estimees : ${team1} ${f.winProbability.team1}% / ${team2} ${f.winProbability.team2}%`);
  }
  if (f.summary) {
    lines.push(f.summary);
  } else {
    if (f.tips.length) lines.push(`Paris conseilles : ${f.tips.join(' | ')}`);
    if (f.keyPoints.length) lines.push(`Points cles :\n- ${f.keyPoints.join('\n- ')}`);
  }
  return lines.join('\n\n');
}

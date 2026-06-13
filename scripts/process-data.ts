import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const RAW_DIR = join(import.meta.dirname, '..', 'data', 'raw');
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'generated');

const NAME_MAP: Record<string, string> = {
  'United States': 'USA',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
};

function canonicalName(name: string): string {
  return NAME_MAP[name] ?? name;
}

interface CsvMatch {
  date: string;
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
  tournament: string;
  city: string;
  country: string;
  neutral: string;
}

function parseCsv(raw: string): CsvMatch[] {
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = vals[i]));
    return obj as unknown as CsvMatch;
  });
}

// Load the 2026 WC JSON to get the 48 teams
function getWc2026Teams(): string[] {
  const data = JSON.parse(readFileSync(join(RAW_DIR, 'worldcup-2026.json'), 'utf-8'));
  const teams = new Set<string>();
  for (const m of data.matches) {
    for (const t of [m.team1, m.team2]) {
      if (!/\d/.test(t) && !t.startsWith('W') && !t.startsWith('L')) {
        teams.add(t);
      }
    }
  }
  return Array.from(teams).sort();
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const csvRaw = readFileSync(join(RAW_DIR, 'results.csv'), 'utf-8');
  const allMatches = parseCsv(csvRaw);
  const teams = getWc2026Teams();

  console.log(`Loaded ${allMatches.length} matches, ${teams.length} WC2026 teams`);

  // Normalize team names in CSV
  for (const m of allMatches) {
    m.home_team = canonicalName(m.home_team);
    m.away_team = canonicalName(m.away_team);
  }

  // Only keep matches with actual scores (not NA)
  const played = allMatches.filter(
    (m) => m.home_score !== 'NA' && m.away_score !== 'NA'
  );

  // 1. Last 15 matches per team
  console.log('Generating lastMatches.json...');
  const lastMatches: Record<string, object[]> = {};
  for (const team of teams) {
    const teamMatches = played
      .filter((m) => m.home_team === team || m.away_team === team)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);

    lastMatches[team] = teamMatches.map((m) => {
      const isHome = m.home_team === team;
      const goalsFor = parseInt(isHome ? m.home_score : m.away_score);
      const goalsAgainst = parseInt(isHome ? m.away_score : m.home_score);
      let result: 'W' | 'D' | 'L' = 'D';
      if (goalsFor > goalsAgainst) result = 'W';
      else if (goalsFor < goalsAgainst) result = 'L';
      return {
        date: m.date,
        opponent: isHome ? m.away_team : m.home_team,
        home: isHome,
        score: [goalsFor, goalsAgainst],
        tournament: m.tournament,
        result,
      };
    });
  }
  writeFileSync(join(OUT_DIR, 'lastMatches.json'), JSON.stringify(lastMatches, null, 2));

  // 2. World Cup history per team
  console.log('Generating wcHistory.json...');
  const wcMatches = played.filter((m) => m.tournament === 'FIFA World Cup');
  const wcHistory: Record<string, object> = {};

  for (const team of teams) {
    const teamWc = wcMatches
      .filter((m) => m.home_team === team || m.away_team === team)
      .sort((a, b) => a.date.localeCompare(b.date));

    let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
    const years = new Set<number>();

    const matches = teamWc.map((m) => {
      const isHome = m.home_team === team;
      const gf = parseInt(isHome ? m.home_score : m.away_score);
      const ga = parseInt(isHome ? m.away_score : m.home_score);
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf > ga) won++;
      else if (gf < ga) lost++;
      else drawn++;
      const year = parseInt(m.date.substring(0, 4));
      years.add(year);
      return {
        year,
        date: m.date,
        opponent: isHome ? m.away_team : m.home_team,
        score: [gf, ga] as [number, number],
        home: isHome,
      };
    });

    wcHistory[team] = {
      appearances: years.size,
      stats: {
        played: matches.length,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
      },
      matches,
    };
  }
  writeFileSync(join(OUT_DIR, 'wcHistory.json'), JSON.stringify(wcHistory, null, 2));

  // 3. Head-to-head for group-stage pairs
  console.log('Generating headToHead.json...');
  const wc2026Data = JSON.parse(readFileSync(join(RAW_DIR, 'worldcup-2026.json'), 'utf-8'));
  const groupMatches = wc2026Data.matches.filter(
    (m: { group?: string }) => m.group && m.group.startsWith('Group')
  );

  const pairs = new Set<string>();
  for (const m of groupMatches) {
    const key = [m.team1, m.team2].sort().join('_vs_');
    pairs.add(key);
  }

  const h2h: Record<string, object> = {};
  for (const pair of pairs) {
    const [teamA, teamB] = pair.split('_vs_');
    const meetings = played
      .filter(
        (m) =>
          (m.home_team === teamA && m.away_team === teamB) ||
          (m.home_team === teamB && m.away_team === teamA)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const winsA = meetings.filter((m) => {
      const scoreA = m.home_team === teamA ? parseInt(m.home_score) : parseInt(m.away_score);
      const scoreB = m.home_team === teamA ? parseInt(m.away_score) : parseInt(m.home_score);
      return scoreA > scoreB;
    }).length;
    const winsB = meetings.filter((m) => {
      const scoreB2 = m.home_team === teamB ? parseInt(m.home_score) : parseInt(m.away_score);
      const scoreA2 = m.home_team === teamB ? parseInt(m.away_score) : parseInt(m.home_score);
      return scoreB2 > scoreA2;
    }).length;
    const draws = meetings.length - winsA - winsB;

    let goalsA = 0, goalsB = 0;
    for (const m of meetings) {
      if (m.home_team === teamA) {
        goalsA += parseInt(m.home_score);
        goalsB += parseInt(m.away_score);
      } else {
        goalsA += parseInt(m.away_score);
        goalsB += parseInt(m.home_score);
      }
    }

    const wcMeetings = meetings.filter((m) => m.tournament === 'FIFA World Cup');

    h2h[pair] = {
      totalMatches: meetings.length,
      wins: { [teamA]: winsA, [teamB]: winsB, draws },
      goals: { [teamA]: goalsA, [teamB]: goalsB },
      lastMeetings: meetings.slice(0, 10).map((m) => ({
        date: m.date,
        homeTeam: m.home_team,
        score: [parseInt(m.home_score), parseInt(m.away_score)],
        tournament: m.tournament,
      })),
      inWorldCup: wcMeetings.map((m) => ({
        date: m.date,
        homeTeam: m.home_team,
        score: [parseInt(m.home_score), parseInt(m.away_score)],
        tournament: m.tournament,
      })),
    };
  }
  writeFileSync(join(OUT_DIR, 'headToHead.json'), JSON.stringify(h2h, null, 2));

  // 4. Team stats summary
  console.log('Generating teamStats.json...');
  const teamStats: Record<string, object> = {};
  for (const team of teams) {
    const last10 = (lastMatches[team] as Array<{ result: string; score: number[] }>).slice(0, 10);
    const won = last10.filter((m) => m.result === 'W').length;
    const drawn = last10.filter((m) => m.result === 'D').length;
    const lost2 = last10.filter((m) => m.result === 'L').length;
    const gf = last10.reduce((s, m) => s + m.score[0], 0);
    const ga = last10.reduce((s, m) => s + m.score[1], 0);
    const form = last10.slice(0, 5).map((m) => m.result).join('');

    const wch = wcHistory[team] as { appearances: number; stats: { won: number } };

    teamStats[team] = {
      recentForm: form,
      last10: { played: last10.length, won, drawn, lost: lost2, goalsFor: gf, goalsAgainst: ga },
      avgGoalsScored: +(gf / Math.max(last10.length, 1)).toFixed(2),
      avgGoalsConceded: +(ga / Math.max(last10.length, 1)).toFixed(2),
      wcAppearances: wch.appearances,
    };
  }
  writeFileSync(join(OUT_DIR, 'teamStats.json'), JSON.stringify(teamStats, null, 2));

  // 5. Schedule (all 104 matches)
  console.log('Generating schedule.json...');
  const schedule = wc2026Data.matches.map((m: Record<string, unknown>, i: number) => ({
    id: i + 1,
    ...m,
  }));
  writeFileSync(join(OUT_DIR, 'schedule.json'), JSON.stringify(schedule, null, 2));

  console.log('\nDone! Generated files in src/data/generated/');
}

main();

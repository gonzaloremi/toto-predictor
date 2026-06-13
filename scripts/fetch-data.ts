import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RAW_DIR = join(import.meta.dirname, '..', 'data', 'raw');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

  console.log('Downloading results.csv...');
  const csv = await fetchText(
    'https://raw.githubusercontent.com/martj42/international_results/master/results.csv'
  );
  writeFileSync(join(RAW_DIR, 'results.csv'), csv);
  console.log(`  -> ${csv.split('\n').length} lines`);

  console.log('Downloading shootouts.csv...');
  const shootouts = await fetchText(
    'https://raw.githubusercontent.com/martj42/international_results/master/shootouts.csv'
  );
  writeFileSync(join(RAW_DIR, 'shootouts.csv'), shootouts);

  console.log('Downloading 2026 World Cup schedule...');
  const wc2026 = await fetchText(
    'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
  );
  writeFileSync(join(RAW_DIR, 'worldcup-2026.json'), wc2026);

  const wcYears = [
    1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974,
    1978, 1982, 1986, 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
  ];
  for (const year of wcYears) {
    process.stdout.write(`Downloading WC ${year}...`);
    try {
      const data = await fetchText(
        `https://raw.githubusercontent.com/openfootball/worldcup.json/master/${year}/worldcup.json`
      );
      writeFileSync(join(RAW_DIR, `worldcup-${year}.json`), data);
      console.log(' OK');
    } catch {
      console.log(' SKIP (not found)');
    }
  }

  console.log('\nDone! All data saved to data/raw/');
}

main().catch(console.error);

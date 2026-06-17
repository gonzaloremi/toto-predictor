/**
 * Seed wiloo_summaries table in Supabase from local JSON file.
 * Usage: npx tsx scripts/seed-wiloo-supabase.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUMMARIES_PATH = join(__dirname, '..', 'src', 'data', 'generated', 'wiloo-summaries.json');

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Reading wiloo-summaries.json...');
  const summaries = JSON.parse(readFileSync(SUMMARIES_PATH, 'utf-8'));
  const countries = Object.keys(summaries);
  console.log(`Found ${countries.length} countries to seed.`);

  const rows = countries.map((country) => ({
    country,
    data: summaries[country],
    updated_at: new Date().toISOString(),
  }));

  console.log('Upserting into wiloo_summaries...');
  const { error } = await supabase
    .from('wiloo_summaries')
    .upsert(rows, { onConflict: 'country' });

  if (error) {
    console.error('Upsert failed:', error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${countries.length} countries into wiloo_summaries.`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

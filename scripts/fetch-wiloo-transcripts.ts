import { fetchTranscript } from 'youtube-transcript-plus';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VIDEO_URLS = [
  'https://www.youtube.com/watch?v=GKiBELDEYSA',
  'https://www.youtube.com/watch?v=qBuKxhIZGLE',
  'https://www.youtube.com/watch?v=Vi-EviTg8Gk',
  'https://www.youtube.com/watch?v=zAc0E6Bppco',
  'https://www.youtube.com/watch?v=pB8N9H1WnJ0',
  'https://www.youtube.com/watch?v=rGlDWc99NAU',
  'https://www.youtube.com/watch?v=pPgOQu6Jyvo',
  'https://www.youtube.com/watch?v=ZGymNtsO8Zk',
  'https://www.youtube.com/watch?v=t9XVHQB4Z8s',
  'https://www.youtube.com/watch?v=8UttI3Q1vgI',
  'https://www.youtube.com/watch?v=pnRdoDRxAB8',
  'https://www.youtube.com/watch?v=APbBUaBX4NE',
  'https://www.youtube.com/watch?v=UJuks6IBJso',
  'https://www.youtube.com/watch?v=P84VNigu9Gc',
  'https://www.youtube.com/watch?v=ElZSdQyIWeM',
  'https://www.youtube.com/watch?v=DLOv2eQ7Euk',
  'https://www.youtube.com/watch?v=VQUcflGdIKc',
];

function extractVideoId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/);
  return match?.[1] ?? url;
}

async function main() {
  console.log(`Fetching transcripts for ${VIDEO_URLS.length} videos...\n`);

  let success = 0;
  let failed = 0;

  for (const url of VIDEO_URLS) {
    const videoId = extractVideoId(url);
    console.log(`[${videoId}] Fetching...`);

    try {
      const result = await fetchTranscript(videoId, {
        lang: 'fr',
        retries: 2,
        retryDelay: 2000,
        videoDetails: true,
      });

      const segments = 'segments' in result ? result.segments : result;
      const title = 'title' in result ? (result as any).title : videoId;
      const transcript = (segments as any[]).map((s: any) => s.text).join(' ');

      console.log(`  Title: ${title}`);
      console.log(`  Transcript length: ${transcript.length} chars`);

      const { error } = await supabase
        .from('wiloo_videos')
        .upsert({
          video_id: videoId,
          title: String(title),
          transcript,
          language: 'fr',
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'video_id' });

      if (error) {
        console.log(`  DB error: ${error.message}`);
        failed++;
      } else {
        console.log(`  Saved to Supabase`);
        success++;
      }
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}`);
      
      // Try without language preference
      try {
        console.log(`  Retrying without lang...`);
        const result = await fetchTranscript(videoId, {
          retries: 2,
          retryDelay: 2000,
          videoDetails: true,
        });

        const segments = 'segments' in result ? result.segments : result;
        const title = 'title' in result ? (result as any).title : videoId;
        const transcript = (segments as any[]).map((s: any) => s.text).join(' ');

        console.log(`  Title: ${title}`);
        console.log(`  Transcript length: ${transcript.length} chars`);

        const { error } = await supabase
          .from('wiloo_videos')
          .upsert({
            video_id: videoId,
            title: String(title),
            transcript,
            language: 'auto',
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'video_id' });

        if (error) {
          console.log(`  DB error: ${error.message}`);
          failed++;
        } else {
          console.log(`  Saved to Supabase`);
          success++;
        }
      } catch (err2: any) {
        console.log(`  FAILED again: ${err2.message}`);
        failed++;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDone: ${success} success, ${failed} failed out of ${VIDEO_URLS.length}`);
}

main().catch(console.error);

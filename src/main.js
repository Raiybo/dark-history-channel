import 'dotenv/config';
import { generateIdea }     from './idea-generator.js';
import { generateScript }   from './script-writer.js';
import { generateAudio }    from './tts.js';
import { fetchSceneVideos } from './pexels.js';
import { prepareMusic }     from './music.js';
import { renderVideo }      from './renderer.js';
import { uploadToYouTube }  from './uploader.js';

const REQUIRED_ENV = [
  'GEMINI_API_KEY',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN',
  'PEXELS_API_KEY',
];

// Strict alternation: Future-History ↔ Optimization
const DAY_ROTATION = ['future', 'optimize', 'future', 'optimize', 'future', 'optimize', 'future'];

const GENRE_LABELS = {
  future:   'Future-History',
  optimize: 'Optimization',
};

function getTodayGenre() {
  return DAY_ROTATION[new Date().getDay()];
}

function checkEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function run() {
  checkEnv();

  const genre = process.env.GENRE_OVERRIDE || getTodayGenre();
  const label = GENRE_LABELS[genre];

  console.log('\n═══════════════════════════════════════');
  console.log(`   DISTOIR — ${label}`);
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/7  Generating idea...');
  const idea = await generateIdea(genre);
  if (idea.topic) console.log(`  Topic: "${idea.topic}"\n`);
  else console.log(`  Genre: ${label}\n`);

  console.log('Step 2/7  Writing script...');
  const script = await generateScript(idea);
  console.log(`  Hook: "${script.hook_text}"`);
  console.log(`  Script: ${script.narration.split(' ').length} words\n`);

  console.log('Step 3/7  Fetching scene videos from Pexels...');
  const clips = await fetchSceneVideos(script.scenes);
  script.clips = clips;
  console.log();

  console.log('Step 4/7  Generating voiceover...');
  const audio = await generateAudio(script.narration, genre);
  console.log();

  console.log('Step 5/7  Preparing background music...');
  const musicPath = await prepareMusic(genre);
  script.hasMusic = musicPath !== null;
  console.log();

  console.log('Step 6/7  Rendering video...');
  const videoPath = await renderVideo(script, audio);
  console.log(`  Saved to: ${videoPath}\n`);

  if (process.env.UPLOAD === '1') {
    console.log('Step 7/7  Uploading to YouTube...');
    const result = await uploadToYouTube(script, videoPath);
    console.log(`  Published: ${result.url}\n`);
  } else {
    console.log('Step 7/7  Upload skipped (set UPLOAD=1 to enable)');
    console.log(`  Video saved at: ${videoPath}\n`);
  }

  console.log('═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

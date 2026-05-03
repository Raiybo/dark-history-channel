import 'dotenv/config';
import { generateIdea } from './idea-generator.js';
import { generateScript } from './script-writer.js';
import { generateAudio } from './tts.js';
import { fetchSceneImages } from './pexels.js';
import { renderVideo } from './renderer.js';
import { uploadToYouTube } from './uploader.js';

const REQUIRED_ENV = [
  'GEMINI_API_KEY',
  'GOOGLE_TTS_CREDENTIALS',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN',
];

// Mon=stoic, Tue=future, Wed=optimize, Thu=stoic, Fri=future, Sat=optimize, Sun=stoic
const DAY_ROTATION = ['stoic', 'stoic', 'future', 'optimize', 'stoic', 'future', 'optimize'];

const GENRE_LABELS = {
  stoic:    'The Stoic Daily',
  future:   'Future-History',
  optimize: 'The Optimization Minute',
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
  console.log(`   CHRONICLES — ${label}`);
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/6  Generating idea...');
  const idea = await generateIdea(genre);
  if (idea.topic) console.log(`  Topic: "${idea.topic}"\n`);
  else console.log(`  Genre: ${label}\n`);

  console.log('Step 2/6  Writing script...');
  const script = await generateScript(idea);
  console.log(`  Hook: "${script.hook_text}"`);
  console.log(`  Script: ${script.narration.split(' ').length} words\n`);

  console.log('Step 3/6  Fetching scene images from Pexels...');
  const imagePaths = await fetchSceneImages(script.scenes);
  script.imagePaths = imagePaths;
  console.log();

  console.log('Step 4/6  Generating voiceover...');
  const audio = await generateAudio(script.narration, genre);
  console.log();

  console.log('Step 5/6  Rendering video...');
  const videoPath = await renderVideo(script, audio);
  console.log(`  Saved to: ${videoPath}\n`);

  // Upload disabled — run `UPLOAD=1 node src/main.js` to re-enable
  if (process.env.UPLOAD === '1') {
    console.log('Step 6/6  Uploading to YouTube...');
    const result = await uploadToYouTube(script, videoPath);
    console.log(`  Published: ${result.url}\n`);
  } else {
    console.log('Step 6/6  Upload skipped (set UPLOAD=1 to enable)');
    console.log(`  Video saved at: ${videoPath}\n`);
  }

  console.log('═══════════════════════════════════════');
  console.log('   Done!                               ');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

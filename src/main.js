import 'dotenv/config';
import { generateIdea } from './idea-generator.js';
import { generateScript } from './script-writer.js';
import { generateAudio } from './tts.js';
import { renderVideo } from './renderer.js';
import { uploadToYouTube } from './uploader.js';

const REQUIRED_ENV = [
  'GEMINI_API_KEY',
  'GOOGLE_TTS_CREDENTIALS',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN'
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

async function run() {
  checkEnv();

  console.log('\n═══════════════════════════════════════');
  console.log('   DARK CHRONICLES — Video Generator   ');
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/5  Generating idea...');
  const idea = await generateIdea();
  console.log(`  Title: "${idea.title}"`);
  console.log(`  Angle: ${idea.angle}\n`);

  console.log('Step 2/5  Writing script...');
  const script = await generateScript(idea);
  console.log(`  ${script.chapters.length} chapters written\n`);

  console.log('Step 3/5  Generating voiceover...');
  const audio = await generateAudio(script.chapters);
  console.log();

  console.log('Step 4/5  Rendering video...');
  const videoPath = await renderVideo(script, audio);
  console.log(`  Saved to: ${videoPath}\n`);

  console.log('Step 5/5  Uploading to YouTube...');
  const result = await uploadToYouTube(script, videoPath);
  console.log(`  Published: ${result.url}\n`);

  console.log('═══════════════════════════════════════');
  console.log('   Done! Video is live on YouTube.     ');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

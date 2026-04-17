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
    process.exit(1);
  }
}

async function run() {
  checkEnv();

  console.log('\n═══════════════════════════════════════');
  console.log('   HOW IT WORKS — Shorts Generator     ');
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/5  Generating idea...');
  const idea = await generateIdea();
  console.log(`  Topic: "${idea.title}"\n`);

  console.log('Step 2/5  Writing script...');
  const script = await generateScript(idea);
  console.log(`  Script: ${script.narration.split(' ').length} words\n`);

  console.log('Step 3/5  Generating voiceover...');
  const audio = await generateAudio(script.narration);
  console.log();

  console.log('Step 4/5  Rendering video...');
  const videoPath = await renderVideo(script, audio);
  console.log(`  Saved to: ${videoPath}\n`);

  console.log('Step 5/5  Uploading to YouTube...');
  const result = await uploadToYouTube(script, videoPath);
  console.log(`  Published: ${result.url}\n`);

  console.log('═══════════════════════════════════════');
  console.log('   Done! Short is live on YouTube.     ');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

import 'dotenv/config';
import { generateIdea }     from './idea-generator.js';
import { generateScript }   from './script-writer.js';
import { generateAudio }    from './tts.js';
import { fetchSceneVideos } from './pexels.js';
import { prepareMusic }     from './music.js';
import { renderVideo }      from './renderer.js';
import { uploadToYouTube }  from './uploader.js';
import { sendDraftToTikTok, tiktokConfigured } from './tiktok.js';
import {
  checkTopic, checkScript, checkClips, checkAudio, checkRender,
} from './pre-upload-checks.js';
import { addVideoToThemedPlaylist } from './yt-playlists.js';
import { saveCrossPostPack } from './cross-post.js';

const REQUIRED_ENV = [
  'GEMINI_API_KEY',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN',
  'PEXELS_API_KEY',
];

const GENRE_LABELS = {
  didyouknow: 'Did You Know',
};

function getTodayGenre() {
  return 'didyouknow';
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
  console.log(`   ${label}`);
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/7  Generating idea...');
  const idea = await generateIdea(genre);
  console.log(`  Topic: "${idea.topic}"`);
  checkTopic(idea);
  console.log();

  console.log('Step 2/7  Writing script...');
  const script = await generateScript(idea);
  console.log(`  Hook: "${script.hook_text}"`);
  console.log(`  Script: ${script.narration.split(' ').length} words`);
  checkScript(script);
  console.log();

  console.log('Step 3/7  Fetching scene videos from Pexels...');
  const clips = await fetchSceneVideos(script.scenes);
  script.clips = clips;
  checkClips(clips);
  console.log();

  console.log('Step 4/7  Generating voiceover...');
  const audio = await generateAudio(script.narration, genre);
  // Strip the beat markers now that the audio is split — keep clean text for captions/fallback.
  script.narration = script.narration.replace(/\s*\|\|\s*/g, ' ').trim();
  checkAudio(audio);
  console.log();

  console.log('Step 5/7  Preparing background music...');
  const musicPath = await prepareMusic(genre);
  script.hasMusic = musicPath !== null;
  console.log();

  console.log('Step 6/7  Rendering video...');
  const videoPath = await renderVideo(script, audio);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  console.log();

  if (process.env.UPLOAD === '1') {
    console.log('Step 7/7  Uploading to YouTube...');
    const result = await uploadToYouTube(script, videoPath);
    console.log(`  Published: ${result.url}`);
    // Post-upload best-effort: classify into a themed playlist + save a cross-
    // post pack for TikTok/Reels/Reddit. Both are wrapped so any error here
    // never re-fails an already-successful upload.
    await addVideoToThemedPlaylist(result.id, script);
    saveCrossPostPack(script, videoPath, result.id, result.url);
    console.log();
  } else {
    console.log('Step 7/7  Upload skipped (set UPLOAD=1 to enable)');
    console.log(`  Video saved at: ${videoPath}\n`);
  }

  // TikTok: deliver the same MP4 to the creator's inbox as a DRAFT (manual post).
  // Only runs when the TikTok secrets are set; never blocks the YouTube pipeline.
  if (tiktokConfigured()) {
    console.log('Sending draft to TikTok inbox...');
    try {
      const tk = await sendDraftToTikTok(videoPath);
      console.log(`  TikTok draft delivered (publish_id ${tk.publish_id}). Open TikTok → inbox to add a caption and post.`);
      const tikTags = (script.tags || []).slice(0, 3)
        .map(t => '#' + String(t).replace(/[^a-zA-Z0-9]/g, ''))
        .filter(h => h.length > 1).join(' ');
      console.log(`  Suggested caption: ${script.title} ${tikTags} #fyp #viral #facts\n`);
    } catch (err) {
      console.log(`  TikTok draft skipped: ${err.message}\n`);
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

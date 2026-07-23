import 'dotenv/config';
import { generateIdea, loadUsedIdeas, saveUsedIdea } from './idea-generator.js';
import { generateScript }   from './script-writer.js';
import { generateSplitEdit } from './genres/splitedit.js';
import { generateAiToolsContent } from './genres/aitools.js';
import { fetchToolScreenshots } from './screenshots.js';
import { generateAudio }    from './tts.js';
import { fetchSceneVideos, fetchClipsWithDuration } from './pexels.js';
import { prepareMusic }     from './music.js';
import { renderVideo, renderSplitScreenVideo } from './renderer.js';
import { uploadToYouTube }  from './uploader.js';
import { sendDraftToTikTok, tiktokConfigured } from './tiktok.js';
import {
  checkTopic, checkScript, checkAiToolsScript, checkClips, checkAudio, checkRender,
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
  splitedit: 'Split-Screen Edit',
  aitools: 'AI Tools & Tech Hacks',
};

function getTodayGenre() {
  return 'didyouknow';
}

// Publish one video (YouTube + TikTok draft) and run post-upload extras. Shared
// by both the countdown pipeline and the split-edit pipeline.
async function publish(payload, videoPath) {
  if (process.env.UPLOAD === '1') {
    console.log('  Uploading to YouTube...');
    const result = await uploadToYouTube(payload, videoPath);
    console.log(`  Published: ${result.url}`);
    if (process.env.ENABLE_PLAYLISTS === '1') {
      await addVideoToThemedPlaylist(result.id, payload);
    }
    saveCrossPostPack(payload, videoPath, result.id, result.url);
  } else {
    console.log(`  Upload skipped (set UPLOAD=1). Video at: ${videoPath}`);
  }
  if (tiktokConfigured()) {
    try {
      const tk = await sendDraftToTikTok(videoPath);
      console.log(`  TikTok draft delivered (publish_id ${tk.publish_id}).`);
    } catch (err) {
      console.log(`  TikTok draft skipped: ${err.message}`);
    }
  }
}

// Split-screen EDIT pipeline: trending subject stock (top) + royalty-free
// satisfying loop (bottom) + music. No narration/TTS, no countdown. All footage
// is licensed/CC/stock. Falls back to the countdown format if no trend fits.
async function runSplitEdit() {
  console.log('\n═══════════════════════════════════════');
  console.log('   Split-Screen Edit');
  console.log('═══════════════════════════════════════\n');

  const used = loadUsedIdeas();
  const recentSubjects = used.slice(-40).map(u => u.subject).filter(Boolean);

  console.log('Step 1/4  Picking a trending subject...');
  const content = await generateSplitEdit(recentSubjects);
  if (!content) {
    console.log('  No usable trend for a split-edit — falling back to the countdown format.\n');
    return runCountdown();
  }
  console.log(`  Subject: "${content.subject}" → "${content.title}"`);
  console.log(`  Hook: "${content.hook_text}"\n`);

  console.log('Step 2/4  Fetching footage (subject + satisfying)...');
  const scenes = [
    ...content.top_keywords.map(k => ({ keyword: k })),
    { keyword: content.satisfying_keyword },
  ];
  const clips = await fetchClipsWithDuration(scenes);
  const topClips = clips.slice(0, content.top_keywords.length).filter(Boolean);
  const satisfyingClips = clips.slice(content.top_keywords.length).filter(Boolean);
  if (topClips.length < 3) {
    console.log('  Too few top clips fetched — falling back to the countdown format.\n');
    return runCountdown();
  }
  if (satisfyingClips.length === 0) {
    console.log('  No satisfying clip — using an extra top clip on the bottom.');
    satisfyingClips.push(topClips[topClips.length - 1]);
  }
  console.log(`  ${topClips.length} top clips + ${satisfyingClips.length} satisfying\n`);

  // No music for split-edits — the top clip plays with its OWN audio.
  console.log('Step 3/4  Rendering split-screen video (clip audio, no music)...');
  const videoPath = await renderSplitScreenVideo(content, topClips, satisfyingClips, false);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  console.log();

  console.log('Step 4/4  Publishing...');
  await publish(content, videoPath);

  saveUsedIdea({ topic: content.title, title: content.title, genre: 'splitedit', theme: 'trend', subject: content.subject });

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

function checkEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function runCountdown() {
  const genre = 'didyouknow';
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
    // Playlist-add is OFF by default at 6 uploads/day: 6 x (1600 upload + ~50
    // comment + ~51 playlist + 2 lookups) overflows the 10,000-unit daily API
    // quota and the day's LAST upload would die on quotaExceeded. Without the
    // playlist step we sit at ~9,912/day. Set ENABLE_PLAYLISTS=1 to re-enable
    // if the cadence ever drops (<=5/day fits with playlists on).
    if (process.env.ENABLE_PLAYLISTS === '1') {
      await addVideoToThemedPlaylist(result.id, script);
    }
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

// AI Tools & Tech Hacks pipeline — real UI screenshots (no stock, no AI art)
// captured by Puppeteer from the tool's own website, composited over the
// existing SlideshowVideo (Ken Burns motion on .jpg clips already supported
// via VideoClip → Slide). Fresh trending tool picked per run with a 90-day
// cooldown so no tool is repeated inside the window.
async function runAiTools() {
  const genre = 'aitools';
  console.log('\n═══════════════════════════════════════');
  console.log(`   ${GENRE_LABELS[genre]}`);
  console.log('═══════════════════════════════════════\n');

  const used = loadUsedIdeas();

  console.log('Step 1/6  Picking trending tool + writing script...');
  const content = await generateAiToolsContent(used);
  if (!content) {
    console.log('  No usable trending tool today (all on cooldown or filters).');
    process.exit(0);
  }
  console.log(`  Tool: ${content.tool_name}`);
  console.log(`  Hook: "${content.hook_text}"`);
  console.log(`  Script: ${content.narration.split(/\s+/).length} words`);
  checkAiToolsScript(content);
  console.log();

  console.log('Step 2/6  Capturing real UI screenshots...');
  const rawClips = await fetchToolScreenshots(content.scenes);
  // Fill any single-scene capture miss with a reused successful capture, so one
  // page 404 or timeout doesn't nuke the whole run. If EVERY capture failed,
  // checkClips will still fail loudly and the pipeline exits before uploading.
  const firstGood = rawClips.find(Boolean);
  const clips = rawClips.map(c => c || firstGood || null);
  const missCount = rawClips.filter(c => !c).length;
  if (firstGood && missCount > 0) {
    console.log(`  Filled ${missCount} failed capture(s) with a reused successful screenshot.`);
  }
  content.clips = clips;
  checkClips(clips);
  console.log();

  console.log('Step 3/6  Generating voiceover...');
  const audio = await generateAudio(content.narration, genre);
  content.narration = content.narration.replace(/\s*\|\|\s*/g, ' ').trim();
  checkAudio(audio);
  console.log();

  console.log('Step 4/6  Preparing background music...');
  const musicPath = await prepareMusic(genre);
  content.hasMusic = musicPath !== null;
  console.log();

  console.log('Step 5/6  Rendering video...');
  // The renderer reads content.scenes for lower-third callouts; map our AI-tools
  // scene shape to the {keyword} shape the SceneCallouts component expects.
  const renderContent = {
    ...content,
    scenes: content.scenes.map(s => ({ keyword: s.caption || s.area })),
  };
  const videoPath = await renderVideo(renderContent, audio);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  console.log();

  console.log('Step 6/6  Publishing...');
  await publish(content, videoPath);

  saveUsedIdea({
    topic: content.tool_name,
    title: content.title,
    genre: 'aitools',
    tracking_slug: content.tracking_slug,
    toolName: content.tool_name,
    source: content.data_source,
  });

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

// Dispatcher: GENRE_OVERRIDE picks the pipeline (aitools | splitedit | countdown).
async function run() {
  checkEnv();
  const genre = process.env.GENRE_OVERRIDE || getTodayGenre();
  if (genre === 'aitools') return runAiTools();
  if (genre === 'splitedit') return runSplitEdit();
  return runCountdown();
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

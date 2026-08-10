import 'dotenv/config';
import { generateIdea, loadUsedIdeas, saveUsedIdea } from './idea-generator.js';
import { generateScript }   from './script-writer.js';
import { generateSplitEdit } from './genres/splitedit.js';
import { generateKingsItems } from './genres/kingsranks.js';
import { generateVersusContent } from './genres/versus.js';
import { generateAiToolsContent } from './genres/aitools.js';
import { fetchToolScreenshots } from './screenshots.js';
import { generateConsumerContent } from './genres/consumer.js';
import { generateRankingGameContent } from './genres/rankinggame.js';
import { generateClipRanks } from './genres/clipranks.js';
import { processViralClip, probeDuration } from './clip-processor.js';
import { recordSceneMotion } from './screencast.js';
import { generateAudio }    from './tts.js';
import { fetchSceneVideos, fetchClipsWithDuration, fetchRankFootage } from './pexels.js';
import { prepareMusic }     from './music.js';
import { renderVideo, renderSplitScreenVideo, renderSplitSludgeVideo, renderSilentKingsRanks, renderVersusVideo, renderRankingGame } from './renderer.js';
import { uploadToYouTube }  from './uploader.js';
import { sendDraftToTikTok, tiktokConfigured } from './tiktok.js';
import {
  checkTopic, checkScript, checkAiToolsScript, checkConsumerScript, checkClips, checkAudio, checkRender, checkKingsRanks, checkVersus, checkRankingGame,
} from './pre-upload-checks.js';
import { addVideoToThemedPlaylist } from './yt-playlists.js';
import { saveCrossPostPack } from './cross-post.js';
import { readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Clips the creator drops into a Desktop folder they OWN. Overridable via
// CLIPS_DIR. The channel now ONLY posts from these clips — no clips, no upload.
const CLIPRANKS_DIR = process.env.CLIPS_DIR || join(homedir(), 'Desktop', 'yt clips');
const CLIPRANKS_OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'videos');

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
  consumer: 'Consumer Awareness & Rights',
  kingsranks: 'Kings of Ranks',
  versus: 'Versus',
  rankinggame: 'Ranking Game',
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

// Satisfying loops for the bottom half of the split-sludge composition.
// Any of these Pexels queries reliably returns portrait-friendly ~30-60s
// loops we can crop into the bottom 40% of a 9:16 frame. One is picked per
// run so viewers see visual variety across days.
const SLUDGE_QUERIES = [
  'lawn mower cutting grass', 'tractor mowing field', 'ride on mower lawn',
  'mowing tall grass', 'lawn mower stripes', 'grass cutting closeup',
  'pressure washing dirty surface', 'pressure wash driveway',
  'soap cutting satisfying', 'kinetic sand cutting',
  'hedge trimming', 'grass trimmer edging',
];

// Consumer Awareness pipeline: source-grounded script + real UI screencast on
// top + muted satisfying loop on bottom (Split-Sludge composition). Every
// upload ties to a primary source URL (FTC / CISA / IRS / USDA / CPSC) which
// also gets auto-pinned in the top comment via uploader.js.
async function runConsumerAwareness() {
  const genre = 'consumer';
  console.log('\n═══════════════════════════════════════');
  console.log(`   ${GENRE_LABELS[genre]}`);
  console.log('═══════════════════════════════════════\n');

  const used = loadUsedIdeas();

  console.log('Step 1/7  Picking source + writing grounded script...');
  const content = await generateConsumerContent(used);
  if (!content) {
    // FAIL LOUD: a green CI run with zero uploads is misleading. If no source
    // came back, either the feeds are broken, the LLM step failed, or every
    // candidate was on cooldown — all cases we want to see in the Actions log
    // as a red run, not a silent success that produces nothing.
    console.error('  Pipeline failed: generateConsumerContent returned null (no source, all on cooldown, or LLM failure).');
    process.exit(1);
  }
  console.log(`  Source: ${content.sourceAuthority} — ${content.sourceUrl}`);
  console.log(`  Hook: "${content.hook_text}"`);
  console.log(`  Script: ${content.narration.split(/\s+/).length} words`);
  checkConsumerScript(content);
  console.log();

  console.log('Step 2/7  Recording real UI screencasts (top half)...');
  const rawClips = await recordSceneMotion(content.top_scenes);
  // Fill any single-scene failure with the first successful recording so one
  // 404 doesn't nuke the whole run.
  const firstGood = rawClips.find(Boolean);
  const topClips = rawClips.map(c => c || firstGood || null);
  const missCount = rawClips.filter(c => !c).length;
  if (firstGood && missCount > 0) {
    console.log(`  Filled ${missCount} failed screencast(s) with a reused successful clip.`);
  }
  content.clips = topClips;
  checkClips(topClips);
  console.log();

  console.log('Step 3/7  Fetching satisfying loop (bottom half)...');
  const sludgeKeyword = SLUDGE_QUERIES[Math.floor(Math.random() * SLUDGE_QUERIES.length)];
  console.log(`  Sludge: "${sludgeKeyword}"`);
  const sludgeClips = await fetchSceneVideos([{ keyword: sludgeKeyword }]);
  content.sludgeClip = sludgeClips[0] || null;
  console.log();

  console.log('Step 4/7  Generating voiceover...');
  const audio = await generateAudio(content.narration, genre);
  content.narration = content.narration.replace(/\s*\|\|\s*/g, ' ').trim();
  checkAudio(audio);
  console.log();

  console.log('Step 5/7  Preparing background music...');
  const musicPath = await prepareMusic(genre);
  content.hasMusic = musicPath !== null;
  console.log();

  console.log('Step 6/7  Rendering Split-Sludge video...');
  const videoPath = await renderSplitSludgeVideo(content, audio);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  console.log();

  console.log('Step 7/7  Publishing...');
  await publish(content, videoPath);

  saveUsedIdea({
    topic: content.title,
    title: content.title,
    genre: 'consumer',
    tracking_slug: content.tracking_slug,
    sourceUrl: content.sourceUrl,
    sourceAuthority: content.sourceAuthority,
    topicCategory: content.topicCategory,
  });

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

// Kings of Ranks — SILENT ranking (no voiceover): music + captions + crown
// ranks over legal stock/CC clips. Topic dedup comes from generateIdea (so no
// repeated rankings); items are structured, one clip per rank.
async function runKingsRanks() {
  console.log('\n═══════════════════════════════════════');
  console.log('   Kings of Ranks');
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/4  Picking a fresh ranking topic (deduped)...');
  const idea = await generateIdea('kingsranks');   // trend-driven Top-5 + full dedup, saved to used-ideas
  console.log(`  Topic: "${idea.topic}"`);
  const content = await generateKingsItems(idea.topic);
  if (!content) throw new Error('Could not build the ranking items for this topic.');
  content.genre = 'kingsranks';   // drives category (Science & Tech) + niche tags + music credit in the uploader
  console.log(`  "${content.title}" — ${content.items.map(i => `#${i.rank} ${i.label} (${i.score})`).join(', ')}`);
  checkKingsRanks(content);
  console.log();

  console.log('Step 2/4  Fetching a funny clip per rank...');
  // Funny stock VIDEO (moving) per rank, keyed on each item's generic funny query.
  // Pexels/Pixabay footage is license-free (no attribution needed).
  const clipsRaw = await fetchClipsWithDuration(content.items.map(i => ({ keyword: i.keyword })));
  const firstValid = clipsRaw.find(Boolean);
  if (!firstValid) throw new Error('No footage fetched for any rank.');
  // Align by index; substitute the first valid clip for any that failed so no
  // rank renders as a dead black slot.
  const clips = content.items.map((_, i) => clipsRaw[i] || firstValid);
  console.log(`  ${clipsRaw.filter(Boolean).length}/${content.items.length} clips fetched\n`);

  console.log('Step 3/4  Preparing upbeat music...');
  const musicPath = await prepareMusic('kingsranks');
  console.log();

  console.log('Step 4/4  Rendering + publishing...');
  content.hasMusic = musicPath !== null;   // appends the Kevin MacLeod CC-BY credit to the description
  const videoPath = await renderSilentKingsRanks(content, clips, content.hasMusic);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  await publish(content, videoPath);

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

async function runVersus() {
  console.log('\n═══════════════════════════════════════');
  console.log('   Kings of Ranks — Have You Ever Thought…');
  console.log('═══════════════════════════════════════\n');

  console.log('Step 1/4  Picking a fresh comparison question (deduped)...');
  const idea = await generateIdea('versus');
  console.log(`  Question: "${idea.topic}"`);
  const content = await generateVersusContent(idea.topic);
  if (!content) throw new Error('Could not build the comparison for this question.');
  content.genre = 'versus';   // uploader category/tags
  console.log(`  "${content.title}" — ${content.a.name} vs ${content.b.name} → winner: ${content.winner === 'b' ? content.b.name : content.a.name}`);
  checkVersus(content);
  console.log();

  console.log('Step 2/4  Fetching a clip for each contender...');
  const clipsRaw = await fetchClipsWithDuration([{ keyword: content.a.keyword }, { keyword: content.b.keyword }]);
  const firstValid = clipsRaw.find(Boolean);
  if (!firstValid) throw new Error('No footage fetched for either contender.');
  const clips = clipsRaw.map(c => c || firstValid);
  console.log(`  ${clipsRaw.filter(Boolean).length}/2 clips fetched\n`);

  console.log('Step 3/4  Preparing music...');
  const musicPath = await prepareMusic('versus');
  content.hasMusic = musicPath !== null;
  console.log();

  console.log('Step 4/4  Rendering + publishing...');
  const videoPath = await renderVersusVideo(content, clips, content.hasMusic);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  await publish(content, videoPath);

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

// Ranking Game pipeline — the "5 clips ranked by cost" gamified format with
// voiceover. LLM writes hook + 5 clip narrations + outro; Pexels supplies the
// stock footage per rank; renderer overlays rank badge + text overlay + kinetic
// captions on top. No creator handles used — attribution is "Stock: Pexels".
async function runRankingGame() {
  const genre = 'rankinggame';
  console.log('\n═══════════════════════════════════════');
  console.log(`   ${GENRE_LABELS[genre]}`);
  console.log('═══════════════════════════════════════\n');

  const used = loadUsedIdeas();
  const recentTopics = used.slice(-30).map(u => u.topic).filter(Boolean);

  console.log('Step 1/6  Picking topic + writing 5-clip ranked script...');
  const content = await generateRankingGameContent(recentTopics);
  if (!content) {
    console.error('  Pipeline failed: generateRankingGameContent returned null (LLM failure after 3 attempts).');
    process.exit(1);
  }
  console.log(`  Title: "${content.title}"`);
  console.log(`  Hook: "${content.hook_text}"`);
  console.log(`  Clips: ${content.clips.length} ranked ${content.clips.map(c => `#${c.rank}`).join(' → ')}`);
  console.log(`  Narration: ${content.narration.split(/\s+/).length} words`);
  checkRankingGame(content);
  console.log();

  console.log('Step 2/6  Fetching Pexels stock footage per rank...');
  // Each ranked clip is fetched by its search_keywords. fetchClipsWithDuration
  // dedupes by source URL across scenes so no two ranks show the same clip.
  const scenes = content.clips.map(c => ({ keyword: c.search_keywords }));
  const clips = await fetchClipsWithDuration(scenes);
  const validClips = clips.filter(Boolean);
  if (validClips.length < 3) {
    console.error(`  Pipeline failed: only ${validClips.length}/5 clips fetched.`);
    process.exit(1);
  }
  // Fill any missing clip with the first successful one so the render never
  // has empty scene slots.
  const firstGood = clips.find(Boolean);
  const filled = clips.map(c => c || firstGood);
  console.log(`  ${validClips.length}/${clips.length} unique clips (${clips.length - validClips.length} filled).`);
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

  console.log('Step 5/6  Rendering Ranking Game video...');
  const videoPath = await renderRankingGame(content, audio, filled);
  console.log(`  Saved to: ${videoPath}`);
  checkRender(videoPath);
  console.log();

  console.log('Step 6/6  Publishing...');
  await publish(content, videoPath);

  saveUsedIdea({
    topic: content.topic,
    title: content.title,
    genre: 'rankinggame',
  });

  console.log('\n═══════════════════════════════════════');
  console.log('   Done!');
  console.log('═══════════════════════════════════════\n');
}

// Dispatcher: GENRE_OVERRIDE picks the pipeline
// (consumer | aitools | splitedit | kingsranks | versus | rankinggame | countdown).
// ClipRanks — the LEGAL version of the "real funny clips" idea. Turns clips the
// creator ALREADY OWNS (their Google Flow / Veo output, or licensed clips) into a
// ranked funny countdown. Drop clips into assets/clips/ with descriptive names
// (e.g. "cat-attacks-curtain.mp4"); we crop each to 9:16, rank them, write funny
// captions, and render with the same near-invisible leaderboard + music + outro.
// This is where the real funny footage lives — NO scraping/reposting of others'
// clips, ever.
async function runClipRanks() {
  console.log('\n═══════════════════════════════════════');
  console.log('   Kings of Ranks — Clip Ranks (your clips)');
  console.log('═══════════════════════════════════════\n');

  const CLIPS_PER_REEL = 5;
  const MAX_REELS = 4;
  const exts = new Set(['.mp4', '.mov', '.webm', '.m4v', '.avi']);
  const all = existsSync(CLIPRANKS_DIR)
    ? readdirSync(CLIPRANKS_DIR).filter(f => !f.startsWith('.') && exts.has(extname(f).toLowerCase())).sort()
    : [];

  // The core new rule: NO clips today → NO upload. Clean skip, not an error.
  if (all.length < CLIPS_PER_REEL) {
    console.log(`⏸  No upload: need ≥${CLIPS_PER_REEL} clips in "${CLIPRANKS_DIR}" (found ${all.length}).`);
    console.log('   Drop clips you OWN there and re-run. The channel only posts from your clips.\n');
    return;
  }

  const reels = Math.min(MAX_REELS, Math.floor(all.length / CLIPS_PER_REEL));
  console.log(`Found ${all.length} clips → making ${reels} reel(s) of ${CLIPS_PER_REEL}.\n`);
  mkdirSync(CLIPRANKS_OUT, { recursive: true });
  const posted = [];

  for (let r = 0; r < reels; r++) {
    const batch = all.slice(r * CLIPS_PER_REEL, r * CLIPS_PER_REEL + CLIPS_PER_REEL);
    console.log(`\n──────── Reel ${r + 1}/${reels} ────────`);
    const descriptions = batch.map(f => basename(f, extname(f)).replace(/[-_]+/g, ' ').trim());
    console.log(`  Clips: ${descriptions.join(' | ')}`);

    // Crop each owned clip to 9:16 (their clip-processor).
    const processed = batch.map((f, i) => {
      const out = join(CLIPRANKS_OUT, `clip_${i}.mp4`);
      processViralClip(join(CLIPRANKS_DIR, f), out, 0, 7);
      return { path: `videos/clip_${i}.mp4`, duration: probeDuration(out) };
    });

    // Rank + add the commentary that makes each clip funnier.
    const content = await generateClipRanks(descriptions);
    content.genre = 'kingsranks';
    const N = content.items.length;
    const clips = content.items.map(it => processed[it.srcIndex]);
    content.items = content.items.map((it, i) => ({ rank: N - i, label: it.label, caption: it.caption }));
    if (clips.some(c => !c) || content.items.length !== CLIPS_PER_REEL) {
      console.log('  ✗ Could not align this batch; leaving its clips in place, skipping.');
      continue;
    }
    console.log(`  "${content.title}" — ${content.items.map(i => `#${i.rank} ${i.label}`).join(', ')}`);

    const musicPath = await prepareMusic('kingsranks');
    content.hasMusic = musicPath !== null;
    const videoPath = await renderSilentKingsRanks(content, clips, content.hasMusic);
    checkRender(videoPath);
    await publish(content, videoPath);

    // Delete the used clips so the folder stays clean — ONLY after a real upload.
    if (process.env.UPLOAD === '1') {
      for (const f of batch) {
        try { unlinkSync(join(CLIPRANKS_DIR, f)); }
        catch (e) { console.log(`  (couldn't remove ${f}: ${e.message})`); }
      }
      console.log(`  ✓ Reel ${r + 1} posted; its ${CLIPS_PER_REEL} used clips removed from the folder.`);
    } else {
      console.log(`  ✓ Reel ${r + 1} rendered (UPLOAD!=1, so clips kept).`);
    }
    posted.push(content.title);
  }

  const leftover = all.length - reels * CLIPS_PER_REEL;
  console.log(`\n═══ Done: ${posted.length} reel(s). ${leftover > 0 ? `${leftover} leftover clip(s) kept for next time.` : 'Folder clean.'} ═══\n`);
}

async function run() {
  checkEnv();
  const genre = process.env.GENRE_OVERRIDE || getTodayGenre();
  if (genre === 'consumer') return runConsumerAwareness();
  if (genre === 'aitools') return runAiTools();
  if (genre === 'splitedit') return runSplitEdit();
  if (genre === 'kingsranks') return runKingsRanks();
  if (genre === 'versus') return runVersus();
  if (genre === 'rankinggame') return runRankingGame();
  if (genre === 'clipranks') return runClipRanks();
  return runCountdown();
}

run().catch(err => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const RENDER_OPTS = {
  codec: 'h264',
  jpegQuality: 100,
  crf: 18,
  timeoutInMilliseconds: 60000,
  chromiumOptions: {
    disableWebSecurity: true,
    gl: 'swiftshader',
    noSandbox: !!process.env.CI,
  },
};

// Render the split-screen "edit": trending-subject stock on top, satisfying loop
// on bottom, royalty-free music. content = split-edit object; topClips /
// satisfyingClips are public-relative paths (e.g. 'videos/clip_0.mp4').
export async function renderSplitScreenVideo(content, topClips, satisfyingClips, hasMusic) {
  const inputProps = {
    topClips: topClips || [],
    satisfyingClips: satisfyingClips || [],
    hookText: content.hook_text || '',
    captionLines: content.caption_lines || [],
    channelName: process.env.CHANNEL_NAME || 'Distoir',
    logo: ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
    hasMusic: !!hasMusic,
    durationSec: 30,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'SplitScreenVideo', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (split-screen)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the Consumer Awareness "Split-Sludge" composition: real-UI screencast
// on top (script.clips = .mp4 recordings from src/screencast.js), muted
// satisfying loop on bottom (script.sludgeClip = a single .mp4 path). Reuses
// the audio+beat pipeline exactly like renderVideo.
export async function renderSplitSludgeVideo(content, audio) {
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });
  const audioSrcDir = join(ROOT_DIR, 'output', 'audio');
  for (const beat of audio.beats) {
    copyFileSync(join(audioSrcDir, beat.file), join(publicAudioDir, beat.file));
  }

  const inputProps = {
    title:         content.title,
    narration:     content.narration,
    audioDuration: audio.duration,
    wordTimings:   audio.wordTimings || [],
    beats:         audio.beats || [],
    channelName:   process.env.CHANNEL_NAME || 'Distoir',
    hookText:      content.hook_text,
    clips:         content.clips || [],
    sludgeClip:    content.sludgeClip || null,
    hasMusic:      content.hasMusic || false,
    logo:          ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
  };

  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'SplitSludge', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (split-sludge)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the Kings of Ranks SILENT ranking (no voiceover — music + captions +
// crown ranks). content = { items, title_card, ... }; clips = [{path,duration}]
// aligned by index with items.
export async function renderSilentKingsRanks(content, clips, hasMusic) {
  const inputProps = {
    items: content.items || [],
    clips: clips || [],
    titleCard: content.title_card || content.title || '',
    channelName: process.env.CHANNEL_NAME || 'Kings of Ranks',
    logo: ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
    hasMusic: !!hasMusic,
    durationSec: 32,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'KingsRanks', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (Kings of Ranks)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the Kings of Ranks NARRATED clip-ranks video: each clip keeps its own
// audio, one quiet music bed underneath, a narrator reacting to every clip, and
// creator credits on screen. content = { items, title_card, ... }; clips =
// [{path,duration}] aligned with items; credits = [handle] aligned with items;
// audio = generateAudio() output (beats + wordTimings + duration).
export async function renderClipRanksNarrated(content, clips, credits, audio, hasMusic, bonus = null, hookText = '', hookClip = null) {
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });
  const audioSrcDir = join(ROOT_DIR, 'output', 'audio');
  for (const beat of audio.beats) {
    copyFileSync(join(audioSrcDir, beat.file), join(publicAudioDir, beat.file));
  }

  const inputProps = {
    items:         content.items || [],
    clips:         clips || [],
    credits:       credits || [],
    titleCard:     content.title_card || content.title || '',
    channelName:   process.env.CHANNEL_NAME || 'Kings of Ranks',
    // No logo file for this channel yet — the crown motif + wordmark brand it.
    // (Avoids stamping an old/other-brand crest on the clip-ranks reels.)
    logo:          null,
    hasMusic:      !!hasMusic,
    narration:     content.narration || '',
    audioDuration: audio.duration,
    wordTimings:   audio.wordTimings || [],
    beats:         audio.beats || [],
    // Optional bonus photo shown once at the very end: { path, line, credit }.
    bonus:         bonus || null,
    // Optional cold-open hook text (retention): big "WAIT FOR #1"-style promise.
    hookText:      hookText || '',
    // Separate physical copy of the #1 clip for the hook (avoids a same-file
    // OffthreadVideo frame-cache collision that rendered the wrong clip at #1).
    hookClip:      hookClip || null,
    durationSec:   audio.duration + 0.6,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'KingsRanks', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (Kings of Ranks — narrated)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the NO-NARRATION laugh-track montage: clips back-to-back (own audio
// muted), the only sound is timed laugh bursts, minimal on-screen furniture.
// clips = [{path,duration}] in play order; credits aligned; laughs = [{file,
// startTime, duration, volume?}] placed on the funny moments. The laugh audio
// files must already be copied into public/audio.
export async function renderFunnyMontage({ clips, credits, channelName, clipVolume, durationSec }) {
  const inputProps = {
    clips:       clips || [],
    credits:     credits || [],
    channelName: channelName || process.env.CHANNEL_NAME || 'Kings of Ranks',
    clipVolume:  clipVolume != null ? clipVolume : 1,
    durationSec,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'FunnyMontage', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (Funny Montage — laugh track)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the "Have you ever thought that…" comparison (silent — music + captions).
// content = { question, hook, a, b, winner, answer, ... }; clips = [{path,duration}]
// for [A, B], aligned by index.
export async function renderVersusVideo(content, clips, hasMusic) {
  const inputProps = {
    question: content.question || '',
    hook: content.hook || 'HAVE YOU EVER THOUGHT…',
    a: content.a || {},
    b: content.b || {},
    winner: content.winner || 'a',
    answer: content.answer || '',
    clips: clips || [],
    channelName: process.env.CHANNEL_NAME || 'Kings of Ranks',
    logo: ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
    hasMusic: !!hasMusic,
    durationSec: 30,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'VersusVideo', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (Versus)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

// Render the Ranking Game composition — voiced 50s ranking-game format.
// content = the rankinggame genre payload (hook_text + clips + attribution);
// audio = generateAudio() output (beats + wordTimings + duration);
// clips = [{path, duration}] aligned by index with content.clips.
export async function renderRankingGame(content, audio, clips) {
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });
  const audioSrcDir = join(ROOT_DIR, 'output', 'audio');
  for (const beat of audio.beats) {
    copyFileSync(join(audioSrcDir, beat.file), join(publicAudioDir, beat.file));
  }

  // Merge fetched clips with each ranked item's rank/text_overlay so the
  // composition can access all it needs from a single `clips` prop.
  const mergedClips = (content.clips || []).map((c, i) => ({
    path:         clips[i]?.path || null,
    duration:     clips[i]?.duration || 8,
    rank:         c.rank,
    text_overlay: c.text_overlay || '',
  }));

  const inputProps = {
    narration:     content.narration,
    audioDuration: audio.duration,
    wordTimings:   audio.wordTimings || [],
    beats:         audio.beats || [],
    hookText:      content.hook_text || '',
    clips:         mergedClips,
    attribution:   content.attribution || 'Stock: Pexels',
    channelName:   process.env.CHANNEL_NAME || 'Kings of Ranks',
    logo:          ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
    hasMusic:      content.hasMusic || false,
  };
  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({ entryPoint: join(__dirname, 'index.jsx'), webpackOverride: (c) => c });
  const composition = await selectComposition({ serveUrl: bundled, id: 'RankingGame', inputProps });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');
  console.log(`  Rendering ${composition.durationInFrames} frames (Ranking Game)...`);
  await renderMedia({
    composition, serveUrl: bundled, outputLocation: outputPath, inputProps, ...RENDER_OPTS,
    onProgress: ({ progress }) => process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `),
  });
  process.stdout.write('\n');
  return outputPath;
}

export async function renderVideo(script, audio) {
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });
  const audioSrcDir = join(ROOT_DIR, 'output', 'audio');
  for (const beat of audio.beats) {
    copyFileSync(join(audioSrcDir, beat.file), join(publicAudioDir, beat.file));
  }

  const inputProps = {
    title:           script.title,
    narration:       script.narration,
    audioDuration:   audio.duration,
    wordTimings:     audio.wordTimings || [],
    beats:           audio.beats || [],
    channelName:     process.env.CHANNEL_NAME || 'Did You Know',
    genre:           script.genre,
    hookText:        script.hook_text,
    clips:           script.clips || [],
    scenes:          script.scenes || [],
    hasMusic:        script.hasMusic || false,
    characterImages: script.characterImages || null,
    // Brand logo (watermark + end-card), only if present so renders never break.
    logo:            ['logo.png', 'logo.webp', 'logo.jpg'].find(f => existsSync(join(ROOT_DIR, 'public', f))) || null,
  };

  writeFileSync(join(ROOT_DIR, 'config', 'render-props.json'), JSON.stringify(inputProps, null, 2));

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({
    entryPoint: join(__dirname, 'index.jsx'),
    webpackOverride: (config) => config,
  });

  console.log('  Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'SlideshowVideo',
    inputProps,
  });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');

  console.log(`  Rendering ${composition.durationInFrames} frames...`);

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    // Quality: capture frames at full JPEG quality (default 80 softens text and
    // gradients) and encode near-visually-lossless (crf 18). File stays well
    // under the 120MB check at 1080x1920.
    jpegQuality: 100,
    crf: 18,
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 60000,
    chromiumOptions: {
      disableWebSecurity: true,
      gl: 'swiftshader',
      noSandbox: !!process.env.CI,
    },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `);
    },
  });

  process.stdout.write('\n');
  return outputPath;
}

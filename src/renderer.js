import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

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

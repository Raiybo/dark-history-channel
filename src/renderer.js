import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

export async function renderVideo(script, audio) {
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });
  copyFileSync(audio.file, join(publicAudioDir, 'narration.mp3'));

  const inputProps = {
    title:           script.title,
    narration:       script.narration,
    audioDuration:   audio.duration,
    wordTimings:     audio.wordTimings || [],
    channelName:     process.env.CHANNEL_NAME || 'Distoir',
    genre:           script.genre,
    hookText:        script.hook_text,
    clips:           script.clips || [],
    scenes:          script.scenes || [],
    hasMusic:        script.hasMusic || false,
    characterImages: script.characterImages || null,
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

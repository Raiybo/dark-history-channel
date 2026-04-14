import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

export async function renderVideo(script, audio) {
  // Copy audio files to public/ so Remotion's staticFile() can access them
  const publicAudioDir = join(ROOT_DIR, 'public', 'audio');
  mkdirSync(publicAudioDir, { recursive: true });

  audio.files.forEach((file, i) => {
    copyFileSync(file, join(publicAudioDir, `chapter_${i}.mp3`));
  });

  const inputProps = {
    title: script.title,
    chapters: script.chapters,
    chapterDurations: audio.durations,
    channelName: process.env.CHANNEL_NAME || 'Dark Chronicles'
  };

  // Save props for debugging
  writeFileSync(
    join(ROOT_DIR, 'config', 'render-props.json'),
    JSON.stringify(inputProps, null, 2)
  );

  console.log('  Bundling Remotion project...');
  const bundled = await bundle({
    entryPoint: join(__dirname, 'index.jsx'),
    webpackOverride: (config) => config
  });

  console.log('  Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'DarkHistoryVideo',
    inputProps
  });

  mkdirSync(join(ROOT_DIR, 'output'), { recursive: true });
  const outputPath = join(ROOT_DIR, 'output', 'video.mp4');

  console.log(`  Rendering ${composition.durationInFrames} frames at ${composition.fps}fps...`);

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    chromiumOptions: {
      disableWebSecurity: true,
      gl: 'swiftshader'
    },
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%   `);
    }
  });

  process.stdout.write('\n');
  return outputPath;
}

import { spawnSync } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DYK_VOICE } from './genres/didyouknow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../output/audio');

const VOICES = { didyouknow: DYK_VOICE };

function parseTimestamp(ts) {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':').map(Number).reverse();
  return parts[0] + (parts[1] || 0) * 60 + (parts[2] || 0) * 3600;
}

function parseVtt(vttContent) {
  const segments = [];
  const blocks = vttContent.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split(' --> ');
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
    if (text) segments.push({ start, end, text });
  }
  return segments;
}

function buildWordTimings(segments, totalDuration) {
  const wordTimings = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    const segDuration = seg.end - seg.start;
    const wordDur = segDuration / words.length;
    words.forEach((word, i) => {
      wordTimings.push({
        word,
        start: seg.start + i * wordDur,
        end: Math.min(seg.start + (i + 1) * wordDur, totalDuration),
      });
    });
  }
  return wordTimings;
}

export async function generateAudio(narration, genre = 'didyouknow') {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const voice = VOICES[genre] || VOICES.didyouknow;
  const mp3Path = join(AUDIO_DIR, 'narration.mp3');
  const vttPath = join(AUDIO_DIR, 'narration.vtt');

  console.log(`  Generating voiceover (${voice.name})...`);

  const ttsArgs = [
    '--voice', voice.name,
    `--rate=${voice.rate || '-15%'}`,
    `--pitch=${voice.pitch || '-5Hz'}`,
    '--text', narration,
    '--write-media', mp3Path,
    '--write-subtitles', vttPath,
  ];

  // Prefer the `edge-tts` CLI (Linux CI); fall back to the Python module
  // invocation when the standalone command isn't on PATH (common on Windows).
  const opts = { timeout: 90000, encoding: 'utf8' };
  let result = spawnSync('edge-tts', ttsArgs, opts);
  if (result.error?.code === 'ENOENT') {
    const py = process.platform === 'win32' ? 'python' : 'python3';
    result = spawnSync(py, ['-m', 'edge_tts', ...ttsArgs], opts);
  }

  if (result.status !== 0) {
    throw new Error(`edge-tts failed: ${result.stderr || result.error?.message}`);
  }

  const duration = await getAudioDurationInSeconds(mp3Path);
  console.log(`  Audio duration: ${duration.toFixed(1)}s`);

  const vttContent = readFileSync(vttPath, 'utf8');
  const segments = parseVtt(vttContent);
  const wordTimings = buildWordTimings(segments, duration);

  return { file: mp3Path, duration, wordTimings };
}

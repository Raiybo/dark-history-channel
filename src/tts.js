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
  // Normalize line endings first — edge-tts on Windows writes CRLF, and a raw
  // \n\n split would never match \r\n\r\n, collapsing the whole file into one
  // bogus cue (which made every word timing garbage and the captions drift).
  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\n+/);
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

// edge-tts gives sentence-level cues, so we split each cue into words and
// estimate how long each word actually takes. Even splitting makes long words
// (and spoken-out numbers) lag; weighting by syllables/length tracks the voice
// much more closely. Each word is tagged with its sentence index so captions
// can be grouped by the line being spoken.
function speakWeight(word) {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!w) return 1;
  // Digits are read aloud (e.g. "2560" -> "twenty-five sixty"), so weigh them heavily.
  const digits = (w.match(/[0-9]/g) || []).length;
  const vowelGroups = (w.match(/[aeiouy]+/g) || []).length;
  const syllables = Math.max(1, vowelGroups, Math.ceil(w.length / 3));
  return syllables + digits * 1.5;
}

function buildWordTimings(segments, totalDuration) {
  const wordTimings = [];
  segments.forEach((seg, segIndex) => {
    const words = seg.text.split(/\s+/).filter(Boolean);
    const segDuration = seg.end - seg.start;
    const weights = words.map(speakWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0) || words.length;
    let cursor = seg.start;
    words.forEach((word, i) => {
      const dur = segDuration * (weights[i] / totalWeight);
      const start = cursor;
      cursor = Math.min(cursor + dur, totalDuration);
      wordTimings.push({ word, start, end: cursor, seg: segIndex, segStart: i === 0 });
    });
  });
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

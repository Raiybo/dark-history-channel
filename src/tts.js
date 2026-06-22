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

// Silent breath inserted between idea beats (seconds). Trimmed to keep the
// overall pace ~10% snappier alongside the faster voice rate.
const GAP_SECONDS = 0.38;

// Clean text before it reaches edge-tts. Dashes, brackets, slashes and smart
// quotes make the neural voice stumble, mispronounce, or insert weird pauses —
// the "glitchy / words not clear" symptom. We normalize to plain spoken words
// and simple punctuation only. The VTT (and therefore captions) come from this
// same cleaned text, so audio and on-screen words stay in sync.
function sanitizeForTts(text) {
  return (text || '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")  // smart quotes -> ascii
    .replace(/\s*[—–-]\s*/g, ', ')                  // dashes -> a short comma pause
    .replace(/[()[\]{}]/g, ' ')                      // brackets -> space
    .replace(/[*_~`#|]/g, ' ')                       // stray markdown/symbols
    .replace(/\s*&\s*/g, ' and ')                    // & -> and
    .replace(/\s*\/\s*/g, ' or ')                    // slash -> or
    .replace(/\s+([,.!?])/g, '$1')                   // no space before punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function runEdgeTts(voice, text, mp3Path, vttPath) {
  const args = [
    '--voice', voice.name,
    `--rate=${voice.rate || '+0%'}`,
    `--pitch=${voice.pitch || '+0Hz'}`,
    '--text', text,
    '--write-media', mp3Path,
    '--write-subtitles', vttPath,
  ];
  // Prefer the `edge-tts` CLI (Linux CI); fall back to the Python module
  // invocation when the standalone command isn't on PATH (common on Windows).
  const opts = { timeout: 90000, encoding: 'utf8' };
  let result = spawnSync('edge-tts', args, opts);
  if (result.error?.code === 'ENOENT') {
    const py = process.platform === 'win32' ? 'python' : 'python3';
    result = spawnSync(py, ['-m', 'edge_tts', ...args], opts);
  }
  if (result.status !== 0) {
    throw new Error(`edge-tts failed: ${result.stderr || result.error?.message}`);
  }
}

// The narration is written with " || " marking each idea shift. We synthesize
// each beat separately and lay them out with a real silent gap between, so the
// narrator audibly breathes when the idea changes. Each beat is also a fresh
// utterance, which keeps the delivery from flattening into one monotone read.
// Word timings are merged onto one global timeline (beat start + local time).
export async function generateAudio(narration, genre = 'didyouknow') {
  mkdirSync(AUDIO_DIR, { recursive: true });
  const voice = VOICES[genre] || VOICES.didyouknow;

  const beatsText = narration.split('||').map(s => sanitizeForTts(s)).filter(Boolean);
  const texts = beatsText.length > 0 ? beatsText : [sanitizeForTts(narration)];

  console.log(`  Generating voiceover (${voice.name}) — ${texts.length} beat(s)...`);

  const beats = [];
  const wordTimings = [];
  let cursor = 0;     // start time (s) of the current beat
  let segOffset = 0;  // running global sentence index

  for (let i = 0; i < texts.length; i++) {
    const file = `beat_${i}.mp3`;
    const mp3Path = join(AUDIO_DIR, file);
    const vttPath = join(AUDIO_DIR, `beat_${i}.vtt`);

    runEdgeTts(voice, texts[i], mp3Path, vttPath);
    const dur = await getAudioDurationInSeconds(mp3Path);
    const segs = parseVtt(readFileSync(vttPath, 'utf8'));

    for (const w of buildWordTimings(segs, dur)) {
      wordTimings.push({
        word: w.word,
        start: w.start + cursor,
        end: w.end + cursor,
        seg: w.seg + segOffset,
        segStart: w.segStart,
      });
    }

    beats.push({ file, startTime: cursor, duration: dur });
    segOffset += segs.length;
    cursor += dur + (i < texts.length - 1 ? GAP_SECONDS : 0);
  }

  console.log(`  Total duration: ${cursor.toFixed(1)}s (with ${texts.length - 1} gap(s))`);
  return { beats, duration: cursor, wordTimings };
}

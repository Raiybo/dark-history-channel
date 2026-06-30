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

// With `--words-in-cue 1` (set in runEdgeTts), edge-tts emits ONE cue per word
// using the real word boundaries from the neural voice's synthesis engine.
// No estimation, no syllable weighting — these are the actual on-screen times
// the spoken word lands. Sentence grouping is reconstructed by detecting words
// that end with sentence punctuation (., !, ?) — the NEXT word starts a new
// sentence and gets segStart=true so the subtitle component groups correctly.
function buildWordTimings(segments) {
  const wordTimings = [];
  let segIndex = 0;
  let nextStartsSentence = true;
  for (const seg of segments) {
    const word = seg.text.trim();
    if (!word) continue;
    wordTimings.push({
      word,
      start: seg.start,
      end: seg.end,
      seg: segIndex,
      segStart: nextStartsSentence,
    });
    // If this word ends a sentence, the next one starts a new sentence index.
    if (/[.!?]$/.test(word)) {
      segIndex++;
      nextStartsSentence = true;
    } else {
      nextStartsSentence = false;
    }
  }
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
  // --words-in-cue 1: each VTT cue is exactly one spoken word with the real
  // start/end times from the neural voice's word-boundary events. This kills
  // the drift the old syllable-estimator introduced, especially on long words
  // and spoken-out numbers.
  const args = [
    '--voice', voice.name,
    `--rate=${voice.rate || '+0%'}`,
    `--pitch=${voice.pitch || '+0Hz'}`,
    '--text', text,
    '--words-in-cue', '1',
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

    for (const w of buildWordTimings(segs)) {
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

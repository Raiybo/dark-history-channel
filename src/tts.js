import textToSpeech from '@google-cloud/text-to-speech';
import { writeFileSync, mkdirSync } from 'fs';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { STOIC_VOICE } from './genres/stoic.js';
import { FUTURE_VOICE } from './genres/future.js';
import { OPTIMIZE_VOICE } from './genres/optimize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../output/audio');

const VOICES = { stoic: STOIC_VOICE, future: FUTURE_VOICE, optimize: OPTIMIZE_VOICE };

function buildClient() {
  const credentials = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

function buildSsml(text) {
  const words = text.trim().split(/\s+/);
  const marked = words.map((w, i) => `<mark name="w${i}"/>${w}`).join(' ');
  return { ssml: `<speak>${marked}</speak>`, words };
}

export async function generateAudio(narration, genre = 'future') {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const client = buildClient();
  const outputPath = join(AUDIO_DIR, 'narration.mp3');
  const voice = VOICES[genre] || VOICES.future;

  console.log(`  Generating voiceover (${genre} voice)...`);

  const { ssml, words } = buildSsml(narration);

  const [response] = await client.synthesizeSpeech({
    input: { ssml },
    voice: {
      languageCode: 'en-US',
      name: voice.name,
      ssmlGender: voice.gender || 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: voice.speakingRate,
      pitch: voice.pitch,
      effectsProfileId: ['headphone-class-device'],
    },
    enableTimePointing: ['SSML_MARK'],
  });

  writeFileSync(outputPath, response.audioContent, 'binary');

  const duration = await getAudioDurationInSeconds(outputPath);
  console.log(`  Audio duration: ${duration.toFixed(1)}s`);

  const timepoints = response.timepoints || [];
  const wordTimings = words.map((word, i) => ({
    word,
    start: timepoints[i]?.timeSeconds ?? (i / words.length) * duration,
    end: timepoints[i + 1]?.timeSeconds ?? duration,
  }));

  return { file: outputPath, duration, wordTimings };
}

import textToSpeech from '@google-cloud/text-to-speech';
import { writeFileSync, mkdirSync } from 'fs';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FUTURE_VOICE } from './genres/future.js';
import { OPTIMIZE_VOICE } from './genres/optimize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../output/audio');

const VOICES = { future: FUTURE_VOICE, optimize: OPTIMIZE_VOICE };

function buildClient() {
  const credentials = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

const isJourneyVoice = (name) => name && name.includes('Journey');

function buildSsml(text) {
  const words = text.trim().split(/\s+/);
  let firstPauseDone = false;
  const parts = words.map((w, i) => {
    let chunk = `<mark name="w${i}"/>${w}`;
    if (!firstPauseDone && i >= 3 && /[.!?]$/.test(w)) {
      chunk += '<break time="600ms"/>';
      firstPauseDone = true;
    }
    return chunk;
  });
  return { ssml: `<speak>${parts.join(' ')}</speak>`, words };
}

export async function generateAudio(narration, genre = 'future') {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const client = buildClient();
  const outputPath = join(AUDIO_DIR, 'narration.mp3');
  const voice = VOICES[genre] || VOICES.future;
  const journey = isJourneyVoice(voice.name);

  console.log(`  Generating voiceover (${genre} voice — ${voice.name})...`);

  const words = narration.trim().split(/\s+/);

  // Journey voices only accept plain text — no SSML, no marks, no effectsProfileId
  const request = journey ? {
    input: { text: narration },
    voice: { languageCode: 'en-US', name: voice.name, ssmlGender: voice.gender || 'MALE' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: voice.speakingRate },
  } : (() => {
    const { ssml } = buildSsml(narration);
    return {
      input: { ssml },
      voice: {
        languageCode: 'en-US',
        name: voice.name,
        ssmlGender: voice.gender || 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: voice.speakingRate,
        ...(voice.pitch !== undefined && voice.pitch !== 0 ? { pitch: voice.pitch } : {}),
        effectsProfileId: ['headphone-class-device'],
      },
      enableTimePointing: ['SSML_MARK'],
    };
  })();

  const [response] = await client.synthesizeSpeech(request);

  writeFileSync(outputPath, response.audioContent, 'binary');

  const duration = await getAudioDurationInSeconds(outputPath);
  console.log(`  Audio duration: ${duration.toFixed(1)}s`);

  const timepoints = response.timepoints || [];
  const wordTimings = words.map((word, i) => ({
    word,
    // Journey: no marks, spread evenly; Neural2: use real timestamps
    start: journey
      ? (i / words.length) * duration
      : (timepoints[i]?.timeSeconds ?? (i / words.length) * duration),
    end: journey
      ? ((i + 1) / words.length) * duration
      : (timepoints[i + 1]?.timeSeconds ?? duration),
  }));

  return { file: outputPath, duration, wordTimings };
}

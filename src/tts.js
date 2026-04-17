import textToSpeech from '@google-cloud/text-to-speech';
import { writeFileSync, mkdirSync } from 'fs';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../output/audio');

function buildClient() {
  const credentials = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS);
  return new textToSpeech.TextToSpeechClient({ credentials });
}

export async function generateAudio(narration) {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const client = buildClient();
  const outputPath = join(AUDIO_DIR, 'narration.mp3');

  console.log('  Generating voiceover...');

  const [response] = await client.synthesizeSpeech({
    input: { text: narration },
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Neural2-D',
      ssmlGender: 'MALE'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.15,
      pitch: -1.0,
      effectsProfileId: ['headphone-class-device']
    }
  });

  writeFileSync(outputPath, response.audioContent, 'binary');

  const duration = await getAudioDurationInSeconds(outputPath);
  console.log(`  Audio duration: ${duration.toFixed(1)}s`);

  return { file: outputPath, duration };
}

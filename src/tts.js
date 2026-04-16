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

export async function generateAudio(chapters) {
  mkdirSync(AUDIO_DIR, { recursive: true });

  const client = buildClient();
  const files = [];
  const durations = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const outputPath = join(AUDIO_DIR, `chapter_${i}.mp3`);

    console.log(`  Generating audio for chapter ${i + 1}/${chapters.length}: "${chapter.heading}"`);

    const [response] = await client.synthesizeSpeech({
      input: { text: chapter.narration },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D',  // Deep, authoritative male voice
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.1,    // Faster — brainrot energy
        pitch: -1.0,          // Slightly deep — ironic serious tone
        effectsProfileId: ['headphone-class-device']
      }
    });

    writeFileSync(outputPath, response.audioContent, 'binary');

    const duration = await getAudioDurationInSeconds(outputPath);
    files.push(outputPath);
    durations.push(duration);

    console.log(`    Duration: ${duration.toFixed(1)}s`);
  }

  const total = durations.reduce((a, b) => a + b, 0);
  console.log(`  Total audio duration: ${(total / 60).toFixed(1)} minutes`);

  return { files, durations };
}

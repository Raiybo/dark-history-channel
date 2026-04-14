import { google } from 'googleapis';
import { createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildYouTubeClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
  });

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

export async function uploadToYouTube(script, videoPath) {
  const youtube = buildYouTubeClient();
  const fileSize = statSync(videoPath).size;

  console.log(`  Uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB to YouTube...`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: script.title,
        description: script.description,
        tags: script.tags,
        categoryId: '27',  // Education
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en'
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
        madeForKids: false
      }
    },
    media: {
      mimeType: 'video/mp4',
      body: createReadStream(videoPath)
    }
  }, {
    onUploadProgress: (evt) => {
      const pct = Math.round((evt.bytesRead / fileSize) * 100);
      process.stdout.write(`\r  Upload progress: ${pct}%   `);
    }
  });

  process.stdout.write('\n');

  const videoId = response.data.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  return { id: videoId, url };
}

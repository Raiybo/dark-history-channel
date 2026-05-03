import 'dotenv/config';
import { google } from 'googleapis';

function buildYouTubeClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

async function getAllVideoIds(youtube) {
  // Get the channel's uploads playlist ID
  const channelRes = await youtube.channels.list({ part: ['contentDetails'], mine: true });
  const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

  const videoIds = [];
  let pageToken = undefined;

  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of res.data.items) {
      videoIds.push(item.contentDetails.videoId);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return videoIds;
}

async function run() {
  const youtube = buildYouTubeClient();

  console.log('Fetching all channel videos...');
  const videoIds = await getAllVideoIds(youtube);
  console.log(`Found ${videoIds.length} video(s).\n`);

  if (videoIds.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  for (const id of videoIds) {
    try {
      await youtube.videos.delete({ id });
      console.log(`  Deleted: https://www.youtube.com/watch?v=${id}`);
    } catch (err) {
      console.error(`  Failed to delete ${id}: ${err.message}`);
    }
  }

  console.log('\nDone. All videos deleted.');
}

run().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});

import { readFileSync, statSync } from 'fs';

// TikTok Content Posting API (v2). Mirrors uploader.js for YouTube.
//
// Requires (env / GitHub secrets):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
// Optional:
//   TIKTOK_MODE     — "inbox" (default): upload to the creator's TikTok Drafts
//                      (works with the video.upload scope, no audit needed).
//                     "direct": post directly to the profile — requires the
//                      video.publish scope, granted only after TikTok audits
//                      the app.
//   TIKTOK_PRIVACY  — only used in "direct" mode: SELF_ONLY (default) or
//                      PUBLIC_TO_EVERYONE (after audit).
//
// Flow: refresh access token -> init upload (inbox or direct) -> upload the
// file in chunks -> poll publish status.

const API = 'https://open.tiktokapis.com/v2';
const MAX_SINGLE = 64 * 1024 * 1024; // TikTok allows a single chunk up to 64 MB
const CHUNK = 10 * 1024 * 1024;      // 10 MB chunks for larger files

async function refreshAccessToken() {
  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function planChunks(size) {
  if (size <= MAX_SINGLE) return { chunkSize: size, count: 1 };
  let count = Math.floor(size / CHUNK);
  while (count > 1 && size - (count - 1) * CHUNK < 5 * 1024 * 1024) count--;
  return { chunkSize: CHUNK, count };
}

async function initUpload(accessToken, caption, size) {
  const mode = (process.env.TIKTOK_MODE || 'inbox').toLowerCase();
  const { chunkSize, count } = planChunks(size);
  const source_info = {
    source: 'FILE_UPLOAD',
    video_size: size,
    chunk_size: chunkSize,
    total_chunk_count: count,
  };

  // Direct Post (needs video.publish + audit) carries post_info; the draft/inbox
  // flow (video.upload) just delivers the file for the creator to finish.
  const endpoint = mode === 'direct'
    ? `${API}/post/publish/video/init/`
    : `${API}/post/publish/inbox/video/init/`;

  const body = mode === 'direct'
    ? {
        post_info: {
          title: caption,
          privacy_level: process.env.TIKTOK_PRIVACY || 'SELF_ONLY',
          disable_duet: false, disable_comment: false, disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info,
      }
    : { source_info };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.data?.upload_url) {
    throw new Error(`TikTok init failed (${mode}): ${JSON.stringify(data)}`);
  }
  return { uploadUrl: data.data.upload_url, publishId: data.data.publish_id, chunkSize, count, mode };
}

async function uploadChunks(uploadUrl, videoPath, size, chunkSize, count) {
  const buffer = readFileSync(videoPath);
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    const slice = buffer.subarray(start, end + 1);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(slice.length),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
      body: slice,
    });
    if (!res.ok && res.status !== 206 && res.status !== 201) {
      throw new Error(`TikTok chunk ${i + 1}/${count} failed: HTTP ${res.status}`);
    }
    process.stdout.write(`\r  TikTok upload: chunk ${i + 1}/${count}   `);
  }
  process.stdout.write('\n');
}

async function pollStatus(accessToken, publishId) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await fetch(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json();
    const status = data.data?.status;
    if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') return data.data;
    if (status === 'FAILED') throw new Error(`TikTok publish failed: ${JSON.stringify(data.data)}`);
  }
  return { status: 'PROCESSING' }; // accepted; still processing on TikTok's side
}

export async function uploadToTikTok(script, videoPath) {
  const size = statSync(videoPath).size;
  const caption = `${script.title}\n\n${script.description || ''}`.slice(0, 2200);

  console.log(`  Uploading ${(size / 1024 / 1024).toFixed(1)}MB to TikTok...`);
  const accessToken = await refreshAccessToken();
  const { uploadUrl, publishId, chunkSize, count, mode } = await initUpload(accessToken, caption, size);
  await uploadChunks(uploadUrl, videoPath, size, chunkSize, count);
  const result = await pollStatus(accessToken, publishId);

  return { publishId, status: result.status, mode };
}

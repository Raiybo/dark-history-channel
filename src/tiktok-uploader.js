import { readFileSync, statSync } from 'fs';

// TikTok Content Posting API (v2). Mirrors uploader.js for YouTube.
//
// Requires (set as env / GitHub secrets):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
// Optional:
//   TIKTOK_PRIVACY  — SELF_ONLY (default, works pre-audit) | PUBLIC_TO_EVERYONE
//                     (only after TikTok approves the app's video.publish audit)
//
// Flow: refresh access token -> init Direct Post upload -> upload file in
// chunks -> poll publish status.

const API = 'https://open.tiktokapis.com/v2';
const MAX_SINGLE = 64 * 1024 * 1024; // 64 MB: TikTok allows a single chunk up to this
const CHUNK = 10 * 1024 * 1024;      // 10 MB chunks when the file is larger

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

// TikTok needs every chunk between 5MB and 64MB (the last one may be larger as a
// remainder). For files <= 64MB we send one chunk; otherwise we split, folding a
// small trailing remainder into the final chunk.
function planChunks(size) {
  if (size <= MAX_SINGLE) return { chunkSize: size, count: 1 };
  let count = Math.floor(size / CHUNK);
  // ensure the final chunk (remainder) is >= 5MB by reducing count if needed
  while (count > 1 && size - (count - 1) * CHUNK < 5 * 1024 * 1024) count--;
  return { chunkSize: CHUNK, count };
}

async function initUpload(accessToken, caption, size) {
  const { chunkSize, count } = planChunks(size);
  const res = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: process.env.TIKTOK_PRIVACY || 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: count,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.data?.upload_url) {
    throw new Error(`TikTok init failed: ${JSON.stringify(data)}`);
  }
  return { uploadUrl: data.data.upload_url, publishId: data.data.publish_id, chunkSize, count };
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
      throw new Error(`TikTok chunk ${i + 1}/${count} upload failed: HTTP ${res.status}`);
    }
    process.stdout.write(`\r  TikTok upload: chunk ${i + 1}/${count}   `);
  }
  process.stdout.write('\n');
}

async function pollStatus(accessToken, publishId) {
  for (let i = 0; i < 30; i++) {
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
    if (status === 'PUBLISH_COMPLETE') return data.data;
    if (status === 'FAILED') throw new Error(`TikTok publish failed: ${JSON.stringify(data.data)}`);
  }
  // Not fatal — upload accepted, still processing on TikTok's side.
  return { status: 'PROCESSING' };
}

export async function uploadToTikTok(script, videoPath) {
  const size = statSync(videoPath).size;
  const caption = `${script.title}\n\n${script.description || ''}`.slice(0, 2200);

  console.log(`  Uploading ${(size / 1024 / 1024).toFixed(1)}MB to TikTok...`);
  const accessToken = await refreshAccessToken();
  const { uploadUrl, publishId, chunkSize, count } = await initUpload(accessToken, caption, size);
  await uploadChunks(uploadUrl, videoPath, size, chunkSize, count);
  const result = await pollStatus(accessToken, publishId);

  const privacy = process.env.TIKTOK_PRIVACY || 'SELF_ONLY';
  return { publishId, status: result.status, privacy };
}

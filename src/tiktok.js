// TikTok Content Posting API — "Upload to Inbox" (draft) flow.
//
// Sends the finished MP4 to the connected creator's TikTok INBOX as a DRAFT.
// You then open TikTok -> notifications/inbox, add your caption, and post it
// MANUALLY. There is deliberately NO auto-publish here.
//
// Configured via three secrets (from your TikTok for Developers app + the
// one-time `npm run get-tiktok-token` connect flow):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
//
// Everything is best-effort: callers guard it so a TikTok failure never blocks
// the YouTube pipeline.

import { statSync, readFileSync } from 'fs';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const INBOX_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

export function tiktokConfigured() {
  return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN);
}

// TikTok access tokens are short-lived (~24h), so we mint a fresh one from the
// long-lived refresh token on every run.
async function getAccessToken() {
  const body = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.access_token;
}

// Upload the finished MP4 to the creator's TikTok inbox as a draft. Single-chunk
// upload — our Shorts are comfortably under TikTok's 64MB single-chunk ceiling.
export async function sendDraftToTikTok(videoPath) {
  const size = statSync(videoPath).size;
  const accessToken = await getAccessToken();

  const initRes = await fetch(INBOX_INIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  });
  const initData = await initRes.json().catch(() => ({}));
  const uploadUrl = initData?.data?.upload_url;
  const publishId = initData?.data?.publish_id;
  if (!initRes.ok || !uploadUrl) {
    throw new Error(`TikTok inbox init failed: ${JSON.stringify(initData).slice(0, 300)}`);
  }

  const bytes = readFileSync(videoPath);
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`TikTok file upload failed: HTTP ${putRes.status}`);
  }
  return { publish_id: publishId };
}

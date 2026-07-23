import { google } from 'googleapis';
import { createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// High-reach evergreen hashtags appended to every reel. Topic-specific ones
// (from the script's tags) go FIRST so the 3 YouTube shows above the title are
// the most relevant. Kept well under YouTube's 15-hashtag limit (over 15 makes
// YouTube ignore ALL of them).
// #Shorts #Viral #Facts lead the evergreen set so every upload always carries
// the high-reach boost tags the channel relies on, followed by the niche-
// specific evergreens. Topic hashtags still go FIRST overall (above-title slots).
// Kevin MacLeod tracks (music.js) are CC BY 3.0 — attribution is required, so it
// goes in every description. Footage is Pexels/CC/public-domain (license-free).
const MUSIC_CREDIT = 'Music: Kevin MacLeod (incompetech.com), licensed under Creative Commons BY 3.0.';

// Per-genre evergreen tags. AI-tools content uses tech/productivity discovery
// hashtags; the original trivia format keeps the Did You Know / Fun Facts set.
const EVERGREEN_HASHTAGS_BY_GENRE = {
  aitools:    ['#Shorts', '#YouTubeShorts', '#AITools', '#TechHacks', '#Productivity', '#AI', '#ArtificialIntelligence', '#Tech', '#Startup', '#Founders'],
  didyouknow: ['#Shorts', '#YouTubeShorts', '#Viral', '#Facts', '#DidYouKnow', '#FunFacts', '#AmazingFacts', '#InterestingFacts', '#Trending'],
};
const EVERGREEN_TAGS_BY_GENRE = {
  aitools:    ['shorts', 'youtube shorts', 'ai tools', 'ai tools 2026', 'tech hacks', 'productivity', 'artificial intelligence', 'ai workflow', 'startup tools', 'ai for creators', 'chatgpt alternatives', 'ai apps', 'no code ai'],
  didyouknow: ['shorts', 'youtube shorts', 'viral', 'viral shorts', 'trending', 'facts', 'did you know', 'fun facts', 'amazing facts', 'interesting facts', 'educational', 'today i learned', 'knowledge', 'mind blowing facts'],
};
const EVERGREEN_HASHTAGS = EVERGREEN_HASHTAGS_BY_GENRE.didyouknow;
const EVERGREEN_TAGS = EVERGREEN_TAGS_BY_GENRE.didyouknow;

function toHashtag(s) {
  const camel = (s || '').replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return camel ? '#' + camel : '';
}

function buildHashtags(tags, genre = 'didyouknow') {
  // Up to 5 topic-specific hashtags lead for topical discovery (the first 3 show
  // above the title), then the high-reach evergreen discovery tags for THIS genre.
  // Capped at 14 because YouTube ignores ALL hashtags on a video that has more than 15.
  const evergreen = EVERGREEN_HASHTAGS_BY_GENRE[genre] || EVERGREEN_HASHTAGS_BY_GENRE.didyouknow;
  const topic = (tags || []).slice(0, 5).map(toHashtag).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const h of [...topic, ...evergreen]) {
    const k = h.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(h); }
  }
  return out.slice(0, 14).join(' ');
}

function buildTags(tags, genre = 'didyouknow') {
  const evergreen = EVERGREEN_TAGS_BY_GENRE[genre] || EVERGREEN_TAGS_BY_GENRE.didyouknow;
  const seen = new Set();
  const out = [];
  let total = 0;
  for (const t of [...(tags || []), ...evergreen]) {
    const clean = (t || '').trim();
    const k = clean.toLowerCase();
    if (!clean || seen.has(k)) continue;
    if (total + clean.length + 1 > 480) break; // YouTube tags cap ~500 chars
    seen.add(k); out.push(clean); total += clean.length + 1;
  }
  return out;
}

// Pull the last question out of the description as a fallback comment.
function extractQuestion(desc) {
  const m = (desc || '').match(/[^.?!]*\?/g);
  return m ? m[m.length - 1].trim() : '';
}

// Seed the comment section with a question FROM the channel right after upload.
// Comments are a strong Shorts ranking signal and an owner question pulls
// replies. Fully guarded: a failure (e.g. the token lacks the youtube.force-ssl
// scope) only logs — it never blocks the upload. NOTE: the Data API cannot PIN
// a comment, so pin it by hand if you want it stuck to the top.
async function postEngagementComment(youtube, videoId, script) {
  const text = (script.pinned_comment || '').trim()
    || extractQuestion(script.description)
    || 'Did this one surprise you? 👇';
  try {
    await youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } },
      },
    });
    console.log(`  Posted engagement comment: "${text}"`);
  } catch (err) {
    const msg = (err && err.message) || String(err);
    console.log(`  Skipped engagement comment (${msg.slice(0, 120)}). Needs the youtube.force-ssl scope — run: npm run get-token`);
  }
}

export function buildYouTubeClient() {
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
        description: `${buildHashtags(script.tags, script.genre)}\n\n${(script.description || '').trim()}${script.hasMusic ? '\n\n' + MUSIC_CREDIT : ''}`.trim(),
        tags: buildTags(script.tags, script.genre),
        // AI-tools content sits better under "Science & Technology" (28); the
        // rest of the channel keeps Education (27).
        categoryId: script.genre === 'aitools' ? '28' : '27',
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en'
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
        madeForKids: false,
        // Hide the extended public stats panel on the watch page. YouTube's
        // dedicated "don't show how many viewers like this video" toggle is
        // Studio-only and not in the API; this is the closest API equivalent.
        publicStatsViewable: false
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

  await postEngagementComment(youtube, videoId, script);

  // Hide the like count via Studio (the API can't do this). Best-effort: a
  // failure here MUST NOT block the upload from being marked successful.
  try {
    const { hideLikes } = await import('../scripts/hide-likes.js');
    await hideLikes(videoId);
  } catch (err) {
    console.log(`  hide-likes module unavailable: ${err.message}`);
  }

  return { id: videoId, url };
}

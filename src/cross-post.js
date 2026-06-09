import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'output', 'cross-post');

// Convert a topic-specific tag to a hashtag (#CamelCase).
function tag(s) {
  const camel = (s || '').replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return camel ? '#' + camel : '';
}

function buildTikTokCaption(script) {
  const topic = (script.tags || []).slice(0, 3).map(tag).filter(Boolean);
  const evergreen = ['#fyp', '#viral', '#facts', '#didyouknow', '#funfacts', '#mindblown'];
  const hashtags = [...new Set([...topic, ...evergreen])].slice(0, 10).join(' ');
  const teaser = (script.description || '').split(/[.?!]/)[0].trim();
  return `${script.title}\n\n${teaser}\n\n${hashtags}`;
}

function buildInstagramCaption(script) {
  const topic = (script.tags || []).slice(0, 3).map(tag).filter(Boolean);
  const evergreen = ['#reels', '#instagood', '#facts', '#didyouknow', '#funfacts', '#trivia', '#mindblown', '#learnonreels'];
  const hashtags = [...new Set([...topic, ...evergreen])].slice(0, 12).join(' ');
  return `${script.title}\n\n${(script.description || '').trim()}\n\n.\n.\n.\n${hashtags}`;
}

// r/todayilearned, r/Damnthatsinteresting, etc.: short post title + body with
// the YT link. TIL prefix is the dominant convention in r/todayilearned.
function buildRedditPost(script, url) {
  const sentences = (script.description || '').split(/(?<=[.?!])\s+/);
  const fact = sentences[0] || script.title;
  const tilTitle = `TIL ${fact.replace(/^(did you know|wow|so)[,!.\s]*/i, '').replace(/[.?!]+$/, '')}`;
  return `**Suggested title** (paste into Reddit "Title"):
${tilTitle}

**Suggested body** (paste into Reddit body):
${(script.description || '').trim()}

Source: ${url}

---
Good subreddits to try (rules vary, read each):
- r/todayilearned (requires verifiable source)
- r/Damnthatsinteresting
- r/interestingasfuck
- r/UpliftingNews (if it's positive)
`;
}

// Save the MP4 + caption files for the human to drag-drop into TikTok/Reels
// and copy-paste into Reddit. Best-effort: failure only logs.
export function saveCrossPostPack(script, videoPath, videoId, videoUrl) {
  try {
    const dir = join(OUT_DIR, videoId);
    mkdirSync(dir, { recursive: true });
    copyFileSync(videoPath, join(dir, 'video.mp4'));
    writeFileSync(join(dir, 'caption-tiktok.txt'),    buildTikTokCaption(script));
    writeFileSync(join(dir, 'caption-instagram.txt'), buildInstagramCaption(script));
    writeFileSync(join(dir, 'reddit.md'),             buildRedditPost(script, videoUrl));
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({
      videoId,
      url: videoUrl,
      title: script.title,
      topic: script.topic,
      hook: script.hook_text,
      tags: script.tags,
      date: new Date().toISOString(),
    }, null, 2));
    console.log(`  Cross-post pack saved -> output/cross-post/${videoId}/`);
  } catch (err) {
    console.log(`  Skipped cross-post pack (${(err.message || err).toString().slice(0, 120)})`);
  }
}

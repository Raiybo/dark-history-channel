import { statSync } from 'fs';

// Pre-upload safety net. Each check throws ChecklistFailure if its invariant
// is violated — that fails the run loudly (no upload of a bad reel) instead of
// silently publishing something broken. Each pass logs a green check so the
// GitHub Actions log shows the full checklist verdict per run.

export class ChecklistFailure extends Error {
  constructor(stage, msg) { super(`[${stage}] ${msg}`); this.stage = stage; }
}

const pass = (stage, msg) => console.log(`  ✓ [${stage}] ${msg}`);
const fail = (stage, msg) => { throw new ChecklistFailure(stage, msg); };

// 1) Topic — format
export function checkTopic(idea) {
  const t = (idea?.topic || '').trim();
  if (!t) fail('topic', 'Topic is empty');
  if (!/^top\s*(5|five)\b/i.test(t)) fail('topic', `Doesn't start with "Top 5": "${t}"`);
  const words = t.split(/\s+/).length;
  if (words > 14) fail('topic', `Too long (${words} words): "${t}"`);
  pass('topic', `"${t}"`);
}

// 2) Script — all the LLM-output invariants in one go
export function checkScript(script) {
  // Hook
  const hook = (script?.hook_text || '').trim();
  if (!hook) fail('script', 'Hook is empty');
  if (hook !== hook.toUpperCase()) fail('script', `Hook must be ALL CAPS: "${hook}"`);
  const hookWords = hook.split(/\s+/).filter(Boolean).length;
  if (hookWords > 13) fail('script', `Hook too long (${hookWords} words, max 13): "${hook}"`);
  if (hookWords < 4) fail('script', `Hook too short (${hookWords} words, min 4): "${hook}"`);

  // Narration
  const narr = (script?.narration || '').trim();
  if (!narr) fail('script', 'Narration is empty');
  const clean = narr.replace(/\s*\|\|\s*/g, ' ');
  const wc = clean.split(/\s+/).filter(Boolean).length;
  if (wc < 80 || wc > 150) fail('script', `Narration word count off (${wc}, expected 90-135)`);
  const beats = (narr.match(/\|\|/g) || []).length;
  if (beats < 4 || beats > 8) fail('script', `Beat marker count off (${beats}, expected 5-6 for a 5-item countdown)`);
  if (narr.startsWith('||') || narr.endsWith('||')) fail('script', 'Narration starts or ends with ||');

  // Title
  const title = (script?.title || '').trim();
  if (!title) fail('script', 'Title empty');
  if (title.length > 60) fail('script', `Title too long (${title.length} chars, max 50-60): "${title}"`);

  // Tags
  const tags = script?.tags || [];
  if (tags.length < 4 || tags.length > 12) fail('script', `Tag count off (${tags.length}, expected 5-8)`);

  // Scenes — count + DISTINCT keywords (no two scenes asking for the same footage)
  const scenes = script?.scenes || [];
  if (scenes.length !== 5) fail('script', `Scene count must be 5 (one per countdown item), got ${scenes.length}`);
  const keys = scenes.map(s => (s?.keyword || '').trim().toLowerCase());
  if (keys.some(k => !k)) fail('script', 'Empty scene keyword');
  if (new Set(keys).size !== keys.length) {
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    fail('script', `Duplicate scene keywords: ${[...new Set(dupes)].join(', ')}`);
  }

  pass('script', `hook ${hookWords}w, narration ${wc}w with ${beats} beats, ${scenes.length} distinct scenes, title ${title.length}ch, ${tags.length} tags`);
}

// 3) Footage — all clips fetched + NO duplicate clips in the same reel
export function checkClips(clips) {
  const arr = clips || [];
  if (arr.length === 0) fail('footage', 'No clips fetched');
  const nulls = arr.filter(c => !c).length;
  if (nulls > 0) fail('footage', `${nulls} of ${arr.length} clip slots are empty (download failed)`);
  // Each entry is a relative path like 'videos/clip_3.mp4'. Even those should
  // be distinct (different files) — but the real dedup happens in pexels.js
  // (by SOURCE URL). This catches anything that slipped through.
  if (new Set(arr).size !== arr.length) {
    fail('footage', `Duplicate clip file paths detected: ${arr.join(', ')}`);
  }
  pass('footage', `${arr.length} unique clips, none missing`);
}

// 4) Audio — sane duration + word timings that span the full track
export function checkAudio(audio) {
  const dur = audio?.duration;
  if (!dur || dur < 28 || dur > 72) fail('audio', `Duration out of range (${dur?.toFixed?.(1)}s, expected 35-65 for a 5-item countdown)`);
  const wt = audio?.wordTimings || [];
  if (wt.length < 30) fail('audio', `Too few word timings (${wt.length}) — captions will be sparse`);
  const lastEnd = wt[wt.length - 1]?.end ?? 0;
  if (lastEnd < dur * 0.6) {
    fail('audio', `Word timings end at ${lastEnd.toFixed(1)}s but audio is ${dur.toFixed(1)}s — captions will desync (probably a VTT parse issue)`);
  }
  const beats = audio?.beats || [];
  if (beats.length === 0) fail('audio', 'No audio beats produced');
  pass('audio', `${dur.toFixed(1)}s, ${wt.length} word timings, ${beats.length} beats`);
}

// 5) Render — output sane size
export function checkRender(videoPath) {
  let st;
  try { st = statSync(videoPath); } catch { fail('render', `Output file not found: ${videoPath}`); }
  const mb = st.size / (1024 * 1024);
  if (mb < 5 || mb > 120) fail('render', `Output size suspicious (${mb.toFixed(1)}MB, expected 15-80)`);
  pass('render', `${mb.toFixed(1)}MB`);
}

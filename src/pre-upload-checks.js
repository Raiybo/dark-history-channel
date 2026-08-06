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
  if (wc < 62 || wc > 175) fail('script', `Narration word count off (${wc}, aim 100-130; tolerant band 62-175 for Groq's variance)`);
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
  if (!dur || dur < 24 || dur > 82) fail('audio', `Duration out of range (${dur?.toFixed?.(1)}s, expected 35-65 for a 5-item countdown)`);
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

// Kings of Ranks (silent) — a FUNNY "Top 5" comedy ranking: 5 funny moments,
// no narration. Enforces exactly 5 ranked items in countdown order, a distinct
// funny caption (the joke) on every item, and distinct stock keywords (so no
// two ranks reuse the same clip).
export function checkKingsRanks(content) {
  if (!content) fail('script', 'Kings content is null');
  if (!/^top\s*(5|five)\b/i.test((content.title || '').trim())) fail('script', `Title not "Top 5": "${content.title}"`);
  const items = content.items || [];
  if (items.length !== 5) fail('script', `Need 5 items, got ${items.length}`);

  // Ranks 1-5 exactly, and the array is in countdown display order (#5 -> #1).
  const ranks = items.map(i => i.rank);
  if ([...ranks].sort((a, b) => a - b).join(',') !== '1,2,3,4,5') fail('script', `Ranks must be exactly 1-5, got ${ranks.join(',')}`);
  if (ranks.join(',') !== '5,4,3,2,1') fail('script', `Items must be ordered #5 -> #1 for the countdown, got ${ranks.join(',')}`);

  if (items.some(i => !((i.label || '').trim()))) fail('script', 'An item has no label');

  // A funny caption (the joke) on every item, and no two identical (a dup caption
  // is the tell of a nouns-swapped template).
  const caps = items.map(i => (i.caption || '').trim().toLowerCase());
  if (caps.some(c => c.length < 3)) fail('script', 'An item is missing its funny caption');
  if (new Set(caps).size !== 5) fail('script', 'Duplicate captions — the jokes are not distinct per item');

  const kws = items.map(i => (i.keyword || '').trim().toLowerCase());
  if (kws.some(k => !k)) fail('script', 'An item has no keyword');
  if (new Set(kws).size !== 5) fail('script', 'Duplicate item keywords');
  if (!(content.title_card || '').trim()) fail('script', 'title_card missing');
  pass('script', `5 funny ranked items — "${content.title.slice(0, 45)}"`);
}

// "Have you ever thought that…" comparison — two contenders, a true winner, and
// an interesting answer. Enforces both contenders complete, distinct keywords,
// a valid winner, and a non-empty payoff answer.
export function checkVersus(content) {
  if (!content) fail('script', 'Versus content is null');
  if (!(content.question || '').trim()) fail('script', 'Question missing');
  const a = content.a || {}, b = content.b || {};
  if (!(a.name || '').trim() || !(b.name || '').trim()) fail('script', 'A contender has no name');
  const ak = (a.keyword || '').trim().toLowerCase(), bk = (b.keyword || '').trim().toLowerCase();
  if (!ak || !bk) fail('script', 'A contender has no keyword');
  if (ak === bk) fail('script', 'Both contenders share a keyword (clips would be identical)');
  if (content.winner !== 'a' && content.winner !== 'b') fail('script', `Winner must be 'a' or 'b', got "${content.winner}"`);
  if (!(content.answer || '').trim()) fail('script', 'Answer (the payoff) is missing');
  if (!(content.title || '').trim()) fail('script', 'Title missing');
  pass('script', `versus: ${a.name} vs ${b.name} → ${content.winner === 'b' ? b.name : a.name}`);
}

// AI-Tools-specific script check. Different invariants from the Top-5 format
// so we don't share checkScript — the hook shape, scene count, and narration
// length all move.
export function checkAiToolsScript(content) {
  if (!content) fail('script', 'AI-tools content is null');
  const hook = (content.hook_text || '').trim();
  if (!hook) fail('script', 'Hook is empty');
  if (hook !== hook.toUpperCase()) fail('script', `Hook must be ALL CAPS: "${hook}"`);
  const hookWords = hook.split(/\s+/).filter(Boolean).length;
  if (hookWords > 12 || hookWords < 4) fail('script', `Hook length off (${hookWords} words, expected 5-9)`);

  const narr = (content.narration || '').trim();
  if (!narr) fail('script', 'Narration empty');
  const clean = narr.replace(/\s*\|\|\s*/g, ' ');
  const wc = clean.split(/\s+/).filter(Boolean).length;
  // Spec target 105-125; tolerant band 85-160 for LLM variance.
  if (wc < 85 || wc > 160) fail('script', `Narration word count off (${wc}, target 100-130)`);
  const beats = (narr.match(/\|\|/g) || []).length;
  if (beats < 3 || beats > 7) fail('script', `Beat marker count off (${beats}, expected 4-6)`);

  const title = (content.title || '').trim();
  if (!title) fail('script', 'Title empty');
  if (title.length > 90) fail('script', `Title too long (${title.length} chars, max 90)`);

  const scenes = content.scenes || [];
  if (scenes.length < 3 || scenes.length > 5) fail('script', `Scene count off (${scenes.length}, expected 4)`);
  // Every scene URL must be reachable — screenshot fetcher will confirm at fetch time.
  // Here we just enforce it's a valid URL string.
  for (const [i, s] of scenes.entries()) {
    if (!s?.url || !/^https?:\/\//i.test(s.url)) fail('script', `Scene ${i + 1} has no valid URL`);
  }
  if (!content.tracking_slug) fail('script', 'tracking_slug missing (needed for 90-day cooldown)');
  if (!content.tool_name) fail('script', 'tool_name missing');

  pass('script', `hook ${hookWords}w, narration ${wc}w with ${beats} beats, ${scenes.length} scenes, tool "${content.tool_name}"`);
}

// Consumer Awareness script check — the new Split-Sludge format.
// 4 top-half scenes (real UI screencasts), 100-125 spoken words, 35-45s target.
// Every script MUST have a primary source URL — the grounding is what makes
// this niche safe under YouTube's July 2025 "inauthentic content" policy.
export function checkConsumerScript(content) {
  if (!content) fail('script', 'Consumer content is null');

  if (!content.sourceUrl || !/^https?:\/\//i.test(content.sourceUrl)) {
    fail('script', 'sourceUrl missing or invalid — RAG grounding required for this genre');
  }
  if (!content.sourceAuthority) fail('script', 'sourceAuthority missing');

  const hook = (content.hook_text || '').trim();
  if (!hook) fail('script', 'Hook empty');
  if (hook !== hook.toUpperCase()) fail('script', `Hook must be ALL CAPS: "${hook}"`);
  const hookWords = hook.split(/\s+/).filter(Boolean).length;
  if (hookWords > 12 || hookWords < 4) fail('script', `Hook length off (${hookWords} words, expected 5-9)`);

  const narr = (content.narration || '').trim();
  if (!narr) fail('script', 'Narration empty');
  const clean = narr.replace(/\s*\|\|\s*/g, ' ');
  const wc = clean.split(/\s+/).filter(Boolean).length;
  if (wc < 85 || wc > 160) fail('script', `Narration word count off (${wc}, target 100-125)`);
  const beats = (narr.match(/\|\|/g) || []).length;
  if (beats < 3 || beats > 7) fail('script', `Beat marker count off (${beats}, expected 4-6)`);

  const title = (content.title || '').trim();
  if (!title) fail('script', 'Title empty');
  if (title.length > 90) fail('script', `Title too long (${title.length} chars, max 90)`);

  const scenes = content.top_scenes || [];
  if (scenes.length < 3 || scenes.length > 5) fail('script', `top_scenes count off (${scenes.length}, expected 4)`);
  for (const [i, s] of scenes.entries()) {
    if (!s?.url || !/^https?:\/\//i.test(s.url)) fail('script', `Scene ${i + 1} has no valid URL`);
  }

  pass('script', `hook ${hookWords}w, narration ${wc}w with ${beats} beats, ${scenes.length} screencast scenes, sourced from ${content.sourceAuthority}`);
}

// Ranking Game script check. 5 ranked clips each with search_keywords +
// text_overlay + narration + placeholder attribution_handle (ignored at
// render — we use "Stock: Pexels" instead).
export function checkRankingGame(content) {
  if (!content) fail('script', 'Ranking Game content is null');

  if (!content.title || !content.title.trim()) fail('script', 'Title empty');
  if (content.title.length > 90) fail('script', `Title too long (${content.title.length} chars)`);

  const hook = (content.hook_text || '').trim();
  if (!hook) fail('script', 'Hook empty');

  const clips = content.clips || [];
  if (clips.length !== 5) fail('script', `Clip count must be 5, got ${clips.length}`);
  const kws = clips.map(c => (c.search_keywords || '').toLowerCase().trim());
  if (kws.some(k => !k)) fail('script', 'Empty search_keywords on a clip');
  if (new Set(kws).size !== kws.length) {
    fail('script', `Duplicate search_keywords across ranks: ${kws.join(' | ')}`);
  }
  // Ranks must be 5,4,3,2,1 (display / reveal order)
  const expectedRanks = [5, 4, 3, 2, 1];
  for (const [i, c] of clips.entries()) {
    if (c.rank !== expectedRanks[i]) {
      fail('script', `Rank order wrong at slot ${i}: expected ${expectedRanks[i]}, got ${c.rank}`);
    }
    if (!c.text_overlay || !c.text_overlay.trim()) {
      fail('script', `Missing text_overlay on rank ${c.rank}`);
    }
  }

  const narr = (content.narration || '').trim();
  const clean = narr.replace(/\s*\|\|\s*/g, ' ');
  const wc = clean.split(/\s+/).filter(Boolean).length;
  // Target 120-150 for a 50s video, but LLM output drifts ±30% so we absorb
  // 90-220. The composition auto-fits duration to audio length (Math.ceil((audio+1)*fps)),
  // so a 60-70s render is still shippable — the algorithm caps Shorts at 60s
  // but longer voiceovers still upload and play back fine.
  if (wc < 90 || wc > 220) fail('script', `Narration word count off (${wc}, target 120-150 for a 50s video, tolerant 90-220)`);

  pass('script', `hook ${hook.split(/\s+/).length}w, narration ${wc}w, 5 clips ranked 5→1 with distinct keywords`);
}

// 5) Render — output sane size
export function checkRender(videoPath) {
  let st;
  try { st = statSync(videoPath); } catch { fail('render', `Output file not found: ${videoPath}`); }
  const mb = st.size / (1024 * 1024);
  if (mb < 5 || mb > 120) fail('render', `Output size suspicious (${mb.toFixed(1)}MB, expected 15-80)`);
  pass('render', `${mb.toFixed(1)}MB`);
}

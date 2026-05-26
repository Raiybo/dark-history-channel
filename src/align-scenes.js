// Aligns each scene's footage to the real moment its narration is spoken.
//
// The captions already run on edge-TTS's per-word timestamps (wordTimings).
// We reuse that exact clock here so the footage cuts land on the same words
// the viewer is hearing and reading — voice, captions, and video stay locked.

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Find the first index >= `from` where `probe` appears as a consecutive run.
function findRun(words, probe, from) {
  if (probe.length === 0) return -1;
  for (let j = from; j <= words.length - probe.length; j++) {
    let ok = true;
    for (let k = 0; k < probe.length; k++) {
      if (words[j + k] !== probe[k]) { ok = false; break; }
    }
    if (ok) return j;
  }
  return -1;
}

// Returns an array of scene start times in SECONDS, one per scene.
export function computeSceneStarts(scenes, wordTimings, totalDuration) {
  const sc = scenes || [];
  if (sc.length === 0) return [];

  // No real word timing → fall back to proportional split by guessed durations.
  if (!wordTimings || wordTimings.length === 0) {
    const total = sc.reduce((s, x) => s + (x.duration || 4), 0) || sc.length;
    let cursor = 0;
    return sc.map((x) => {
      const start = (cursor / total) * totalDuration;
      cursor += x.duration || 4;
      return start;
    });
  }

  const words = wordTimings.map((w) => tokenize(w.word)[0] || '');
  const starts = [];
  let searchFrom = 0;

  for (let i = 0; i < sc.length; i++) {
    if (i === 0) { starts.push(0); continue; }

    const moment = tokenize(sc[i].narration_moment);
    // Try a 4-word fingerprint, then a 2-word one, searching forward only.
    let idx = findRun(words, moment.slice(0, 4), searchFrom);
    if (idx === -1) idx = findRun(words, moment.slice(0, 2), searchFrom);

    if (idx === -1) {
      // No match — distribute proportionally as a safe fallback.
      starts.push((i / sc.length) * totalDuration);
      continue;
    }

    starts.push(wordTimings[idx].start);
    searchFrom = idx + 1;
  }

  // Guarantee strictly increasing, in-bounds starts.
  for (let i = 1; i < starts.length; i++) {
    if (!(starts[i] > starts[i - 1])) {
      starts[i] = Math.min(starts[i - 1] + 0.4, totalDuration);
    }
  }

  return starts;
}

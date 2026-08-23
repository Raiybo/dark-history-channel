import { chat } from '../llm.js';

// Voice for the Clip Ranks narrator — a natural, upbeat commentator that reacts
// to each clip. Same neural voice family the ranking-game uses (proven in CI),
// nudged a touch faster for comedic energy.
export const CLIPRANKS_VOICE = {
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+8%',
  pitch: '+0Hz',
};

// Turn a set of clips the creator ALREADY HAS (their own Flow/Veo output or
// licensed clips) into a "Top N funniest" ranked countdown WITH A NARRATOR. The
// LLM can't see the clips, so it works from each clip's short description (its
// filename) — name your files descriptively, e.g. "cat-attacks-curtain.mp4". It
// ranks them funniest→least and, for each, writes:
//   • label   — a 2-4 word on-screen name for the leaderboard row
//   • caption — a tiny on-screen tag (kept for fallback/silent mode)
//   • line    — the NARRATOR's spoken commentary for that scene (the joke)
// plus a spoken `hook` (opener) and `outro` (closer). Returns items in DISPLAY
// order (#N first … #1 last) with a 0-based `srcIndex` back to the input clip.
// Deterministic fallback if the LLM is down.
export async function generateClipRanks(descriptions) {
  const n = descriptions.length;
  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');

  const prompt = `A creator has ${n} short clips (ANY topic — animals, people, sports, food, fails, oddly satisfying, whatever) for a "Top ${n}" ranked countdown Shorts video WITH A NARRATOR who reacts to each clip out loud. Each description says what actually happens in that clip:
${list}

Rank them #1 (most entertaining / funniest / most jaw-dropping) down. For EACH clip write the narrator's spoken commentary that captures the ACTUAL plot or funny moment of THAT clip — a punchy comedic-commentator voice: react to what's happening, the subject's inner monologue, or a relatable human parallel. Deadpan and short. Adapt to whatever the clip is (don't assume it's about pets). Wholesome only. Examples of the vibe: "Number five thinks gravity is optional. It is not." / "He planned this for weeks. Respect." / "She had no idea the camera was on."

Return ONLY valid JSON, no markdown:
{
  "title": "funny YouTube title under 50 chars, starts with 'Top ${n}'",
  "title_card": "opening card, ALL CAPS, 3-6 plain words",
  "hook": "the narrator's spoken opener, ONE punchy sentence that teases the countdown (8-16 words). No emojis.",
  "items": [
    {"clip": <the clip NUMBER above>, "label": "2-4 word funny name", "caption": "tiny on-screen tag under 30 chars", "line": "the narrator's spoken commentary for THIS clip, 6-16 words, the joke"}
    // exactly ${n} items, ordered from the LEAST funny (shown FIRST) up to the FUNNIEST (#1, shown LAST)
  ],
  "outro": "the narrator's spoken closer, ONE short sentence that ENDS with the exact words 'make sure to subscribe' (6-14 words). No emojis.",
  "tags": ["6 funny tags"],
  "description": "2 fun sentences, counting down to the funniest, ending with a question. No hashtags.",
  "pinned_comment": "one short funny question ending with 👇"
}
Rules: use EACH clip number exactly once. Every "line" DIFFERENT. No " || " anywhere. Wholesome only.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.9, maxTokens: 4096, json: true });
      try { obj = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    } catch (err) {
      console.log(`  ClipRanks attempt ${attempt + 1} failed (${(err.message || '').slice(0, 80)}); retrying...`);
      continue;
    }
    if (!obj || !Array.isArray(obj.items)) { console.log('  ClipRanks: no items; retrying...'); continue; }

    // Map each item to a 0-based source index; keep only valid, unique clips.
    const seen = new Set();
    const clean = (s, max) => String(s || '').replace(/\|\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    let items = obj.items
      .map(it => ({
        srcIndex: (Number(it.clip) || 0) - 1,
        label: clean(it.label, 40),
        caption: clean(it.caption, 34),
        line: clean(it.line, 120),
      }))
      .filter(it => it.srcIndex >= 0 && it.srcIndex < n && it.label && it.line && !seen.has(it.srcIndex) && seen.add(it.srcIndex));
    if (items.length !== n) { console.log(`  ClipRanks: ${items.length}/${n} valid items; retrying...`); continue; }

    return {
      title: (obj.title || `Top ${n} Funniest`).slice(0, 90),
      title_card: (obj.title_card || `TOP ${n} FUNNIEST`).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
      hook: clean(obj.hook, 140) || `Here are the top ${n} funniest clips you'll see today.`,
      outro: clean(obj.outro, 120) || 'Subscribe for a new ranking every single day.',
      items,
      tags: (obj.tags || []).slice(0, 8),
      description: (obj.description || '').trim(),
      pinned_comment: (obj.pinned_comment || 'Which one got you? 👇').trim(),
    };
  }

  // Deterministic fallback: keep file order, generic spoken lines from descriptions.
  // `usedFallback` lets the pipeline REFUSE to upload — the labels here are raw
  // descriptions/filenames, not real jokes, so a fallback reel must never post.
  return {
    usedFallback: true,
    title: `Top ${n} Funniest Moments`,
    title_card: `TOP ${n} FUNNIEST`,
    hook: `Here are the top ${n} funniest clips, counting down to number one.`,
    outro: 'Subscribe for a new ranking every single day.',
    items: descriptions.map((d, i) => ({ srcIndex: i, label: d.slice(0, 40), caption: '', line: `Number ${n - i}. ${d}.`.slice(0, 120) })),
    tags: ['funny', 'top 5', 'ranked'],
    description: 'Ranking the funniest moments from 5 to 1. Which one wins?',
    pinned_comment: 'Which one got you? 👇',
  };
}

import { chat } from '../llm.js';

// Turn a set of clips the creator ALREADY HAS (their own Flow/Veo output or
// licensed clips) into a "Top N funniest" ranked countdown. The LLM can't see
// the clips, so it works from each clip's short description (its filename) —
// name your files descriptively, e.g. "cat-attacks-curtain.mp4". It ranks them
// funniest→least and writes a punchy caption for each. Returns content whose
// items are in DISPLAY order (#N first … #1 last) with a 0-based `srcIndex`
// pointing back to the input clip. Deterministic fallback if the LLM is down.
export async function generateClipRanks(descriptions) {
  const n = descriptions.length;
  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');

  const prompt = `A creator has ${n} short FUNNY clips for a "Top ${n}" ranked countdown Shorts video. Here they are (number + short description):
${list}

Rank them from FUNNIEST (#1) down, and write a punchy caption for each — the JOKE, in the winning animal-Shorts voice: the subject's inner monologue or a relatable human parallel, deadpan and short (e.g. "Gravity was not consulted.", "He planned this. For weeks."). SIMPLE, wholesome, never just a description.

Return ONLY valid JSON, no markdown:
{
  "title": "funny YouTube title under 50 chars, starts with 'Top ${n}'",
  "title_card": "opening card, ALL CAPS, 3-6 plain words",
  "items": [
    {"clip": <the clip NUMBER above>, "label": "2-4 word funny name", "caption": "the joke, under 38 chars"}
    // exactly ${n} items, ordered from the LEAST funny (shown FIRST) up to the FUNNIEST (#1, shown LAST)
  ],
  "tags": ["6 funny tags"],
  "description": "2 fun sentences, counting down to the funniest, ending with a question. No hashtags.",
  "pinned_comment": "one short funny question ending with 👇"
}
Rules: use EACH clip number exactly once. Captions all DIFFERENT. Wholesome only.`;

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
    let items = obj.items
      .map(it => ({ srcIndex: (Number(it.clip) || 0) - 1, label: String(it.label || '').trim().slice(0, 40), caption: String(it.caption || '').trim().slice(0, 44) }))
      .filter(it => it.srcIndex >= 0 && it.srcIndex < n && it.label && !seen.has(it.srcIndex) && seen.add(it.srcIndex));
    if (items.length !== n) { console.log(`  ClipRanks: ${items.length}/${n} valid items; retrying...`); continue; }

    return {
      title: (obj.title || `Top ${n} Funniest`).slice(0, 90),
      title_card: (obj.title_card || `TOP ${n} FUNNIEST`).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
      items,
      tags: (obj.tags || []).slice(0, 8),
      description: (obj.description || '').trim(),
      pinned_comment: (obj.pinned_comment || 'Which one got you? 👇').trim(),
    };
  }

  // Deterministic fallback: keep file order, generic captions from descriptions.
  return {
    title: `Top ${n} Funniest Moments`,
    title_card: `TOP ${n} FUNNIEST`,
    items: descriptions.map((d, i) => ({ srcIndex: i, label: d.slice(0, 40), caption: '' })),
    tags: ['funny', 'top 5', 'ranked'],
    description: 'Ranking the funniest moments from 5 to 1. Which one wins?',
    pinned_comment: 'Which one got you? 👇',
  };
}

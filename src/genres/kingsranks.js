import { chat } from '../llm.js';

// Kings of Ranks — HUMAN-MADE EXTREMES scored on the signature "OVERKILL INDEX".
// Given an already-deduped "Top 5 ..." theme, produce the STRUCTURED ranking:
// 5 real machines/structures/vehicles, each with an Overkill Index score (0-100),
// a short LABEL, an ORIGINAL one-line VERDICT (the judgment that makes the video
// non-generic — not a description of the footage), and a GENERIC legal stock
// keyword (+ one fallback). Ranked by score; the on-screen score + verdict carry
// the info (no voiceover). Returns null on failure (caller retries / fails loud).
//
// The Overkill Index = how absurdly far past what was necessary or normal a thing
// was pushed. It is the channel's owned scale and the recurring hook: the biggest
// or most famous entry is NOT automatically #1 — the most gratuitously over-built
// one is. That non-obvious ordering is what earns the watch.
export async function generateKingsItems(topic) {
  const prompt = `You produce ONE episode of a faceless YouTube Shorts channel that ranks HUMAN-MADE EXTREMES (machines, vehicles, engines, aircraft, ships, rockets, megastructures, bridges, tunnels) on a single owned scale: the OVERKILL INDEX (0-100) — how absurdly far past what was necessary or normal the thing was pushed.

THEME: "${topic}"

Pick 5 REAL, TRUE, famous-enough examples that fit the theme. Score each 80-99 on the Overkill Index. The most gratuitously over-built one gets the HIGHEST score and becomes #1 — this is NOT always the biggest or most famous; the surprising ordering is the whole point.

Return ONLY valid JSON, no markdown:
{
  "title": "YouTube title under 55 chars, starts with 'Top 5', curiosity gap, no lie",
  "title_card": "opening card, ALL CAPS, 3-6 words (e.g. 'TOP 5 IMPOSSIBLE MACHINES')",
  "items": [
    {"score": 99, "label": "specific real name, 1-3 words", "verdict": "sharp ORIGINAL judgment, under 42 chars, a TAKE not a description", "keyword": "2-4 word GENERIC stock VIDEO query — no brand/model names", "keyword_alt": "different generic fallback query"}
    // exactly 5 objects; scores DISTINCT and DESCENDING is not required here — just score each honestly, we sort.
  ],
  "tags": ["6 tags specific to the subject, most specific first"],
  "description": "2 hype sentences that mention the video ranks these on the Overkill Index, ending with a question. No hashtags.",
  "pinned_comment": "one short question about the ranking ending with 👇"
}

Rules:
- Every item is a REAL thing humans actually built. No made-up entries.
- The VERDICT must add judgment/context a viewer could NOT get from the raw footage — an opinion, a comparison, a 'why this is insane' line. If a verdict would fit any other item with the nouns swapped, rewrite it.
- LABEL may name the specific machine/structure. KEYWORD must stay GENERIC and brand-free (e.g. 'giant cargo plane', 'open pit mine', 'suspension bridge', 'rocket launch') so the stock footage is license-free and carries no logos.
- Every keyword AND keyword_alt DISTINCT across items. No two items about the same object.
- NO politics, war/weapons glorification, disasters, tragedy, or health claims. Pure engineering awe.`;

  // Retry — Groq (Gemini is billing-blocked) occasionally truncates or returns a
  // slightly-off shape; one bad attempt must not kill the run. 4096 tokens leaves
  // headroom so the JSON is never cut mid-array.
  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.85, maxTokens: 4096, json: true });
      try { obj = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    } catch (err) {
      console.log(`  Kings items attempt ${attempt + 1} failed (${(err.message || '').slice(0, 80)}); retrying...`);
      continue;
    }
    if (!obj || !Array.isArray(obj.items)) { console.log(`  Kings items: no items array; retrying...`); continue; }

    let items = obj.items
      .filter(it => it && it.label && it.keyword)
      .map(it => ({
        score: Math.max(1, Math.min(100, Math.round(Number(it.score)) || 0)),
        label: String(it.label).trim().slice(0, 40),
        verdict: String(it.verdict || it.caption || '').trim().slice(0, 48),
        keyword: String(it.keyword).trim().slice(0, 60),
        keyword_alt: String(it.keyword_alt || '').trim().slice(0, 60),
      }));

    // Rank by Overkill Index (highest = #1), then force STRICTLY DESCENDING
    // DISTINCT scores so the count-up graphic always reads cleanly.
    items.sort((a, b) => b.score - a.score);
    items = items.slice(0, 5);
    if (items.length !== 5) { console.log(`  Kings items: got ${items.length}/5 valid; retrying...`); continue; }
    for (let i = 1; i < items.length; i++) {
      if (items[i].score >= items[i - 1].score) items[i].score = items[i - 1].score - 1;
    }
    if (items[items.length - 1].score < 1) { console.log(`  Kings items: score spread collapsed; retrying...`); continue; }
    items = items.map((it, i) => ({ ...it, rank: i + 1 })); // items[0] = rank 1 (best)

    // Display order for the countdown reveal: #5 first ... #1 (climax) last.
    items.reverse();

    // Force distinct keywords (dupes make the footage fetch reuse a clip): try
    // each item's own fallback first, then suffix the label — never fail the run.
    const seen = new Set();
    items = items.map(it => {
      let kw = it.keyword;
      if (seen.has(kw.toLowerCase())) kw = it.keyword_alt && !seen.has(it.keyword_alt.toLowerCase()) ? it.keyword_alt : `${it.keyword} ${it.label}`.slice(0, 60);
      seen.add(kw.toLowerCase());
      return { ...it, keyword: kw };
    });

    return {
      title: (obj.title || topic).slice(0, 90),
      title_card: (obj.title_card || topic).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
      items,
      tags: (obj.tags || []).slice(0, 8),
      description: (obj.description || '').trim(),
      pinned_comment: (obj.pinned_comment || 'Which one deserves the #1 Overkill Index? 👇').trim(),
    };
  }
  return null;
}

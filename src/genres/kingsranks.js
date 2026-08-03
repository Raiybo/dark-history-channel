import { chat } from '../llm.js';

// Given an already-deduped "Top 5 ..." topic, produce the STRUCTURED ranking:
// 5 items (rank 5 -> 1), each with a short LABEL, a punchy CAPTION, and a
// generic Pexels keyword. No narration — the on-screen captions carry the info.
// Returns null on failure (caller falls back / retries).
export async function generateKingsItems(topic) {
  const prompt = `Build a "Top 5" ranking video from this theme: "${topic}"

Rank 5 REAL, TRUE, VISUAL things on the theme, counting DOWN from number 5 to number 1 (number 1 = the single most impressive/surprising). Every item must be a concrete thing we can show with generic stock footage.

Return ONLY valid JSON, no markdown:
{
  "title": "YouTube title under 60 chars, starts with 'Top 5', keyword-rich",
  "title_card": "opening on-screen card, ALL CAPS, 3-6 words (e.g. 'TOP 5 FASTEST ANIMALS')",
  "items": [
    {"rank": 5, "label": "item name, 1-3 words", "caption": "one punchy stat or fact, under 24 chars", "keyword": "2-4 word Pexels VIDEO query, generic, no named people or brands"},
    {"rank": 4, "label": "...", "caption": "...", "keyword": "..."},
    {"rank": 3, "label": "...", "caption": "...", "keyword": "..."},
    {"rank": 2, "label": "...", "caption": "...", "keyword": "..."},
    {"rank": 1, "label": "...", "caption": "...", "keyword": "..."}
  ],
  "tags": ["5-7 tags specific to the subject, most specific first"],
  "description": "2 hype sentences ending with a question. No hashtags.",
  "pinned_comment": "one short question ending with 👇"
}
Rules: items MUST be ordered 5,4,3,2,1. Every label AND every keyword DISTINCT. NO politics, tragedy, disaster, or health/medical claims. Keywords are GENERIC stock queries (an animal, object, place, machine) — never a named person or brand.`;

  // Retry — Groq (Gemini is billing-blocked) occasionally truncates or returns
  // a slightly-off shape; one bad attempt must not kill the run. 4096 tokens
  // leaves headroom so the JSON is never cut off mid-array.
  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.8, maxTokens: 4096, json: true });
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
        rank: Number(it.rank) || 0,
        label: String(it.label).trim().slice(0, 40),
        caption: String(it.caption || '').trim().slice(0, 30),
        keyword: String(it.keyword).trim().slice(0, 60),
      }));
    if (items.every(it => it.rank >= 1 && it.rank <= 5)) items.sort((a, b) => b.rank - a.rank);
    items = items.slice(0, 5).map((it, i) => ({ ...it, rank: 5 - i }));
    if (items.length !== 5) { console.log(`  Kings items: got ${items.length}/5 valid; retrying...`); continue; }

    // Force distinct keywords (dupes make the footage fetch skip a clip) by
    // suffixing the label onto any repeat rather than failing the whole run.
    const seen = new Set();
    items = items.map(it => {
      let k = it.keyword.toLowerCase();
      if (seen.has(k)) it = { ...it, keyword: `${it.keyword} ${it.label}`.slice(0, 60) };
      seen.add(it.keyword.toLowerCase());
      return it;
    });

    return {
      title: (obj.title || topic).slice(0, 90),
      title_card: (obj.title_card || topic).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
      items,
      tags: (obj.tags || []).slice(0, 8),
      description: (obj.description || '').trim(),
      pinned_comment: (obj.pinned_comment || 'Which rank surprised you? 👇').trim(),
    };
  }
  return null;
}

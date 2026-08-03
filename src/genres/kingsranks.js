import { chat } from '../llm.js';

// Kings of Ranks — a FUNNY "Top 5" comedy-ranking channel about animals/pets.
// Given an already-deduped funny theme, produce the STRUCTURED ranking: 5 funny
// moments, each with a short funny LABEL, a punchy funny CAPTION (the joke), and
// a GENERIC stock VIDEO keyword that will find a funny clip of it. Ranked 1
// (funniest) to 5. Silent format — the clip + caption carry the laugh. Returns
// null on failure (caller retries / fails loud).
export async function generateKingsItems(topic) {
  const prompt = `You make ONE episode of a faceless "Top 5" COMEDY Shorts channel that ranks the FUNNIEST animal / pet moments. It is silent — a funny stock clip plays while a caption delivers the joke, counting down to the #1 funniest.

THEME: "${topic}"

Pick 5 funny moments/types that fit the theme and rank them 1 (funniest) to 5.

COMEDY STYLE (this is what makes the channel funny — follow it exactly):
- The CAPTION is the joke. Use the winning animal-Shorts formula: write the animal's INNER MONOLOGUE or a RELATABLE HUMAN PARALLEL — narrate what the pet is "thinking," or compare it to a relatable human moment. Short, deadpan, and a little unhinged.
- Great examples of the voice (match this energy, don't reuse these):
  • cat knocking a cup off a table → "For science."
  • dog doing zoomies → "Remembered something from 2019."
  • cat loafing → "Structural integrity: questionable."
  • guilty-looking dog → "He planned this. For weeks."
  • startled cat mid-air → "Gravity was not consulted."
  • dog staring at food → "Negotiations have begun."
  • puppy sneezing → "Even HE wasn't ready."
- SIMPLE, everyday words. WHOLESOME. Punchy — the shorter and more unexpected, the funnier. Never just describe the clip.

Return ONLY valid JSON, no markdown:
{
  "title": "funny YouTube title under 50 chars, starts with 'Top 5', makes people smile",
  "title_card": "opening card, ALL CAPS, 3-6 words (e.g. 'TOP 5 FUNNIEST CATS')",
  "items": [
    {"rank": 1, "label": "short funny name of the moment, 2-4 words", "caption": "the JOKE — inner monologue or relatable parallel, under 38 chars, punchy & deadpan", "keyword": "2-4 word GENERIC stock VIDEO search that finds a FUNNY clip of this — common animals only, no brands/names", "keyword_alt": "different generic funny fallback search"}
    // exactly 5 objects, rank 1..5 (1 = funniest)
  ],
  "tags": ["6 funny/animal tags, most specific first"],
  "description": "2 short, fun sentences that say we rank the funniest ones from 5 to 1, ending with a question. No hashtags.",
  "pinned_comment": "one short, funny question about the ranking ending with 👇"
}

Rules:
- Every item is a common animal doing something funny we can actually FIND as generic stock video (a cat startled, a dog running, a puppy sliding, a pet begging). NOT specific famous pets.
- The CAPTION is the JOKE — a punchy, funny one-liner, not a description of the clip. Each caption DIFFERENT.
- KEYWORD must be GENERIC and brand-free (e.g. 'scared cat jump', 'dog running fast', 'puppy sliding', 'cat knocking things', 'dog begging food'). Every keyword AND keyword_alt DISTINCT.
- Keep it WHOLESOME: nothing sad, cruel, scary, or where an animal is hurt. No politics, no health, no gross-out.`;

  // Retry — Groq (Gemini is billing-blocked) occasionally truncates or returns a
  // slightly-off shape; one bad attempt must not kill the run.
  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.9, maxTokens: 4096, json: true });
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
        caption: String(it.caption || '').trim().slice(0, 44),
        keyword: String(it.keyword).trim().slice(0, 60),
        keyword_alt: String(it.keyword_alt || '').trim().slice(0, 60),
      }));

    // Order by the model's rank (1 = funniest). If ranks are missing/dupes, fall
    // back to array order. Then reassign clean ranks 1..5 (index 0 = funniest).
    if (items.every(it => it.rank >= 1 && it.rank <= 5)) items.sort((a, b) => a.rank - b.rank);
    items = items.slice(0, 5);
    if (items.length !== 5) { console.log(`  Kings items: got ${items.length}/5 valid; retrying...`); continue; }
    items = items.map((it, i) => ({ ...it, rank: i + 1 })); // items[0] = rank 1 (funniest)

    // Display order for the countdown reveal: #5 first ... #1 (funniest) last.
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
      pinned_comment: (obj.pinned_comment || 'Which one made you laugh? 👇').trim(),
    };
  }
  return null;
}

// Ranking Game — the "5 clips ranked by cost / score" gamified format.
//
// Uses the exact viral-content-director prompt (topic → hook + 5 ranked
// clips with narration + text overlay + attribution → outro + metadata).
//
// Attribution note: the LLM outputs a placeholder `attribution_handle` like
// "@creator_one" per the spec. Our pipeline IGNORES that field at render time
// and shows "Stock: Pexels" instead — because we're pulling from Pexels stock
// (legal, license-free) rather than reposting other creators' clips. The
// LLM's placeholder handle is preserved in the JSON only for spec compliance.

import { chat } from '../llm.js';

export const RANKING_VOICE = {
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+8%',    // slightly faster than DYK/consumer — punchier commentary
  pitch: '+0Hz',
};

// A rotating pool of ranking-game topic seeds. Every run picks one not on the
// recent-topics cooldown. Chosen for legal Pexels coverage and mass appeal.
const TOPIC_SEEDS = [
  '5 Everyday Fails Ranked: From Dirt Cheap Slips to Most Expensive Blunders',
  '5 Kitchen Disasters Ranked: From Spilled Coffee to Burned-Down Kitchen',
  '5 Driving Mistakes Ranked: From Fender Bender to Totaled Supercar',
  '5 Home Improvement Disasters Ranked: From Bad Paint Job to Collapsed Wall',
  '5 Tech Fails Ranked: From Cracked Phone Screen to Fried Data Center',
  '5 Pet Chaos Moments Ranked: From Chewed Slipper to Destroyed Sofa',
  '5 Vacation Blunders Ranked: From Missed Flight to Sunken Yacht',
  '5 Wedding Fails Ranked: From Awkward Speech to Ruined Reception',
  '5 Backyard Disasters Ranked: From Burnt BBQ to Pool Party Wipeout',
  '5 Office Fails Ranked: From Reply-All Email to Deleted Production Database',
  '5 DIY Project Disasters Ranked: From Wobbly Shelf to Flooded Basement',
  '5 Sports Fails Ranked: From Missed Layup to Career-Ending Injury',
  '5 Gym Mishaps Ranked: From Dropped Weight to Broken Treadmill',
  '5 Camping Disasters Ranked: From Wet Tent to Bear Encounter',
  '5 Cooking Show Disasters Ranked: From Overcooked Steak to Kitchen Fire',
];

function pickTopic(recentTopics) {
  const recent = new Set(recentTopics.map(t => (t || '').toLowerCase()));
  const fresh = TOPIC_SEEDS.filter(t => !recent.has(t.toLowerCase()));
  const pool = fresh.length > 0 ? fresh : TOPIC_SEEDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Generate ONE ranking-game episode via the user's exact viral-content-director
// prompt. Returns null on failure (caller retries).
export async function generateRankingGameContent(recentTopics = []) {
  const topic = pickTopic(recentTopics);
  console.log(`  RankingGame topic: "${topic}"`);

  const prompt = `You are an expert viral content director for a automated YouTube Shorts channel specializing in gamified ranking videos. Your job is to output a production-ready JSON script for a 50-second Shorts video.

INPUT TOPIC: "${topic}"

PRODUCTION CONSTRAINTS:
1. TITLE: SEO-optimized, highly click-worthy title (<60 characters with emojis).
2. HOOK (0-3s): Punchy opening script asking viewers to guess which rank costs the most.
3. CLIPS (Ranked 5 down to 1):
   - Rank 5 to 1 scale: Cheapest/lowest cost to Most Expensive/highest cost.
   - search_keywords: Precise GENERIC STOCK video search terms Pexels will actually find (2-4 words, no brand names, no specific people). Example: "man tripping sidewalk", "car fender bender parking lot", "kitchen fire smoke", "office desk mess".
   - narration: ~7-second transformative voiceover script with sarcastic commentary and score reveal. About 18-22 spoken words per clip.
   - text_overlay: Text graphic for the screen showing the reveal (e.g., "Damage Cost: $500,000", "Repair Bill: $2,300").
   - attribution_handle: Placeholder handle (@creator_style_name) — this is a PLACEHOLDER only, ignored at render time; the pipeline shows real stock attribution.
4. OUTRO (45-50s): Call-to-action forcing audience debate in the comments.
5. METADATA: Optimized YouTube description, 5 trending hashtags, and caption credit layout.

CRITICAL: Do NOT include introductory prose or explanations. Return valid JSON ONLY.

OUTPUT FORMAT:
{
  "title": "String",
  "description": "String",
  "hashtags": ["#Shorts", "#Ranked", "#FunniestMoments"],
  "hook_script": "String (~20-25 words, ~3 seconds spoken)",
  "outro_script": "String (~15-20 words, ~5 seconds spoken)",
  "clips": [
    {
      "rank": 5,
      "clip_title": "String, 2-5 words",
      "search_keywords": "String (2-4 words, generic Pexels-friendly)",
      "narration": "String (~18-22 words, ~7 seconds spoken)",
      "text_overlay": "String (short cost/score reveal, e.g. 'DAMAGE: $500')",
      "attribution_handle": "@placeholder_handle"
    }
  ]
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.85, maxTokens: 4096, json: true });
      try { obj = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    } catch (err) {
      console.log(`  RankingGame attempt ${attempt + 1} failed (${(err.message || '').slice(0, 100)}); retrying...`);
      continue;
    }
    if (!obj || !Array.isArray(obj.clips) || obj.clips.length < 4) {
      console.log(`  RankingGame: bad shape (${obj?.clips?.length || 0} clips); retrying...`);
      continue;
    }

    // Force 5 clips, ranked 1..5 (rank 5 = cheapest, first shown; rank 1 = priciest, last).
    let clips = obj.clips
      .filter(c => c && c.search_keywords && c.narration)
      .map(c => ({
        rank: Number(c.rank) || 0,
        clip_title: String(c.clip_title || '').trim().slice(0, 40),
        search_keywords: String(c.search_keywords).trim().slice(0, 60),
        narration: String(c.narration).trim(),
        text_overlay: String(c.text_overlay || '').trim().toUpperCase().slice(0, 32),
        // Preserve for spec-completeness but never rendered as attribution.
        attribution_handle: String(c.attribution_handle || '@stock').trim(),
      }));
    if (clips.every(c => c.rank >= 1 && c.rank <= 5)) clips.sort((a, b) => b.rank - a.rank); // 5,4,3,2,1
    clips = clips.slice(0, 5);
    if (clips.length !== 5) { console.log(`  RankingGame: got ${clips.length}/5 valid; retrying...`); continue; }
    clips = clips.map((c, i) => ({ ...c, rank: 5 - i })); // enforce 5,4,3,2,1 display order

    // Force distinct search_keywords so we don't fetch the same Pexels clip twice.
    const seen = new Set();
    clips = clips.map(c => {
      let kw = c.search_keywords.toLowerCase();
      if (seen.has(kw)) kw = `${c.search_keywords} ${c.clip_title}`.slice(0, 60);
      seen.add(kw.toLowerCase());
      return { ...c, search_keywords: kw };
    });

    // Build the full narration = hook + [5 clip narrations] + outro,
    // separated by " || " for TTS beat gaps.
    const beats = [
      String(obj.hook_script || '').trim(),
      ...clips.map(c => c.narration),
      String(obj.outro_script || '').trim(),
    ].filter(Boolean);
    const narration = beats.join(' || ')
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/\s*[—–-]\s*/g, ', ')
      .replace(/[()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      genre: 'rankinggame',
      topic,
      title: (obj.title || topic).slice(0, 90),
      hook_text: String(obj.hook_script || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60),
      hook_script: obj.hook_script || '',
      outro_script: obj.outro_script || '',
      clips,           // ordered 5,4,3,2,1 (display order)
      narration,       // for TTS + captions
      description: (obj.description || 'Which rank shocked you? 👇').trim(),
      tags: (obj.hashtags || []).map(h => (h || '').replace(/^#/, '')).filter(Boolean).slice(0, 8),
      hashtags: (obj.hashtags || []).slice(0, 8),
      pinned_comment: `Which one shocked you the most? Comment your rank below 👇`,
      attribution: 'Stock: Pexels',   // the LEGAL attribution shown on-screen
    };
  }
  return null;
}

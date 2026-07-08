import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chat } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = join(__dirname, '../config/topics.json');
const USED_IDEAS_PATH = join(__dirname, '../config/used-ideas.json');

function loadUsedIdeas() {
  if (!existsSync(USED_IDEAS_PATH)) return [];
  return JSON.parse(readFileSync(USED_IDEAS_PATH, 'utf-8'));
}

function saveUsedIdea(idea) {
  const used = loadUsedIdeas();
  used.push({
    topic: idea.topic,
    title: idea.title,
    genre: idea.genre,
    theme: idea.theme || null,
    date: new Date().toISOString(),
  });
  writeFileSync(USED_IDEAS_PATH, JSON.stringify(used, null, 2));
}

// The channel is FOCUSED on ONE format: "visual reveal" trivia. The data was
// decisive — every high-retention video is a visual reveal (Coca-Cola green 60%,
// Platypus UV 55%), while the mixed-in formats (dark history, famous people,
// money/power, psychology) all retained UNDER 50% and dragged the channel below
// the threshold where Shorts stops pushing, sending daily views from ~1,700 to
// ~640. So the other genres were cleared on 2026-06-22 and we now produce ONLY
// visual_reveal — one consistent format the algorithm can learn and push.
const VISUAL_REVEAL_GUIDANCE = 'A surprising HIDDEN visual about a familiar thing we can literally SHOW on screen — what an animal/object looks like under UV light, X-ray, microscope, or in slow motion; the secret or original color/shape of a famous product; what is hidden inside an everyday object; a startling size or scale comparison the viewer can picture. (Examples that performed best: "platypuses glow green under UV", "Coca-Cola was originally green".) The fact MUST have a clear visual payoff we can show on screen — that visual is what holds viewers to the end, which is what grows the channel.';

// Normalize a topic to a comparison key so near-duplicates (different wording,
// same subject) are also treated as repeats: drop "did you know", punctuation,
// and filler words, then collapse whitespace.
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^\s*(top\s*(5|five)|did you know)/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|that|this|is|are|was|were|of|to|in|on|for|and|or|your|you|why|how|what|can|do|does)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const usedKeySet = (used) => new Set(used.map(u => norm(u.topic)));

// Significant keywords from a topic (4+ char tokens after normalization).
// Used as a second-layer dedup: catches near-duplicates where Groq picks the
// same SUBJECT but rephrases it (e.g. "honey never spoils" vs "honey lasts
// forever" — different exact match, same fact). If a candidate shares 2+
// keywords AND >= 40% of its keywords with any used topic, treat as duplicate.
// Light stemming so singular/plural and simple form variants compare equal
// (wombat/wombats, pyramid/pyramids, keyboard/keyboards) — without this the
// dedup misses reworded repeats, which is exactly how 4 dupes slipped in early.
function stem(w) {
  if (w.length <= 4) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('es')) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function topicKeywords(s) {
  return new Set(norm(s).split(/\s+/).filter(w => w.length >= 4).map(stem));
}

function isTooSimilar(candidate, used) {
  const cand = topicKeywords(candidate);
  if (cand.size < 2) return false;
  for (const u of used) {
    const ukw = topicKeywords(u.topic);
    let overlap = 0;
    for (const w of cand) if (ukw.has(w)) overlap++;
    if (overlap >= 2 && overlap / cand.size >= 0.4) return true;
  }
  return false;
}

// Over-saturated "did you know" facts that flood Shorts. Viewers have seen them
// dozens of times, so they swipe on sight — which tanks retention and reach.
// Any candidate sharing 2+ significant keywords with one of these is rejected.
// Over-saturated facts. Variants matter — "sea otters hold paws while napping"
// must trip the same filter as "sea otters hold hands sleeping". Audit (2026-06)
// caught Sea Otters slipping through with a synonym, so we now list multiple
// phrasings of each cliché AND extend the semantic LLM judge to treat the whole
// list as "already published" (catches anything keyword overlap misses).
const CLICHE_SUBJECTS = [
  'honey never spoils', 'honey lasts forever', 'bananas are berries',
  'strawberries are not berries', 'octopus three hearts blue blood',
  'wombat cube shaped poop', 'sharks older than trees',
  'cleopatra closer pyramids moon landing', 'cleopatra lived closer to moon landing',
  'venus day longer than year', 'a day on venus is longer than a year',
  'humans share dna with bananas', 'goldfish three second memory',
  'goldfish memory only lasts seconds', 'great wall visible from space',
  'humans use ten percent of brain', 'we only use ten percent of our brain',
  'bulls hate the color red', 'hair and nails grow after death',
  'eiffel tower taller in summer heat', 'nintendo started as playing cards',
  'oxford older than aztec empire', 'lightning never strikes twice',
  'lightning can strike the same place twice', 'napoleon was actually short',
  'cracking knuckles causes arthritis', 'flamingos pink from shrimp',
  'koala fingerprints like humans', 'koala paws identical to human prints',
  'astronauts grow taller in space', 'mantis shrimp punch boiling',
  'tardigrades survive in space', 'hot water freezes faster mpemba',
  'slugs snails have thousands of teeth',
  'cows have best friends', 'cows form lifelong friendships',
  'sea otters hold hands sleeping', 'sea otters hold paws while napping',
  'sea otters link paws to not drift apart',
  'a group of flamingos is a flamboyance',
  'platypuses glow green under uv', // ours — don't repeat
  'coca-cola was originally green',  // ours — don't repeat
  'shrimp punch nearly sun hot',     // ours — don't repeat
  'vending machines kill more people than sharks', // ours — don't repeat
];

function isCliche(topic) {
  const cand = topicKeywords(topic);
  if (cand.size < 1) return false;
  for (const c of CLICHE_SUBJECTS) {
    const ckw = topicKeywords(c);
    if (ckw.size === 0) continue;
    let overlap = 0;
    for (const w of cand) if (ckw.has(w)) overlap++;
    // Only a cliché if the candidate covers MOST of this cliché's distinctive
    // keywords — i.e. it really is that exact overdone fact, not just a fresh
    // fact about the same popular subject (Eiffel Tower, sharks, the Great Wall…).
    if (overlap >= 2 && overlap / ckw.size >= 0.6) return true;
  }
  return false;
}

// Curated fallback pool, used only if the AI is unavailable. Never resets, so it
// never re-serves a used topic.
function pickFromPool(usedKeys, used) {
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const available = categories.flatMap(c => c.topics)
    .filter(t => !usedKeys.has(norm(t)) && !isTooSimilar(t, used) && !isCliche(t));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// Score a candidate topic 1-10 on whether it is the kind of subject a general
// audience actually wants to watch. This is the filter that kills "lame" picks
// — obscure historical figures, niche 19th-century inventions, regional foods
// nobody has heard of. We require a score >= TOPIC_INTEREST_THRESHOLD or the
// generator retries. Failure (network/LLM) returns the threshold so we never
// block the pipeline on the judge itself.
const TOPIC_INTEREST_THRESHOLD = 7;

async function judgeTopicInterest(topic) {
  if (!topic) return 0;
  const prompt = `You are a YouTube Shorts strategist for a "Did You Know" channel. Score this candidate topic 1-10 on how interesting it would be to a GENERAL audience of all ages on YouTube Shorts.

TOPIC: "${topic}"

Score 1-10 against ALL of these criteria together:
- Subject recognizability — would a normal 13-year-old or a curious 40-year-old INSTANTLY know what the subject is? (Popular animals, the human body, space, famous landmarks, brands and foods people see weekly, recent scientific news = HIGH. Obscure historical figures, niche inventions, regional foods, micro-fields = LOW.)
- Currency / relevance — does the subject feel like something people care about NOW? (Trending topics, popular animals, things in the news, daily-life subjects = HIGH. Forgotten 19th-century trivia = LOW.)
- Surprise — is the angle genuinely fresh, not an over-told cliché?
- Visual payoff — is there a concrete visual reveal we can SHOW?

1-3: obscure, niche, dry, would flop. Subject most viewers don't recognize.
4-6: ok-ish, recognizable subject but the fact is forgettable or abstract.
7-8: strong — popular subject + fresh surprising angle + clear visual.
9-10: instant-share material — famous subject, jaw-drop angle, instant visual.

Reply with ONLY the integer score (1-10). Nothing else.`;
  try {
    const ans = (await chat(prompt, { temperature: 0, maxTokens: 256 })).trim();
    const n = parseInt(ans.match(/\d+/)?.[0] || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return TOPIC_INTEREST_THRESHOLD; // judge unavailable → don't block
  }
}

// Final, strictest dedup layer: ask the LLM whether the candidate is the SAME
// core fact as any recent topic, even if worded completely differently —
// catching reworded repeats that keyword overlap can never see. Best-effort:
// any error returns false so it never blocks the pipeline.
async function isSemanticDuplicate(topic, used) {
  const recent = used.slice(-80).map(u => u.topic);
  // Treat clichés as "already published" too — that closes the loophole where a
  // reworded cliché ("sea otters hold paws while napping") slips past the
  // keyword-overlap check on the actual CLICHE_SUBJECTS list.
  const checkList = [...recent, ...CLICHE_SUBJECTS];
  if (checkList.length === 0) return false;
  try {
    const prompt = `You are strictly deduplicating ideas for a "Did You Know" channel. We must NEVER publish the same core fact twice.

ALREADY PUBLISHED (and over-used clichés to avoid):
${checkList.map((t, i) => `${i + 1}. ${t}`).join('\n')}

CANDIDATE: "${topic}"

Would a viewer who saw one of the published videos feel the CANDIDATE is the SAME fact repeated — same specific subject AND same surprising point, even if reworded or framed from another angle? Answer YES if it would feel like a repeat. Answer NO only if it is clearly a different subject or a genuinely different fact.
Reply with ONLY one word: YES or NO.`;
    // maxTokens must leave room for this model's hidden "thinking" tokens — too
    // small a budget (e.g. 4) returns an empty answer and silently disables the check.
    const ans = (await chat(prompt, { temperature: 0, maxTokens: 512 })).trim().toUpperCase();
    return ans.startsWith('Y');
  } catch {
    return false; // never block generation on a dedup-check failure
  }
}

// Primary source: Gemini invents a fresh fact in the assigned theme, steered
// away from everything already used. Retries until it returns a genuinely
// new subject. The theme is passed in so the daily mix stays balanced.
async function generateFreshTopic(used, usedKeys) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) return null;

  // Only the last 80 used topics are shown to the LLM per attempt. The full
  // keyword-overlap dedup runs client-side against ALL used topics, and the
  // semantic-duplicate LLM judge (isSemanticDuplicate) uses a wider window
  // downstream — so shrinking THIS list just saves tokens without weakening
  // dedup. Was 250, which pushed the prompt over Groq's 12k TPM ceiling.
  const recent = used.slice(-80).map(u => `- ${u.topic}`).join('\n');

  // Track the best-scoring candidate across attempts so we never fall back to
  // the worst one when all attempts score below threshold.
  let best = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 6; attempt++) {
    const prompt = `Invent ONE fresh, specific "Top 5" theme for a viral countdown-style YouTube Shorts channel.

FORMAT: every video counts down 5 surprising, TRUE, VISUAL things on one theme (number 5 up to number 1).
${VISUAL_REVEAL_GUIDANCE}

Rules:
- Output a SINGLE theme line that begins with "Top 5" and names a clear category, UNDER 12 words. e.g. "Top 5 animals that glow under UV light", "Top 5 everyday objects with a hidden purpose", "Top 5 places on Earth that look like another planet", "Top 5 deep sea creatures that look fake".
- The theme MUST have at least 5 real, distinct, genuinely surprising, VISUAL examples we can show on screen.
- HIGH-INTEREST, RECOMMENDABLE: build it around subjects lots of people already find fascinating and search for — popular animals, space and planets, nature, famous landmarks and places, everyday objects, food, technology, natural phenomena, structures, vehicles. Familiar + visual = far more suggested by the algorithm.
- ABSOLUTELY NO health, medical, diet, nutrition, sleep, supplement, or wellness themes. That category is suppressed. Pure curiosity and wonder only.
- Prefer subjects with instant, satisfying visuals (glowing, giant, tiny, hidden, transforming, color-changing, camouflaged, strange-looking).
- AVOID over-used Shorts clichés (honey never spoils, bananas are berries, octopus 3 hearts, we use 10% of brain, Cleopatra vs pyramids, Venus day longer than year, Napoleon short).
- It must be a COMPLETELY DIFFERENT theme (not just different wording) from every already-used one below. If it shares 2+ significant keywords with any of these, pick a different theme entirely:
${recent || '(none yet)'}

Return ONLY the single "Top 5 ..." theme line, nothing else.`;

    try {
      // maxTokens must leave room for Gemini 2.5 Flash's hidden "thinking" tokens;
      // at 80 the topic came back truncated to the bare stub "Did you know".
      const text = await chat(prompt, { temperature: 0.95, maxTokens: 1024 });
      const topic = text.split('\n')[0].replace(/^["'\-\s]+|["'\s]+$/g, '').trim();
      // Require real content AFTER the "Top 5" prefix so a truncated stub
      // ("Top 5") can never be accepted as a theme.
      const afterPrefix = topic.replace(/^top\s*(5|five)/i, '').replace(/[^a-z0-9]+/gi, ' ').trim();
      const wordsAfter = afterPrefix ? afterPrefix.split(/\s+/).filter(w => w.length >= 3).length : 0;
      const formatOK = /^top\s*(5|five)\b/i.test(topic) && topic.length >= 15 && wordsAfter >= 2;
      const exactNew = !usedKeys.has(norm(topic));
      const subjectNew = !isTooSimilar(topic, used);
      const notCliche = !isCliche(topic);
      if (formatOK && exactNew && subjectNew && notCliche) {
        if (await isSemanticDuplicate(topic, used)) {
          console.log(`  Topic is a reworded repeat of an earlier one, retrying...`);
        } else {
          // Final gate: is the SUBJECT itself something a general audience cares
          // about? Rejects obscure / niche / dry topics that historically flop.
          const interest = await judgeTopicInterest(topic);
          console.log(`  Topic interest judge: ${interest}/10 — "${topic}"`);
          if (interest > bestScore) { best = topic; bestScore = interest; }
          if (interest >= TOPIC_INTEREST_THRESHOLD) return topic;
          console.log(`  Topic interest too low (${interest}/${TOPIC_INTEREST_THRESHOLD}), retrying for a more recognizable subject...`);
        }
      } else if (formatOK && exactNew && subjectNew && !notCliche) {
        console.log(`  Topic is an over-used cliché, retrying...`);
      } else if (formatOK && exactNew && !subjectNew) {
        console.log(`  Topic too similar to a used one, retrying...`);
      }
    } catch (err) {
      console.log(`  Topic-gen attempt ${attempt + 1} failed (${err.message}); retrying...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  // All attempts fell below threshold — return the best one we saw rather than
  // null, so the pipeline still produces a reel today (and we logged the score).
  if (best) {
    console.log(`  Falling back to best-scoring topic so far (${bestScore}/10): "${best}"`);
    return best;
  }
  return null;
}

export async function generateIdea(genre) {
  const used = loadUsedIdeas();
  const usedKeys = usedKeySet(used);

  // Single focused format now — Top 5 visual countdown (reworked 2026-07-08).
  const theme = 'visual_reveal';
  console.log('  Format: Top 5 countdown');

  // AI-only. The legacy curated pool (config/topics.json) is full of old
  // "Did you know" single-fact topics that are the WRONG format (and often
  // YMYL/health), so we NO LONGER fall back to it — serving one produced an
  // off-format video that failed checks. Retry the generator; if no LLM is
  // available, fail the run cleanly rather than upload something off-format.
  let topic = await generateFreshTopic(used, usedKeys);
  if (!topic) topic = await generateFreshTopic(used, new Set());
  if (!topic) throw new Error('Could not generate a Top-5 theme — no LLM available (Gemini billing-blocked + Groq daily limit hit?). Skipping this run.');

  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic, theme };
  saveUsedIdea(idea);
  return idea;
}

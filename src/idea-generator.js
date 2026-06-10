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

// The 4 content directions the channel mixes across each day. Every video is
// tagged with one so we can enforce variety (no two back-to-back from the
// same theme) and analyse which themes actually perform.
const THEMES = {
  dark_history: {
    label: 'Dark / weird history',
    guidance: 'A bizarre, dark, or hidden moment from history — scandals, mysteries, conspiracies that turned out true, twisted truths. Name real people/dates/places. Surprising and specific.',
  },
  famous_people: {
    label: 'Untold stories about famous people',
    guidance: 'A surprising, dark, or lesser-known fact about a real famous person — a billionaire, president, scientist, athlete, musician, founder, celebrity. Name them.',
  },
  money_power: {
    label: 'Money / wealth / power',
    guidance: 'A counter-intuitive fact about how money, business, or power actually works — hidden mechanics, surprising wealth moves, where the money really goes. Concrete numbers when possible.',
  },
  psychology: {
    label: 'Psychology + life-hacks',
    guidance: 'A psychology trick, persuasion principle, brain quirk, or actionable life hack a viewer can use today. Surprising AND useful.',
  },
};

// Pick a theme that is under-represented in the most recent N picks so the
// daily mix stays balanced. Falls back to a random theme if every theme is
// equally represented.
function pickUnderusedTheme(used) {
  const recent = used.slice(-10).map(u => u.theme).filter(Boolean);
  const counts = Object.fromEntries(Object.keys(THEMES).map(k => [k, 0]));
  for (const t of recent) if (counts[t] !== undefined) counts[t]++;
  const min = Math.min(...Object.values(counts));
  const candidates = Object.keys(counts).filter(k => counts[k] === min);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Normalize a topic to a comparison key so near-duplicates (different wording,
// same subject) are also treated as repeats: drop "did you know", punctuation,
// and filler words, then collapse whitespace.
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^\s*did you know/, '')
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
const CLICHE_SUBJECTS = [
  'honey never spoils', 'bananas are berries', 'strawberries are not berries',
  'octopus three hearts blue blood', 'wombat cube shaped poop', 'sharks older than trees',
  'cleopatra closer pyramids moon landing', 'venus day longer than year',
  'humans share dna with bananas', 'goldfish three second memory',
  'great wall visible from space', 'humans use ten percent of brain',
  'bulls hate the color red', 'hair and nails grow after death',
  'eiffel tower taller in summer heat', 'nintendo started as playing cards',
  'oxford older than aztec empire', 'lightning never strikes twice',
  'napoleon was actually short', 'cracking knuckles causes arthritis',
  'flamingos pink from shrimp', 'koala fingerprints like humans',
  'astronauts grow taller in space', 'mantis shrimp punch boiling',
  'tardigrades survive in space', 'hot water freezes faster mpemba',
  'slugs snails have thousands of teeth', 'cows have best friends',
  'sea otters hold hands sleeping', 'a group of flamingos is a flamboyance',
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

// Final, strictest dedup layer: ask the LLM whether the candidate is the SAME
// core fact as any recent topic, even if worded completely differently —
// catching reworded repeats that keyword overlap can never see. Best-effort:
// any error returns false so it never blocks the pipeline.
async function isSemanticDuplicate(topic, used) {
  const recent = used.slice(-80).map(u => u.topic);
  if (recent.length === 0) return false;
  try {
    const prompt = `You are strictly deduplicating ideas for a "Did You Know" channel. We must NEVER publish the same core fact twice.

ALREADY PUBLISHED:
${recent.map((t, i) => `${i + 1}. ${t}`).join('\n')}

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
async function generateFreshTopic(used, usedKeys, theme) {
  if (!process.env.GROQ_API_KEY) return null;

  const recent = used.slice(-250).map(u => `- ${u.topic}`).join('\n');
  const themeMeta = THEMES[theme] || THEMES.dark_history;

  for (let attempt = 0; attempt < 4; attempt++) {
    const prompt = `Invent ONE genuinely surprising, TRUE "Did You Know" fact for a YouTube Shorts channel.

THIS VIDEO'S THEME: ${themeMeta.label}
${themeMeta.guidance}

Rules:
- Must be 100% TRUE and verifiable.
- Genuinely surprising — the kind of fact people repeat to friends.
- AVOID over-used facts that flood YouTube Shorts (honey never spoils, bananas are berries, octopus has three hearts, sharks older than trees, we use 10% of our brain, Cleopatra vs the pyramids, Venus day longer than year, Napoleon was short, etc.). Viewers have seen these a hundred times — pick something genuinely fresh and lesser-known.
- Favor concrete, visual, name-specific subjects: actual people, places, dates, dollar amounts. Avoid vague abstractions.
- Phrase it as a topic line beginning with "Did you know", under 15 words.
- It must be a COMPLETELY DIFFERENT SUBJECT (not just different wording) from every already-used topic below. If your candidate shares 2+ significant keywords with any of these, pick a different subject entirely:
${recent || '(none yet)'}

Return ONLY the single topic line, nothing else.`;

    try {
      // maxTokens must leave room for Gemini 2.5 Flash's hidden "thinking" tokens;
      // at 80 the topic came back truncated to the bare stub "Did you know".
      const text = await chat(prompt, { temperature: 0.95, maxTokens: 1024 });
      const topic = text.split('\n')[0].replace(/^["'\-\s]+|["'\s]+$/g, '').trim();
      // Require real content AFTER the "did you know" prefix so a truncated stub
      // can never be accepted as a topic (it would make the script writer fall
      // back to the prompt's example fact).
      const afterPrefix = topic.replace(/^did you know/i, '').replace(/[^a-z0-9]+/gi, ' ').trim();
      const wordsAfter = afterPrefix ? afterPrefix.split(/\s+/).filter(w => w.length >= 3).length : 0;
      const formatOK = /^did you know/i.test(topic) && topic.length >= 25 && wordsAfter >= 3;
      const exactNew = !usedKeys.has(norm(topic));
      const subjectNew = !isTooSimilar(topic, used);
      const notCliche = !isCliche(topic);
      if (formatOK && exactNew && subjectNew && notCliche) {
        if (await isSemanticDuplicate(topic, used)) {
          console.log(`  Topic is a reworded repeat of an earlier one, retrying...`);
        } else {
          return topic;
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
  return null;
}

export async function generateIdea(genre) {
  const used = loadUsedIdeas();
  const usedKeys = usedKeySet(used);

  // Pick a theme that's under-represented in the last 10 picks so the 6-per-day
  // mix stays balanced across dark history / famous people / money / psychology.
  const theme = pickUnderusedTheme(used);
  console.log(`  Theme: ${THEMES[theme].label}`);

  // 1) fresh AI topic in this theme, 2) unused curated pool, 3) last-ditch AI call.
  let topic = await generateFreshTopic(used, usedKeys, theme);
  if (!topic) topic = pickFromPool(usedKeys, used);
  if (!topic) topic = await generateFreshTopic(used, new Set(), theme);
  if (!topic) throw new Error('Could not generate a unique topic (AI unavailable and pool exhausted).');

  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic, theme };
  saveUsedIdea(idea);
  return idea;
}

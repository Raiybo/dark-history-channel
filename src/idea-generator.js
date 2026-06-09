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
  used.push({ topic: idea.topic, title: idea.title, genre: idea.genre, date: new Date().toISOString() });
  writeFileSync(USED_IDEAS_PATH, JSON.stringify(used, null, 2));
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
function topicKeywords(s) {
  return new Set(norm(s).split(/\s+/).filter(w => w.length >= 4));
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

// Primary source: Gemini invents a fresh fact, steered away from everything
// already used. Retries until it returns a genuinely new subject.
async function generateFreshTopic(used, usedKeys) {
  if (!process.env.GROQ_API_KEY) return null;

  const recent = used.slice(-250).map(u => `- ${u.topic}`).join('\n');
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8')).map(c => c.category).join(', ');

  for (let attempt = 0; attempt < 4; attempt++) {
    const prompt = `Invent ONE genuinely surprising, TRUE "Did You Know" fact for a YouTube Shorts channel.
It can come from any field: ${categories}, or anything else fascinating.

Rules:
- Must be 100% TRUE and verifiable.
- Genuinely surprising — the kind of fact people repeat to friends.
- AVOID over-used facts that already flood YouTube Shorts (e.g. honey never spoils, bananas are berries, octopus has three hearts, sharks older than trees, we only use 10% of our brain, Cleopatra vs the pyramids, a day on Venus is longer than its year). Viewers have seen these a hundred times and skip instantly — pick something genuinely fresh and lesser-known.
- Favor CONCRETE, VISUAL, RELATABLE subjects (animals, space, the human body, everyday objects, surprising history) — these get the most views. Avoid purely abstract or numbers-only facts that are hard to picture.
- Phrase it as a topic line beginning with "Did you know", under 15 words.
- It must be a COMPLETELY DIFFERENT SUBJECT (not just different wording) from every already-used topic below. If your candidate shares 2+ significant keywords with any of these, pick a different subject entirely:
${recent || '(none yet)'}

Return ONLY the single topic line, nothing else.`;

    try {
      const text = await chat(prompt, { temperature: 0.95, maxTokens: 80 });
      const topic = text.split('\n')[0].replace(/^["'\-\s]+|["'\s]+$/g, '').trim();
      const formatOK = /^did you know/i.test(topic) && topic.length >= 12;
      const exactNew = !usedKeys.has(norm(topic));
      const subjectNew = !isTooSimilar(topic, used);
      const notCliche = !isCliche(topic);
      if (formatOK && exactNew && subjectNew && notCliche) return topic;
      if (formatOK && exactNew && subjectNew && !notCliche) {
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

  // 1) fresh AI topic (deduped), 2) unused curated pool, 3) last-ditch AI call.
  let topic = await generateFreshTopic(used, usedKeys);
  if (!topic) topic = pickFromPool(usedKeys, used);
  if (!topic) topic = await generateFreshTopic(used, new Set());
  if (!topic) throw new Error('Could not generate a unique topic (AI unavailable and pool exhausted).');

  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic };
  saveUsedIdea(idea);
  return idea;
}

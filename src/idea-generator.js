import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Curated fallback pool, used only if the AI is unavailable. Never resets, so it
// never re-serves a used topic.
function pickFromPool(usedKeys) {
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const available = categories.flatMap(c => c.topics).filter(t => !usedKeys.has(norm(t)));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// Primary source: Gemini invents a fresh fact, steered away from everything
// already used. Retries until it returns a genuinely new subject.
async function generateFreshTopic(used, usedKeys) {
  if (!process.env.GEMINI_API_KEY) return null;

  const recent = used.slice(-150).map(u => `- ${u.topic}`).join('\n');
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8')).map(c => c.category).join(', ');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  for (let attempt = 0; attempt < 4; attempt++) {
    const prompt = `Invent ONE genuinely surprising, TRUE "Did You Know" fact for a YouTube Shorts channel.
It can come from any field: ${categories}, or anything else fascinating.

Rules:
- Must be 100% TRUE and verifiable.
- Genuinely surprising — the kind of fact people repeat to friends.
- Phrase it as a topic line beginning with "Did you know", under 15 words.
- It must be a COMPLETELY DIFFERENT subject from every already-used topic below.
  Do not rephrase, narrow, or reuse the same subject as any of them:
${recent || '(none yet)'}

Return ONLY the single topic line, nothing else.`;

    try {
      const result = await model.generateContent(prompt);
      const topic = result.response.text().trim().split('\n')[0].replace(/^["'\-\s]+|["'\s]+$/g, '').trim();
      if (/^did you know/i.test(topic) && topic.length >= 12 && !usedKeys.has(norm(topic))) {
        return topic;
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
  if (!topic) topic = pickFromPool(usedKeys);
  if (!topic) topic = await generateFreshTopic(used, new Set());
  if (!topic) throw new Error('Could not generate a unique topic (AI unavailable and pool exhausted).');

  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic };
  saveUsedIdea(idea);
  return idea;
}

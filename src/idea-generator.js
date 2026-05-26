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

// Reliable fallback: pick an unused topic from the curated pool.
function pickFromPool(used) {
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const usedTopics = new Set(used.map(u => u.topic));
  const pool = categories.flatMap(cat => cat.topics);
  const available = pool.filter(t => !usedTopics.has(t));

  if (available.length === 0) {
    console.log('  Topic pool exhausted — resetting used-ideas list.');
    writeFileSync(USED_IDEAS_PATH, JSON.stringify([], null, 2));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

// Primary: let Gemini invent a fresh, surprising "Did You Know" topic from any
// field, steering clear of anything we've already covered.
async function generateFreshTopic(used) {
  if (!process.env.GEMINI_API_KEY) return null;

  const recent = used.slice(-60).map(u => `- ${u.topic}`).join('\n');
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'))
    .map(c => c.category).join(', ');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Invent ONE genuinely surprising "Did You Know" fact for a YouTube Shorts channel.
It can come from any field: ${categories}, or anything else fascinating.

Rules:
- Must be 100% TRUE and verifiable.
- Must be genuinely surprising — the kind of fact people repeat to friends.
- Phrase it as a topic line beginning with "Did you know".
- Keep it under 15 words.
- It must NOT duplicate or closely resemble any of these already-used topics:
${recent || '(none yet)'}

Return ONLY the single topic line, nothing else.`;

  try {
    const result = await model.generateContent(prompt);
    let topic = result.response.text().trim().replace(/^["'\-\s]+|["'\s]+$/g, '');
    topic = topic.split('\n')[0].trim();
    if (!/^did you know/i.test(topic) || topic.length < 12) return null;
    return topic;
  } catch (err) {
    console.log(`  Topic generation failed (${err.message}) — using curated pool.`);
    return null;
  }
}

export async function generateIdea(genre) {
  const used = loadUsedIdeas();
  const usedTopics = new Set(used.map(u => u.topic.toLowerCase()));

  let topic = await generateFreshTopic(used);
  if (!topic || usedTopics.has(topic.toLowerCase())) {
    topic = pickFromPool(used);
  }

  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic };
  saveUsedIdea(idea);
  return idea;
}

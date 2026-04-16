import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = join(__dirname, '../config/topics.json');
const USED_IDEAS_PATH = join(__dirname, '../config/used-ideas.json');

async function withRetry(fn, retries = 5, delayMs = 15000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message.includes('503') || err.message.includes('overloaded') || err.message.includes('temporarily') || err.message.includes('unavailable');
      if (isRetryable && i < retries - 1) {
        console.log(`  Model busy, retrying in ${delayMs / 1000}s... (attempt ${i + 2}/${retries})`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

function loadUsedIdeas() {
  if (!existsSync(USED_IDEAS_PATH)) return [];
  return JSON.parse(readFileSync(USED_IDEAS_PATH, 'utf-8'));
}

function saveUsedIdea(idea) {
  const used = loadUsedIdeas();
  used.push({ topic: idea.topic, title: idea.title, date: new Date().toISOString() });
  writeFileSync(USED_IDEAS_PATH, JSON.stringify(used, null, 2));
}

function pickRandomUnusedTopic() {
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const used = loadUsedIdeas();
  const usedTopics = new Set(used.map(u => u.topic));
  const all = categories.flatMap(cat => cat.topics);
  const available = all.filter(t => !usedTopics.has(t));

  if (available.length === 0) {
    console.log('All topics exhausted — resetting used-ideas list.');
    writeFileSync(USED_IDEAS_PATH, JSON.stringify([], null, 2));
    return all[Math.floor(Math.random() * all.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

export async function generateIdea() {
  const topic = pickRandomUnusedTopic();
  console.log(`Selected topic: ${topic}`);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a writer for "Dark Chronicles" — a YouTube channel that takes real dark history events and narrates them in Gen Alpha / Brainrot internet slang. The contrast between serious history and absurd slang is what makes it go viral.

Given this historical topic: "${topic}"

Generate a specific video angle in full brainrot style. Return ONLY valid JSON with no markdown, no code fences:

{
  "topic": "${topic}",
  "title": "YouTube title in brainrot style, max 70 chars. Examples: 'The Black Death Was Pure Ohio Energy No Cap', 'Napoleon Caught The Biggest L In History Fr'",
  "angle": "Which specific event or person to focus on and why it's skibidi/ohio/sigma in brainrot terms",
  "hook": "Opening sentence in brainrot slang that immediately grabs attention. Must reference the real event but use Gen Alpha vocabulary. Bold, punchy, under 25 words.",
  "era": "Historical time period",
  "location": "Geographic location",
  "estimated_duration_minutes": 11
}`;

  const idea = await withRetry(async () => {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Gemini returned non-JSON: ${text}`);
    return JSON.parse(jsonMatch[0]);
  });

  saveUsedIdea(idea);
  return idea;
}

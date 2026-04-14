import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = join(__dirname, '../config/topics.json');
const USED_IDEAS_PATH = join(__dirname, '../config/used-ideas.json');

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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a writer for a dark history YouTube channel called "Dark Chronicles". Your videos tell true, deeply researched stories from history that are disturbing, mysterious, or forgotten.

Given this broad topic: "${topic}"

Generate a specific, gripping video story angle. Return ONLY valid JSON with no markdown, no code fences:

{
  "topic": "${topic}",
  "title": "Compelling YouTube title under 70 characters — specific, not generic",
  "angle": "Exactly which event, person, or episode to focus on and what makes it dark/compelling",
  "hook": "The opening sentence that will immediately grab the viewer",
  "era": "Historical time period",
  "location": "Geographic location where events took place",
  "estimated_duration_minutes": 6
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini returned non-JSON: ${text}`);

  const idea = JSON.parse(jsonMatch[0]);
  saveUsedIdea(idea);

  return idea;
}

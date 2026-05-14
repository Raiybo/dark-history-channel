import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  used.push({ topic: idea.topic, title: idea.title, genre: idea.genre, date: new Date().toISOString() });
  writeFileSync(USED_IDEAS_PATH, JSON.stringify(used, null, 2));
}

const SKIP_CATEGORIES = ['Everyday Technology'];

function pickRandomUnusedTopic() {
  const categories = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const used = loadUsedIdeas();
  const usedTopics = new Set(used.map(u => u.topic));

  const preferred = categories
    .filter(cat => !SKIP_CATEGORIES.includes(cat.category))
    .flatMap(cat => cat.topics);
  const all = categories.flatMap(cat => cat.topics);

  const pool = preferred.length > 0 ? preferred : all;
  const available = pool.filter(t => !usedTopics.has(t));

  if (available.length === 0) {
    console.log('  All topics exhausted — resetting used-ideas list.');
    writeFileSync(USED_IDEAS_PATH, JSON.stringify([], null, 2));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

export async function generateIdea(genre) {
  const topic = pickRandomUnusedTopic();
  console.log(`  Selected topic: ${topic}`);
  const idea = { genre, topic, title: topic };
  saveUsedIdea(idea);
  return idea;
}

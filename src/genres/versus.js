import { chat } from '../llm.js';

// "Have you ever thought that…" — a silent head-to-head comparison. Given an
// interesting comparison QUESTION, produce the two contenders (each with a name,
// one simple surprising fact, and a GENERIC stock keyword), the true winner, and
// a one-line answer that explains the surprise. SIMPLE English. Returns null on
// failure (caller retries / fails loud).
export async function generateVersusContent(question) {
  const prompt = `You make ONE episode of a silent "Have you ever thought that…" comparison Shorts channel. Each video poses ONE interesting question comparing TWO things, shows each over a clip, then reveals which one wins and the surprising reason.

QUESTION / THEME: "${question}"

Pick the TWO best things to compare for this question and decide which truly wins.

WRITE IN SIMPLE, EVERYDAY ENGLISH — short words a 12-year-old understands. Make it genuinely interesting, wholesome, and TRUE (no made-up facts).

Return ONLY valid JSON, no markdown:
{
  "title": "fun curiosity title under 55 chars, e.g. 'Who Wins: Paper Plane or Baseball?' — NEVER start with 'Shocking' or ALL-CAPS clickbait",
  "hook": "GUESS WHO WINS",
  "question": "the question in 3-6 words, punchy, e.g. 'WHO WINS: LION OR TIGER?'",
  "a": {"name": "first thing, 1-3 words", "fact": "one simple surprising fact/strength, under 38 chars", "keyword": "2-4 word GENERIC stock VIDEO search, brand-free"},
  "b": {"name": "second thing, 1-3 words", "fact": "one simple surprising fact/strength, under 38 chars", "keyword": "2-4 word GENERIC stock VIDEO search, brand-free"},
  "winner": "a or b — which one truly wins the question",
  "answer": "one simple sentence: who wins and the surprising WHY, under 60 chars",
  "tags": ["6 tags about the two things + the question, most specific first"],
  "description": "2 simple sentences setting up the comparison, ending with a question. No hashtags.",
  "pinned_comment": "one short question asking viewers who they'd pick, ending with 👇"
}

Rules:
- a and b must be genuinely comparable and interesting to pit against each other.
- The winner must be the TRUE answer to the question, not a coin flip.
- KEYWORDS must be GENERIC and brand-free (e.g. 'lion walking', 'tiger closeup', 'cheetah running', 'race car track') so the stock footage is license-free. a.keyword and b.keyword MUST be different.
- The 'answer' is the payoff — make it a satisfying "oh, interesting!" reveal.
- Wholesome and true. NO politics, tragedy, gore, or health claims.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    let obj;
    try {
      const text = await chat(prompt, { temperature: 0.85, maxTokens: 4096, json: true });
      try { obj = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
    } catch (err) {
      console.log(`  Versus attempt ${attempt + 1} failed (${(err.message || '').slice(0, 80)}); retrying...`);
      continue;
    }
    if (!obj || !obj.a || !obj.b) { console.log('  Versus: missing contenders; retrying...'); continue; }

    const norm = (x) => ({
      name: String(x?.name || '').trim().slice(0, 28),
      fact: String(x?.fact || '').trim().slice(0, 44),
      keyword: String(x?.keyword || x?.name || '').trim().slice(0, 60),
    });
    const a = norm(obj.a);
    const b = norm(obj.b);
    if (!a.name || !b.name || !a.keyword || !b.keyword) { console.log('  Versus: incomplete contender; retrying...'); continue; }
    // Distinct keywords so the two clips differ.
    if (a.keyword.toLowerCase() === b.keyword.toLowerCase()) b.keyword = `${b.keyword} ${b.name}`.slice(0, 60);

    const winner = /^b$/i.test(String(obj.winner || '').trim()) ? 'b' : 'a';

    return {
      title: (obj.title || question).slice(0, 90),
      hook: (obj.hook || 'HAVE YOU EVER THOUGHT').toString().toUpperCase().replace(/[^A-Z0-9 …?]/g, '').trim().slice(0, 30) || 'HAVE YOU EVER THOUGHT',
      question: (obj.question || question).toString().toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 46),
      a, b, winner,
      answer: String(obj.answer || '').trim().slice(0, 70),
      tags: (obj.tags || []).slice(0, 8),
      description: (obj.description || '').trim(),
      pinned_comment: (obj.pinned_comment || 'Which one would you pick? 👇').trim(),
    };
  }
  return null;
}

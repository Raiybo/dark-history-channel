import { chat, chatWithRetry } from './llm.js';
import { getDidYouKnowPrompt } from './genres/didyouknow.js';

const HOOK_THRESHOLD = 6;       // 1–10 scale, below this we regenerate
const MAX_HOOK_ATTEMPTS = 3;    // try a fresh script up to N times for a strong hook

// Score the hook 1–10 for scroll-stop power. We REJECT anything below threshold
// so weak hooks don't reach render. Failure (network/LLM error) defaults to a
// passing score — never block the pipeline on the judge itself.
async function judgeHook(hook) {
  if (!hook) return 0;
  const prompt = `You are a YouTube Shorts retention coach. Score this video HOOK on its scroll-stop power for the first 1.5 seconds of a Short.

HOOK: "${hook}"

Score 1–10:
- 1–4: generic, predictable, viewers will swipe
- 5–6: ok, some curiosity, average
- 7–8: strong — a real curiosity gap or shock value
- 9–10: extraordinary — the kind of opening that holds 70%+ retention

A strong hook makes a specific, surprising, concrete claim. Weak hooks are vague, abstract, or rely on words like "amazing"/"incredible"/"crazy" without saying what.

Reply with ONLY the integer score (1–10). Nothing else.`;
  try {
    const ans = (await chat(prompt, { temperature: 0, maxTokens: 256 })).trim();
    const n = parseInt(ans.match(/\d+/)?.[0] || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return HOOK_THRESHOLD; // judge unavailable → don't block
  }
}

async function generateOneScript(prompt) {
  // 4096 leaves headroom for Gemini's thinking tokens on top of the full script
  // JSON, so the response is never truncated into invalid JSON.
  const text = await chatWithRetry(prompt, { temperature: 0.85, maxTokens: 4096, json: true });
  // With json:true Groq returns strict JSON; still tolerate a wrapping match just in case.
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
    return JSON.parse(m[0]);
  }
}

export async function generateScript(idea) {
  const prompt = getDidYouKnowPrompt(idea.topic);

  // Try up to N times to get a script whose hook scores high enough on the
  // scroll-stop judge. Keep the best-scoring one in case all attempts fall short.
  let best = null;
  let bestScore = -1;
  for (let attempt = 1; attempt <= MAX_HOOK_ATTEMPTS; attempt++) {
    const script = await generateOneScript(prompt);
    const score = await judgeHook(script.hook_text);
    console.log(`  Hook judge: ${score}/10 — "${script.hook_text}"`);
    if (score > bestScore) { best = script; bestScore = score; }
    if (score >= HOOK_THRESHOLD) break;
    if (attempt < MAX_HOOK_ATTEMPTS) console.log(`  Hook too weak (${score}/${HOOK_THRESHOLD}), regenerating...`);
  }

  return { ...best, genre: idea.genre };
}

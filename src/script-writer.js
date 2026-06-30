import { chat, chatWithRetry } from './llm.js';
import { getDidYouKnowPrompt } from './genres/didyouknow.js';

const HOOK_THRESHOLD = 7;       // 1–10 scale, below this we regenerate (raised from 6 to lift first-2s retention)
const MAX_HOOK_ATTEMPTS = 3;    // try a fresh script up to N times for a strong hook

// Score the hook 1–10 for scroll-stop power. We REJECT anything below threshold
// so weak hooks don't reach render. Failure (network/LLM error) defaults to a
// passing score — never block the pipeline on the judge itself.
async function judgeHook(hook) {
  if (!hook) return 0;
  const prompt = `You are a YouTube Shorts retention coach. Score this video HOOK on its scroll-stop power for the first 1.5 seconds of a Short.

HOOK: "${hook}"

Score 1–10 on BOTH curiosity AND English quality. A hook scores LOW if EITHER fails — a strong fact phrased awkwardly is still a swipe.

- 1–4: generic, predictable, OR awkward English / dropped articles / telegraphic word-jamming ("DID YOU KNOW HONEY SPOILS NEVER", "DID YOU KNOW OCTOPUS THREE HEART"). Viewers will swipe.
- 5–6: average curiosity, English is fine but the claim is vague or relies on filler words like "amazing"/"incredible"/"crazy" without saying what.
- 7–8: strong — concrete surprising claim AND reads as a natural, grammatically clean sentence ("DID YOU KNOW THAT OCTOPUSES HAVE THREE HEARTS").
- 9–10: extraordinary — the kind of opening that holds 70%+ retention. Concrete, specific, surprising, and the sentence flows perfectly when read aloud.

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
  // 8192 gives ample headroom for Gemini/Groq thinking tokens plus the full
  // script JSON, so the response isn't truncated mid-output. Truncation was
  // causing intermittent "non-JSON" pipeline failures.
  const text = await chatWithRetry(prompt, { temperature: 0.85, maxTokens: 8192, json: true });
  try {
    return JSON.parse(text);
  } catch {
    // Try to salvage a complete JSON object out of a possibly-wrapped response.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export async function generateScript(idea) {
  const prompt = getDidYouKnowPrompt(idea.topic);

  // Try up to N times to get a script whose hook scores high enough on the
  // scroll-stop judge. Keep the best-scoring one in case all attempts fall short.
  // A JSON parse / LLM truncation failure on one attempt only skips THAT attempt
  // and lets the next attempt try fresh — it never kills the pipeline.
  let best = null;
  let bestScore = -1;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_HOOK_ATTEMPTS; attempt++) {
    let script;
    try {
      script = await generateOneScript(prompt);
    } catch (err) {
      lastError = err;
      console.log(`  Script attempt ${attempt} failed (${err.message.slice(0, 100)}), retrying fresh...`);
      continue;
    }
    const score = await judgeHook(script.hook_text);
    console.log(`  Hook judge: ${score}/10 — "${script.hook_text}"`);
    if (score > bestScore) { best = script; bestScore = score; }
    if (score >= HOOK_THRESHOLD) break;
    if (attempt < MAX_HOOK_ATTEMPTS) console.log(`  Hook too weak (${score}/${HOOK_THRESHOLD}), regenerating...`);
  }

  if (!best) throw lastError || new Error('All script-generation attempts failed');
  return { ...best, genre: idea.genre };
}

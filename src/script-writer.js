import { chatWithRetry } from './llm.js';
import { getDidYouKnowPrompt } from './genres/didyouknow.js';

export async function generateScript(idea) {
  const prompt = getDidYouKnowPrompt(idea.topic);
  // 4096 leaves headroom for Gemini's thinking tokens on top of the full script
  // JSON, so the response is never truncated into invalid JSON.
  const text = await chatWithRetry(prompt, { temperature: 0.85, maxTokens: 4096, json: true });

  // With json:true Groq returns strict JSON; still tolerate a wrapping match just in case.
  let script;
  try {
    script = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
    script = JSON.parse(m[0]);
  }

  return { ...script, genre: idea.genre };
}

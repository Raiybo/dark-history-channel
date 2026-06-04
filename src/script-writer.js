import { chatWithRetry } from './llm.js';
import { getDidYouKnowPrompt } from './genres/didyouknow.js';

export async function generateScript(idea) {
  const prompt = getDidYouKnowPrompt(idea.topic);
  const text = await chatWithRetry(prompt, { temperature: 0.85, maxTokens: 2048 });

  // The model may wrap the JSON in markdown or add prose; grab the JSON block.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`LLM returned non-JSON for script: ${text.slice(0, 200)}`);
  const script = JSON.parse(jsonMatch[0]);

  return { ...script, genre: idea.genre };
}

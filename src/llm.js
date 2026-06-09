// Single LLM client with provider switching + automatic fallback.
//
// Default provider is Gemini 2.5 Flash. It historically produced fresher, more
// surprising facts and punchier hooks than Groq/Llama — which is what drives
// retention and, in turn, organic growth. If a Gemini call fails for ANY reason
// (including the billing-dunning block that took the channel down on 2026-06-01),
// we AUTOMATICALLY fall back to Groq (Llama 3.3 70B) so the pipeline never hard-
// fails the way it did before.
//
//   LLM_PROVIDER=gemini  (default) — prefer Gemini, fall back to Groq
//   LLM_PROVIDER=groq             — prefer Groq, fall back to Gemini
//
// Set both GEMINI_API_KEY and GROQ_API_KEY so the fallback always has a path.

import { GoogleGenerativeAI } from '@google/generative-ai';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.5-flash';

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

async function callGemini(prompt, { temperature, maxTokens, json }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const result = await model.generateContent(prompt);
  return (result.response.text() || '').trim();
}

async function callGroq(prompt, { temperature, maxTokens, json }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const body = {
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Groq ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return (data.choices?.[0]?.message?.content || '').trim();
}

// Retry a single provider on transient errors (rate limit / 5xx / network).
// Hard errors (bad key, billing block, other 4xx) throw immediately so chat()
// can move on to the other provider without wasting time.
async function withRetry(fn, label, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      const transient = /(\b429\b|\b5\d\d\b|overloaded|unavailable|temporarily|ETIMEDOUT|ECONNRESET|fetch failed)/i.test(msg);
      if (!transient || i === retries - 1) throw err;
      const delay = 1500 * Math.pow(2, i);
      console.log(`  ${label} busy (${msg.slice(0, 80)}), retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function chat(prompt, opts = {}) {
  const o = { temperature: 0.9, maxTokens: 1024, json: false, ...opts };
  const order = PROVIDER === 'groq'
    ? [['Groq', callGroq], ['Gemini', callGemini]]
    : [['Gemini', callGemini], ['Groq', callGroq]];

  let lastErr;
  for (const [name, fn] of order) {
    try {
      return await withRetry(() => fn(prompt, o), name);
    } catch (err) {
      lastErr = err;
      console.log(`  ${name} unavailable (${(err.message || '').slice(0, 120)}); trying next provider...`);
    }
  }
  throw lastErr || new Error('All LLM providers failed');
}

// chat() already retries transient errors and falls back across providers, so
// the old chatWithRetry name is just an alias kept for existing call sites.
export const chatWithRetry = chat;

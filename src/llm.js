// Single LLM client. Uses Groq's OpenAI-compatible Chat Completions API.
// Switched off Gemini 2026-06 after Google's AI Studio free-tier traffic
// started being denied by their billing-dunning system across accounts.
//
// Free tier on Groq (Llama 3.3 70B): far more than enough for 6 reels/day.

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export async function chat(prompt, { temperature = 0.9, maxTokens = 1024, json = false } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };
  // json:true forces Groq to return strictly valid JSON (no markdown fences,
  // no truncation mid-string). Avoids the parse failures we hit on long scripts.
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return (data.choices?.[0]?.message?.content || '').trim();
}

// Retry on 429 (rate limit) and 5xx; surface 4xx (e.g., 401 bad key) immediately.
export async function chatWithRetry(prompt, opts = {}, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await chat(prompt, opts);
    } catch (err) {
      lastErr = err;
      const code = parseInt((err.message.match(/Groq (\d+)/) || [])[1] || '0', 10);
      const retryable = code === 429 || (code >= 500 && code < 600);
      if (!retryable || i === retries - 1) throw err;
      const delay = 1500 * Math.pow(2, i);
      console.log(`  LLM busy (${code || 'network'}), retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

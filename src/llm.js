// Single LLM client with provider switching + automatic fallback.
//
// Default provider is Gemini 2.5 Flash. It historically produced fresher, more
// surprising facts and punchier hooks than Groq — which is what drives
// retention and, in turn, organic growth. If a Gemini call fails for ANY reason
// (including the billing-dunning block that took the channel down on 2026-06-01),
// we AUTOMATICALLY fall back to Groq so the pipeline never hard-fails the way it
// did before.
//
//   LLM_PROVIDER=gemini  (default) — prefer Gemini, fall back to Groq
//   LLM_PROVIDER=groq             — prefer Groq, fall back to Gemini
//
// Set both GEMINI_API_KEY and GROQ_API_KEY so the fallback always has a path.
//
// 2026-09-16: `llama-3.3-70b-versatile` was decommissioned and every Groq call
// started returning 404 model_not_found, while the Gemini key had gone 401 — so
// BOTH providers were down and the pipeline could not have posted at all. The
// default is now qwen3.8-27b, which is the only model on the free tier that
// covers all three things this repo needs: text, strict JSON mode, and vision.
// Override with GROQ_MODEL if it is retired in turn; check the live list with
// `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models`.

// Both providers are called via their plain REST endpoints with the built-in
// fetch. We deliberately do NOT use the @google/generative-ai SDK: its fetch
// flaked intermittently ("Error fetching") in CI and locally, while direct REST
// calls were 100% reliable on the very same network and key.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || GROQ_MODEL;
// Images are far more token-hungry than text and the free tier allows only
// 7,000 input tokens/minute, so the Groq vision path sends fewer frames than
// Gemini's. Three spread across a clip is still enough to place the payoff.
const GROQ_VISION_FRAMES = Number(process.env.GROQ_VISION_FRAMES || 3);
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

async function callGemini(prompt, { temperature, maxTokens, json }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data.error || data).slice(0, 300)}`);
  return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
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
//
// If the error message includes a "try again in Xs" hint (Groq's rate-limit
// response does this), we HONOR that delay instead of the exponential default —
// otherwise the retry fires while the bucket is still empty and just burns
// another attempt.
async function withRetry(fn, label, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      const transient = /(\b429\b|\b5\d\d\b|overloaded|unavailable|temporarily|ETIMEDOUT|ECONNRESET|fetch failed)/i.test(msg);
      if (!transient || i === retries - 1) throw err;
      // Honor "Please try again in Xs" or similar hints (Groq TPM messages).
      const hinted = msg.match(/try again in\s*([\d.]+)\s*s/i);
      const capped = 30_000;
      let delay = 1500 * Math.pow(2, i);
      if (hinted) delay = Math.min(capped, Math.ceil(parseFloat(hinted[1]) * 1000) + 500);
      console.log(`  ${label} busy (${msg.slice(0, 80)}), retrying in ${(delay / 1000).toFixed(1)}s...`);
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

// Vision over one or more frames on Groq. This exists because vision used to be
// Gemini-only, which made it a single point of failure: when that key died the
// clip commentary silently degraded to reading filenames aloud. Both vision
// entry points below now fall through to here.
async function callGroqVision(base64Array, mimeType, prompt, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key || !base64Array?.length) return null;

  // Keep the newest/most spread-out frames but stay under the per-minute input
  // token cap; evenly sample rather than just truncating so we still see the
  // whole clip's arc.
  let frames = base64Array;
  if (frames.length > GROQ_VISION_FRAMES) {
    const step = (frames.length - 1) / (GROQ_VISION_FRAMES - 1);
    frames = Array.from({ length: GROQ_VISION_FRAMES }, (_, i) => base64Array[Math.round(i * step)]);
  }

  const body = {
    model: GROQ_VISION_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'text', text: prompt },
      ...frames.map(b => ({ type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${b}` } })),
    ] }],
    temperature: 0.4,
    max_tokens: maxTokens,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        // Groq says exactly how long the token bucket needs; guessing shorter
        // just burns the next attempt against an empty bucket.
        const hinted = (data.error?.message || '').match(/try again in\s*([\d.]+)\s*s/i);
        const wait = hinted ? Math.ceil(parseFloat(hinted[1]) * 1000) + 500 : 5000 * (attempt + 1);
        console.log(`  Groq vision rate-limited; waiting ${(wait / 1000).toFixed(1)}s and retrying...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.log(`  Groq vision unavailable (${res.status}: ${(data.error?.message || '').slice(0, 90)}).`);
        return null;
      }
      return (data.choices?.[0]?.message?.content || '').trim() || null;
    } catch (err) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      console.log(`  Groq vision call failed (${(err.message || '').slice(0, 80)}).`);
      return null;
    }
  }
  return null;
}

// Vision: describe what's happening in a single still frame. Used to write clip
// commentary from the actual footage instead of an opaque filename. Tries Gemini
// (2.5 Flash), then Groq, and returns null only if both are unavailable — the
// caller falls back to a generic line.
export async function describeImage(base64, mimeType, prompt, { maxTokens = 200 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return callGroqVision([base64], mimeType, prompt, maxTokens);
  const body = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
    ] }],
    // thinkingBudget: 0 — this is a one-line description, so spend the whole
    // output budget on the answer instead of hidden reasoning (which was
    // truncating the sentence).
    generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
  };
  // Retry on rate-limit / 5xx (the free tier's per-minute cap is easy to hit
  // when describing 5 clips back-to-back) so the commentary stays scene-accurate
  // instead of falling back to the filename.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        const wait = 5000 * (attempt + 1);
        console.log(`  Vision rate-limited (${res.status}); waiting ${wait / 1000}s and retrying...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.log(`  Gemini vision unavailable (${res.status}); trying Groq...`);
        return callGroqVision([base64], mimeType, prompt, maxTokens);
      }
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      return text || await callGroqVision([base64], mimeType, prompt, maxTokens);
    } catch (err) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      console.log(`  Gemini vision failed (${(err.message || '').slice(0, 80)}); trying Groq...`);
      return callGroqVision([base64], mimeType, prompt, maxTokens);
    }
  }
  return callGroqVision([base64], mimeType, prompt, maxTokens);
}

// Vision over MULTIPLE frames of one clip at once — lets the model both describe
// what's happening AND point to where the action/payoff is (so we can trim the
// dead seconds and keep the funny moment). base64Array = frames in time order.
// Same retry/fallback behavior as describeImage; returns raw text (JSON) or null.
export async function describeImages(base64Array, mimeType, prompt, { maxTokens = 320 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!base64Array?.length) return null;
  if (!key) return callGroqVision(base64Array, mimeType, prompt, maxTokens);
  const body = {
    contents: [{ parts: [
      { text: prompt },
      ...base64Array.map(b => ({ inline_data: { mime_type: mimeType || 'image/jpeg', data: b } })),
    ] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        const wait = 5000 * (attempt + 1);
        console.log(`  Vision rate-limited (${res.status}); waiting ${wait / 1000}s and retrying...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.log(`  Gemini vision unavailable (${res.status}); trying Groq...`);
        return callGroqVision(base64Array, mimeType, prompt, maxTokens);
      }
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      return text || await callGroqVision(base64Array, mimeType, prompt, maxTokens);
    } catch (err) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      console.log(`  Gemini vision failed (${(err.message || '').slice(0, 80)}); trying Groq...`);
      return callGroqVision(base64Array, mimeType, prompt, maxTokens);
    }
  }
  return callGroqVision(base64Array, mimeType, prompt, maxTokens);
}

// RAG grounding: fetch one primary-source URL per topic so every script has
// verifiable content behind it. Solves the two failure modes at once — LLM
// hallucination (40-80% without grounding) and the "AI slop" content flag
// (YouTube July 2025 policy) — because every claim ties to a real .gov, FTC,
// USDA, or CISA page the pipeline can point at.
//
// The genre file passes the LLM a topic seed + this module's fetched context,
// and constrains output to a "1 claim + 1 source URL + 1 action" script shape.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'");
}

// --- FTC consumer alerts (scams, refunds, dark patterns) ---
async function fetchFtcAlerts() {
  const res = await fetchWithTimeout('https://consumer.ftc.gov/consumer-alerts/feed', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`ftc ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    const desc = decodeEntities((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')
      .replace(/<[^>]+>/g, '').trim().slice(0, 500);
    return {
      source: 'ftc',
      authority: 'Federal Trade Commission',
      title,
      url: link,
      summary: desc,
    };
  }).filter(x => x.title && x.url);
}

// --- CISA cybersecurity alerts (phone scams, phishing, device security) ---
async function fetchCisaAlerts() {
  const res = await fetchWithTimeout('https://www.cisa.gov/news-events/cybersecurity-advisories/rss.xml', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`cisa ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    const desc = decodeEntities((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')
      .replace(/<[^>]+>/g, '').trim().slice(0, 500);
    return { source: 'cisa', authority: 'CISA', title, url: link, summary: desc };
  }).filter(x => x.title && x.url);
}

// --- Recalls.gov (product safety, medication, food, cars) ---
async function fetchRecalls() {
  const res = await fetchWithTimeout('https://www.cpsc.gov/Newsroom/News-Releases/rss', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`cpsc ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    return { source: 'cpsc', authority: 'CPSC (Consumer Product Safety Commission)', title, url: link, summary: '' };
  }).filter(x => x.title && x.url && /recall/i.test(x.title + x.url));
}

// --- IRS news (deadlines, credits, refunds people miss) ---
async function fetchIrsNews() {
  const res = await fetchWithTimeout('https://www.irs.gov/newsroom/xml/newsreleases.xml', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`irs ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    return { source: 'irs', authority: 'IRS', title, url: link, summary: '' };
  }).filter(x => x.title && x.url);
}

// --- USDA food safety (recalls + Ask USDA) ---
async function fetchUsdaSafety() {
  const res = await fetchWithTimeout('https://www.fsis.usda.gov/fsis-content/rss/recalls.xml', {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`usda ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    return { source: 'usda', authority: 'USDA FSIS', title, url: link, summary: '' };
  }).filter(x => x.title && x.url);
}

// Fetch every source, tolerate individual failures, round-robin interleave.
// Returns [{source, authority, title, url, summary}] — [] only if every
// source failed (idea-generator falls back to its seed pool in that case).
export async function fetchConsumerSources() {
  const settled = await Promise.allSettled([
    fetchFtcAlerts(),
    fetchCisaAlerts(),
    fetchRecalls(),
    fetchIrsNews(),
    fetchUsdaSafety(),
  ]);
  const names = ['ftc', 'cisa', 'cpsc', 'irs', 'usda'];
  const perSource = settled.map((s, i) => {
    if (s.status !== 'fulfilled') {
      console.log(`  Consumer sources: ${names[i]} unavailable (${(s.reason?.message || '').slice(0, 60)})`);
      return [];
    }
    console.log(`  Consumer sources: ${names[i]} → ${s.value.length} items`);
    return s.value;
  });
  const seen = new Set();
  const out = [];
  const longest = Math.max(0, ...perSource.map(a => a.length));
  for (let i = 0; i < longest; i++) {
    for (const arr of perSource) {
      const it = arr[i];
      if (!it) continue;
      const key = (it.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

// Fetch the actual body text of a source URL so the LLM has real content to
// ground its script on (not just the title). Returns the first ~4000 chars of
// text-content, or null on any failure.
export async function fetchSourceBody(url) {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 15000);
    if (!res.ok) return null;
    const html = await res.text();
    // Strip scripts, styles, nav — keep the readable body text.
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return decodeEntities(cleaned).slice(0, 4000);
  } catch {
    return null;
  }
}

// 90-day per-topic cooldown so the same source/topic never re-airs inside the
// window. Genre calls this before selecting a source.
export function isSourceOnCooldown(sourceUrl, used, days = 90) {
  const cutoff = Date.now() - days * 86400000;
  const needle = (sourceUrl || '').toLowerCase();
  if (!needle) return false;
  for (const u of used) {
    if (!u.date || new Date(u.date).getTime() < cutoff) continue;
    if (u.sourceUrl && u.sourceUrl.toLowerCase() === needle) return true;
  }
  return false;
}

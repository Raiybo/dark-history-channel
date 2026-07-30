// RAG grounding: fetch one primary-source URL per topic so every script has
// verifiable content behind it. Solves the two failure modes at once — LLM
// hallucination (40-80% without grounding) and the "AI slop" content flag
// (YouTube July 2025 policy) — because every claim ties to a real .gov, FTC,
// USDA, or CISA page the pipeline can point at.
//
// Every feed URL below was probed and confirmed live on 2026-07-30. Dead old
// URLs (IRS Newsroom XML, Recalls.gov RSS, Benefits.gov API) were retired —
// see the notes below each fetcher for what does and does not work today.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

function fetchWithTimeout(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Parse an RSS 2.0 feed body into {title, link, description} tuples. Handles
// CDATA sections and the common Drupal escape-in-CDATA pattern.
function parseRssItems(xml, maxItems = 20) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, maxItems);
  return items.map(m => {
    const block = m[1];
    const stripCdata = (s) => s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    const title = decodeEntities(stripCdata(((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim()));
    const link  = decodeEntities(stripCdata(((block.match(/<link>([\s\S]*?)<\/link>/)  || [])[1] || '').trim()));
    const desc  = decodeEntities(stripCdata(((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')))
      .replace(/<[^>]+>/g, '').trim().slice(0, 500);
    return { title, link, description: desc };
  }).filter(x => x.title && x.link);
}

// --- FTC Consumer Alerts (scams, refunds, dark patterns) — the highest-fit
// feed for this niche. RSS 2.0. The old /feeds/consumer_alerts.xml path is
// dead; the current path is /blog/gd-rss.xml. Note: <pubDate> is a
// human-readable string, not RFC 822 — we don't need it.
async function fetchFtcConsumerAlerts() {
  const res = await fetchWithTimeout('https://consumer.ftc.gov/blog/gd-rss.xml', {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`ftc-consumer ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, 20).map(x => ({
    source: 'ftc-consumer',
    authority: 'Federal Trade Commission — Consumer Alerts',
    title: x.title,
    url: x.link,
    summary: x.description,
  }));
}

// --- FTC Press Releases (corporate fines, settlements, dark-pattern rulings) ---
async function fetchFtcPressReleases() {
  const res = await fetchWithTimeout('https://www.ftc.gov/feeds/press-release.xml', {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`ftc-press ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, 15).map(x => ({
    source: 'ftc-press',
    authority: 'Federal Trade Commission — Press Releases',
    title: x.title,
    url: x.link,
    summary: x.description,
  }));
}

// --- CPSC recalls RSS. The path moved from /Recalls/rss to
// /Newsroom/CPSC-RSS-Feed/Recalls-RSS. Rich source, includes safety hazards.
async function fetchCpscRecalls() {
  const res = await fetchWithTimeout('https://www.cpsc.gov/Newsroom/CPSC-RSS-Feed/Recalls-RSS', {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`cpsc ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, 15).map(x => ({
    source: 'cpsc',
    authority: 'Consumer Product Safety Commission',
    title: x.title,
    url: x.link,
    summary: x.description,
  }));
}

// --- openFDA Food enforcement (recalls). JSON:API-shaped, always reachable,
// no key needed for low volume. Only downside: dry corporate wording, needs
// the LLM to translate to human-terms.
async function fetchFdaFoodEnforcement() {
  const url = 'https://api.fda.gov/food/enforcement.json?limit=15&sort=report_date:desc';
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`fda-food ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    source: 'fda-food',
    authority: 'FDA — Food Recall',
    title: `${r.recalling_firm || 'FDA'} recall: ${(r.product_description || '').slice(0, 90)}`,
    url: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts?search_api_fulltext=${encodeURIComponent(r.recall_number || '')}`,
    summary: [
      `Recalling firm: ${r.recalling_firm}`,
      `Reason: ${r.reason_for_recall}`,
      `Distribution: ${r.distribution_pattern}`,
      `Classification: ${r.classification} — ${r.status}`,
      `Report date: ${r.report_date}`,
    ].filter(Boolean).join(' | ').slice(0, 500),
  }));
}

// --- openFDA Drug enforcement (recalls). Same shape as food. Useful because
// pharmacy recalls affect millions of viewers directly.
async function fetchFdaDrugEnforcement() {
  const url = 'https://api.fda.gov/drug/enforcement.json?limit=10&sort=report_date:desc';
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`fda-drug ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => {
    const openfda = r.openfda || {};
    const brand = (openfda.brand_name || [])[0];
    const generic = (openfda.generic_name || [])[0];
    const label = brand || generic || (r.product_description || '').slice(0, 80);
    return {
      source: 'fda-drug',
      authority: 'FDA — Drug Recall',
      title: `${label} recall: ${(r.reason_for_recall || '').slice(0, 60)}`,
      url: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts?search_api_fulltext=${encodeURIComponent(r.recall_number || '')}`,
      summary: [
        `Product: ${r.product_description}`,
        `Reason: ${r.reason_for_recall}`,
        `Firm: ${r.recalling_firm}`,
        `Classification: ${r.classification} — ${r.status}`,
      ].filter(Boolean).join(' | ').slice(0, 500),
    };
  });
}

// --- CFPB Newsroom (consumer-finance enforcement, scam warnings, bank fines).
// The complaints database is Elasticsearch-shaped and slow for firehose use;
// the newsroom RSS is fast and consumer-facing.
async function fetchCfpbNewsroom() {
  const res = await fetchWithTimeout('https://www.consumerfinance.gov/about-us/newsroom/feed/', {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`cfpb ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, 15).map(x => ({
    source: 'cfpb',
    authority: 'Consumer Financial Protection Bureau',
    title: x.title,
    url: x.link,
    summary: x.description,
  }));
}

// --- CISA cybersecurity advisories. all.xml is 2MB and includes ICS content;
// filter to items whose URL is under /news-events/alerts/ or
// /news-events/cybersecurity-advisories/ so we get consumer-facing security
// content only (not industrial-control alerts).
async function fetchCisaAdvisories() {
  const res = await fetchWithTimeout('https://www.cisa.gov/cybersecurity-advisories/all.xml', {
    headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`cisa ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, 30)
    .filter(x => /\/news-events\/(alerts|cybersecurity-advisories)\//.test(x.link))
    .slice(0, 12)
    .map(x => ({
      source: 'cisa',
      authority: 'CISA',
      title: x.title,
      url: x.link,
      summary: x.description,
    }));
}

// Fetch every source, tolerate individual failures, round-robin interleave.
// Returns [{source, authority, title, url, summary}] — [] only if every
// source failed. Caller MUST handle the empty case loudly, not silently.
export async function fetchConsumerSources() {
  const settled = await Promise.allSettled([
    fetchFtcConsumerAlerts(),
    fetchFtcPressReleases(),
    fetchCpscRecalls(),
    fetchFdaFoodEnforcement(),
    fetchFdaDrugEnforcement(),
    fetchCfpbNewsroom(),
    fetchCisaAdvisories(),
  ]);
  const names = ['ftc-consumer', 'ftc-press', 'cpsc', 'fda-food', 'fda-drug', 'cfpb', 'cisa'];
  const perSource = settled.map((s, i) => {
    if (s.status !== 'fulfilled') {
      console.log(`  Consumer sources: ${names[i]} unavailable (${(s.reason?.message || '').slice(0, 80)})`);
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
  console.log(`  Consumer sources: ${out.length} unique candidates total`);
  return out;
}

// Fetch the actual body text of a source URL so the LLM has real content to
// ground its script on (not just the title). Returns the first ~4000 chars of
// text-content, or null on any failure.
export async function fetchSourceBody(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    }, 15000);
    if (!res.ok) return null;
    const html = await res.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
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

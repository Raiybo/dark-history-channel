// Day-to-day trend tracker. Pulls what the world is watching/searching RIGHT NOW
// from three independent, free, CI-safe sources and returns clean candidate
// subjects for trend-driven shorts:
//
//   1. Google Trends daily-search RSS (what the US is googling today)
//   2. Wikipedia most-viewed articles (what people are reading up on)
//   3. YouTube US trending chart (what's being watched — via the uploader OAuth)
//
// Reddit was live-tested and is IP-blocked (403) from datacenter runners, so it
// is deliberately NOT a source. Every fetcher is best-effort: 15s timeout and
// try/catch to [] — a dead source never breaks the pipeline, and if ALL sources
// fail the idea generator just falls back to evergreen topics.

import { buildYouTubeClient } from './uploader.js';

const WIKI_UA = 'DistoirTrends/1.0 (automated shorts pipeline; bot@distoir.auto)';
// Google serves datacenter IPs more reliably with a browser-like UA.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Subjects a curiosity/facts channel must NOT ride: politics, tragedy, crime,
// disasters, YMYL/health, adult. Trending news in these lanes is either
// suppressed for small channels or simply wrong for the brand. Stemmed with
// \w* so plurals/gerunds match too ("Deaths in 2026", "shootings", "killing
// of ..."), and includes disaster vocabulary ("houston weather" = storm news).
// Exported: the idea generator runs this SAME gate over the final LLM-written
// topic line, so prompt instructions are never the only content filter.
export const BLOCKED = /\b(politic\w*|elect\w*|president\w*|senat\w*|congress\w*|parliament\w*|minister\w*|trump|biden|vote\w*|voting|shoot\w*|gunman|murder\w*|stab\w*|kill\w*|die|dies|died|dying|death\w*|dead|deadly|fatal\w*|war|wars|warfare|invasion|airstrike\w*|missile\w*|bomb\w*|hostage\w*|terror\w*|crash\w*|victim\w*|suicide|overdose|cancer|tumor|vaccine\w*|covid|outbreak\w*|epidemic|pandemic|diet\w*|weight loss|ozempic|drug\w*|arrest\w*|indict\w*|lawsuit\w*|trial\w*|verdict\w*|sentenc\w*|divorce\w*|onlyfans|porn\w*|nsfw|hurricane\w*|tornado\w*|earthquake\w*|flood\w*|wildfire\w*|storm\w*|weather|disaster\w*|evacuat\w*|explosion\w*|derail\w*|collapse\w*|massacre\w*|genocide|famine|funeral|obituar\w*)\b/i;

// Trend titles are untrusted external text that gets interpolated into an LLM
// prompt — strip anything that could smuggle instructions or markup, and cap
// length so one weird title can't dominate the prompt.
export function sanitizeTrendTitle(s) {
  return (s || '')
    .replace(/[^a-zA-Z0-9 ,.'&:()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'");
}

function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// --- Source 1: Google Trends daily searches (unofficial RSS; may 429 in CI) ---
async function fetchGoogleTrends() {
  const res = await fetchWithTimeout('https://trends.google.com/trending/rss?geo=US', {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`google trends ${res.status}`);
  const xml = await res.text();
  const titles = [...xml.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>/g)]
    .map(m => decodeEntities(m[1]).trim()).filter(Boolean);
  return titles.map(title => ({ source: 'google', title }));
}

// --- Source 2: Wikipedia most-viewed articles (yesterday UTC; D-2 fallback) ---
async function fetchWikipediaTop() {
  // Filter namespace/utility pages only — real articles can contain ':'
  // (e.g. "Dune: Part Three"), so match known prefixes, not any colon.
  const NS = /^(Main_Page$|Special:|Wikipedia:|File:|Portal:|Help:|Talk:|User:|Template:|Category:|Draft:)/;
  for (const daysBack of [1, 2]) {
    const d = new Date(Date.now() - daysBack * 86400000);
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    try {
      const res = await fetchWithTimeout(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/${path}`,
        { headers: { 'User-Agent': WIKI_UA } }
      );
      if (!res.ok) continue; // data publishes a few hours after the UTC day ends
      const data = await res.json();
      return (data.items?.[0]?.articles || [])
        .filter(a => !NS.test(a.article))
        .slice(0, 25)
        .map(a => ({ source: 'wikipedia', title: a.article.replace(/_/g, ' ') }));
    } catch { /* try the previous day */ }
  }
  return [];
}

// --- Source 3: YouTube US trending chart (official API, 1 quota unit) ---
async function fetchYouTubeTrending() {
  const yt = buildYouTubeClient();
  const r = await yt.videos.list({
    part: ['snippet'], chart: 'mostPopular', regionCode: 'US', maxResults: 25,
  });
  return (r.data.items || []).map(i => ({ source: 'youtube', title: decodeEntities(i.snippet.title).trim() }));
}

// Fetch all sources concurrently, tolerate individual failures, sanitize,
// blocklist-filter, dedup — then ROUND-ROBIN interleave the sources. Callers
// cap the list (e.g. slice(0, 14)); with plain concatenation Google+Wikipedia
// alone would fill that cap and YouTube's titles would never surface, so
// interleaving is what keeps every live source represented.
// Returns [{source, title}] — [] only if every source failed.
export async function fetchTrendCandidates() {
  const settled = await Promise.allSettled([
    fetchGoogleTrends(),
    fetchWikipediaTop(),
    fetchYouTubeTrending(),
  ]);
  const names = ['google', 'wikipedia', 'youtube'];
  const seen = new Set();
  const perSource = settled.map((s, i) => {
    if (s.status !== 'fulfilled') {
      console.log(`  Trends: ${names[i]} unavailable (${(s.reason?.message || '').slice(0, 60)})`);
      return [];
    }
    console.log(`  Trends: ${names[i]} → ${s.value.length} items`);
    return s.value
      .map(c => ({ source: c.source, title: sanitizeTrendTitle(c.title) }))
      .filter(({ title }) => {
        const k = title.toLowerCase();
        if (!title || title.length < 3 || seen.has(k) || BLOCKED.test(title)) return false;
        seen.add(k);
        return true;
      });
  });
  const out = [];
  const longest = Math.max(0, ...perSource.map(a => a.length));
  for (let i = 0; i < longest; i++) {
    for (const arr of perSource) if (arr[i]) out.push(arr[i]);
  }
  return out;
}

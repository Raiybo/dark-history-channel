// AI-tools trend fetcher. Pulls what's HOT in the AI/tech world RIGHT NOW from
// free, CI-safe sources so every Short rides a fresh tool nobody's covered yet.
//
// Sources (all best-effort — a dead source never breaks the pipeline):
//   1. Product Hunt daily front page (top upvoted launches, AI-tagged)
//   2. GitHub Trending (this-week window; language filter surfaces AI repos)
//   3. Hacker News front page (community-vetted tech launches)
//   4. HuggingFace hot models RSS (model drops)
//
// Returns { name, url, source, description } items. Callers pick one, feed the
// URL to the screenshot fetcher, feed the name+description to the script writer.

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function fetchWithTimeout(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'");
}

// Product Hunt — no auth needed for the daily RSS feed.
async function fetchProductHunt() {
  const res = await fetchWithTimeout('https://www.producthunt.com/feed?category=artificial-intelligence', {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`producthunt ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
  return items.map(m => {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((block.match(/<link>([^<]+)<\/link>/) || [])[1] || '').trim();
    const desc = decodeEntities((block.match(/<description>([^<]+)<\/description>/) || [])[1] || '')
      .replace(/<[^>]+>/g, '').trim().slice(0, 240);
    return { name: title.split(' — ')[0].trim(), url: link, source: 'producthunt', description: desc };
  }).filter(i => i.name && i.url);
}

// GitHub Trending — pull the last-24h "trending" HTML page and parse repo names.
// Serves fine to datacenter IPs unauthenticated.
async function fetchGitHubTrending() {
  const res = await fetchWithTimeout('https://github.com/trending?since=daily', {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`github trending ${res.status}`);
  const html = await res.text();
  const items = [];
  // <h2 class="h3 ..."><a href="/owner/repo" ...>owner / repo</a></h2>
  const repoRegex = /<h2[^>]*class="h3[^"]*"[^>]*>\s*<a[^>]+href="\/([^"\/]+)\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = repoRegex.exec(html)) && items.length < 20) {
    const owner = match[1];
    const repo = match[2];
    const name = `${owner}/${repo}`;
    // Description follows the h2 in a <p class="col-9 ...">
    const afterH2 = html.slice(match.index, match.index + 3000);
    const descMatch = afterH2.match(/<p[^>]*class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch ? decodeEntities(descMatch[1]).replace(/<[^>]+>/g, '').trim().slice(0, 240) : '';
    // Filter: only surface AI/tech-adjacent repos
    const looksAI = /(ai|llm|gpt|agent|prompt|model|neural|ml|machine learning|tensor|diffusion|inference|embedding|langchain|langgraph|rag)/i;
    if (!looksAI.test(name) && !looksAI.test(description)) continue;
    items.push({
      name: repo.replace(/[-_]/g, ' '),
      url: `https://github.com/${owner}/${repo}`,
      source: 'github',
      description,
    });
  }
  return items;
}

// Hacker News front page — Algolia's HN search API is stable and CORS-open.
async function fetchHackerNews() {
  const res = await fetchWithTimeout('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30', {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`hn ${res.status}`);
  const data = await res.json();
  const looksAI = /(ai|llm|gpt|claude|gemini|openai|anthropic|agent|prompt|neural|ml\b|machine learning|diffusion|model|copilot|cursor|midjourney|stable diffusion|langchain|langgraph|rag|embedding|inference)/i;
  return (data.hits || [])
    .filter(h => h.title && h.url && looksAI.test(h.title))
    .slice(0, 15)
    .map(h => ({
      name: h.title.replace(/^Show HN:\s*/i, '').split(/[—–:|]/)[0].trim(),
      url: h.url,
      source: 'hackernews',
      description: (h.title.split(/[—–:|]/).slice(1).join(' ').trim() || '').slice(0, 240),
    }));
}

// HuggingFace new models feed.
async function fetchHuggingFace() {
  const res = await fetchWithTimeout('https://huggingface.co/models?sort=trending', {
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) throw new Error(`huggingface ${res.status}`);
  const html = await res.text();
  const items = [];
  const modelRegex = /<article[^>]*>\s*<a[^>]+href="\/([^"]+)"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/g;
  let match;
  while ((match = modelRegex.exec(html)) && items.length < 10) {
    const path = match[1];
    if (!path.includes('/')) continue;
    const name = decodeEntities(match[2]).replace(/<[^>]+>/g, '').trim();
    items.push({
      name: name || path.split('/').pop().replace(/[-_]/g, ' '),
      url: `https://huggingface.co/${path}`,
      source: 'huggingface',
      description: `Trending model on Hugging Face: ${name || path}`,
    });
  }
  return items;
}

// Round-robin interleave so no single source dominates the top of the list.
export async function fetchAiToolCandidates() {
  const settled = await Promise.allSettled([
    fetchProductHunt(),
    fetchGitHubTrending(),
    fetchHackerNews(),
    fetchHuggingFace(),
  ]);
  const names = ['producthunt', 'github', 'hackernews', 'huggingface'];
  const perSource = settled.map((s, i) => {
    if (s.status !== 'fulfilled') {
      console.log(`  AI trends: ${names[i]} unavailable (${(s.reason?.message || '').slice(0, 80)})`);
      return [];
    }
    console.log(`  AI trends: ${names[i]} → ${s.value.length} items`);
    return s.value;
  });
  const seen = new Set();
  const out = [];
  const longest = Math.max(0, ...perSource.map(a => a.length));
  for (let i = 0; i < longest; i++) {
    for (const arr of perSource) {
      const it = arr[i];
      if (!it) continue;
      const key = (it.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

// Duplicate-prevention slug for the 90-day cooldown per tool (per spec):
//   [ToolName]_[PrimaryFeature]_[TargetUseCase]
// Used-ideas.json entries store this so future runs can look it up.
export function buildSlug(toolName, primaryFeature, targetUseCase) {
  const clean = (s) => (s || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 40);
  return `${clean(toolName)}_${clean(primaryFeature)}_${clean(targetUseCase)}`;
}

// Has this tool been featured in the last 90 days? Cooldown check per spec.
export function isOnCooldown(toolName, used, days = 90) {
  const cutoff = Date.now() - days * 86400000;
  const needle = (toolName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!needle) return false;
  for (const u of used) {
    if (!u.date || new Date(u.date).getTime() < cutoff) continue;
    const tn = (u.toolName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tn && (tn === needle || tn.includes(needle) || needle.includes(tn))) return true;
  }
  return false;
}

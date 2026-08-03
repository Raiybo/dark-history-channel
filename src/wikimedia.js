// Fetch a REAL, legally-usable photo of a SPECIFIC named subject (the actual
// Three Gorges Dam, the actual Burj Khalifa…) from Wikipedia / Wikimedia
// Commons, together with the author + license so we can credit it. Only
// public-domain / CC0 / CC-BY / CC-BY-SA images are accepted — never non-free
// (NC/ND) or unknown. This is how the channel shows the actual subject legally,
// instead of ripping copyrighted clips off social platforms.

const UA = 'KingsOfRanksBot/1.0 (faceless YouTube Shorts; raybouhabib2005@gmail.com)';

function fetchJson(url, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: controller.signal })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .finally(() => clearTimeout(timer));
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();
}

// Read license + author for a Commons file and decide if it is free to use.
async function commonsLicense(fileName) {
  try {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + fileName)}`;
    const j = await fetchJson(api);
    const page = Object.values(j?.query?.pages || {})[0];
    const ext = page?.imageinfo?.[0]?.extmetadata;
    if (!ext) return null;
    const shortLic = ext.LicenseShortName?.value || '';
    const machineLic = (ext.License?.value || '').toLowerCase();
    const artist = stripHtml(ext.Artist?.value || '') || 'Wikimedia contributor';
    const isNonFree = /\bnc\b|\bnd\b|non[- ]?free|fair use|noncommercial/i.test(shortLic + ' ' + machineLic);
    const isPD = /public domain|cc0/i.test(shortLic) || /^(pd|cc0)/.test(machineLic) || machineLic.includes('public');
    const isCcBy = /cc[- ]?by(?:[- ]?sa)?/i.test(shortLic) || /^cc-by(-sa)?-/.test(machineLic);
    const free = (isPD || isCcBy) && !isNonFree;
    if (!free) return null;
    return {
      artist: artist.slice(0, 60),
      licenseShort: (shortLic || (isPD ? 'Public domain' : 'CC BY')).slice(0, 24),
      requiresAttribution: !isPD,
    };
  } catch {
    return null;
  }
}

// The lead image for a Wikipedia page (the most representative photo of the
// subject). Returns the original file URL + bare file name, raster photos only.
async function leadImageFor(title) {
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`;
  const j = await fetchJson(api);
  const page = Object.values(j?.query?.pages || {})[0];
  const url = page?.original?.source;
  if (!url || !/\.(jpe?g|png)$/i.test(url)) return null;   // skip SVG logos / diagrams
  const fileName = decodeURIComponent(url.split('/').pop());
  return { url, fileName };
}

// Public: best real photo of `subject` we may legally use, or null.
export async function fetchSubjectImage(subject) {
  const tryTitle = async (title) => {
    try {
      const img = await leadImageFor(title);
      if (!img) return null;
      const lic = await commonsLicense(img.fileName);
      if (!lic) return null;               // couldn't confirm a free license → skip
      return { url: img.url, subject, ...lic };
    } catch {
      return null;
    }
  };

  // 1) direct page title
  let hit = await tryTitle(subject);
  if (hit) return hit;

  // 2) search Wikipedia for the best-matching page, then its lead image
  try {
    const s = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(subject)}`;
    const j = await fetchJson(s);
    const title = j?.query?.search?.[0]?.title;
    if (title && title.toLowerCase() !== subject.toLowerCase()) {
      hit = await tryTitle(title);
      if (hit) return hit;
    }
  } catch { /* fall through */ }

  return null;
}

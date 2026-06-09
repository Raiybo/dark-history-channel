import { buildYouTubeClient } from './uploader.js';
import { chat } from './llm.js';

// Themed playlists boost session watch time: a viewer who finds one reel auto-
// plays the next in its theme. Themes are intentionally broad and few so every
// reel maps cleanly to exactly one — no decision paralysis for the LLM.
const THEMES = [
  { name: 'Animals & Nature', desc: 'Surprising facts about animals, plants, and the natural world.' },
  { name: 'Space & Astronomy', desc: 'Mind-blowing facts about space, stars, planets, and the universe.' },
  { name: 'The Human Body', desc: 'Fascinating facts about how your body and brain actually work.' },
  { name: 'History & Civilization', desc: 'Did you know? Surprising stories from history.' },
  { name: 'Science & Tech', desc: 'Counter-intuitive science, inventions, and technology facts.' },
  { name: 'Food & Everyday', desc: 'Strange truths about food, objects, and daily life.' },
  { name: 'Myths Busted', desc: 'Things you thought were true — that aren\'t.' },
];

const DEFAULT_THEME = 'History & Civilization';

// Find existing channel playlists by title and create any missing ones.
// Returns { themeName: playlistId } for all themes.
async function ensurePlaylists(youtube) {
  const map = {};
  // Pull all of the channel's playlists (max 50/page; we have <10 themes so 1 page is plenty)
  const res = await youtube.playlists.list({
    part: ['snippet'],
    mine: true,
    maxResults: 50,
  });
  const existing = new Map((res.data.items || []).map(p => [p.snippet.title, p.id]));

  for (const t of THEMES) {
    if (existing.has(t.name)) {
      map[t.name] = existing.get(t.name);
      continue;
    }
    const created = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title: t.name, description: t.desc, defaultLanguage: 'en' },
        status: { privacyStatus: 'public' },
      },
    });
    map[t.name] = created.data.id;
    console.log(`  Created playlist: "${t.name}"`);
  }
  return map;
}

// Ask the LLM which theme this script belongs to. Cheap (~50 tokens out).
async function pickTheme(script) {
  const topic = script?.title || script?.hook_text || '';
  if (!topic) return DEFAULT_THEME;
  const list = THEMES.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
  const prompt = `Classify this YouTube Short into EXACTLY ONE theme.

Theme options:
${list}

Short: "${topic}"

Reply with ONLY the theme name (one of the options above, copied verbatim). No explanation.`;
  try {
    const ans = (await chat(prompt, { temperature: 0, maxTokens: 80 })).trim();
    // The model might wrap in markdown or include a number; find a theme that matches.
    const matched = THEMES.find(t => ans.toLowerCase().includes(t.name.toLowerCase()));
    return matched ? matched.name : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

async function addToPlaylist(youtube, playlistId, videoId) {
  await youtube.playlistItems.insert({
    part: ['snippet'],
    requestBody: {
      snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
    },
  });
}

// Best-effort: classify the new video and add it to the matching themed
// playlist. Creates the playlist on first use. Logs everything; throws nothing
// (caller wraps in try/catch but we want the pipeline to never fail on this).
export async function addVideoToThemedPlaylist(videoId, script) {
  const youtube = buildYouTubeClient();
  try {
    const playlists = await ensurePlaylists(youtube);
    const theme = await pickTheme(script);
    const pid = playlists[theme];
    if (!pid) {
      console.log(`  Playlist lookup failed for "${theme}"`);
      return;
    }
    await addToPlaylist(youtube, pid, videoId);
    console.log(`  Added to playlist: "${theme}"`);
  } catch (err) {
    const msg = (err && err.message) || String(err);
    console.log(`  Skipped playlist add (${msg.slice(0, 140)})`);
  }
}

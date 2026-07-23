// AI Tools / Tech Hacks content generator per the NexusAI spec.
//
// Pulls trending AI tools daily, enforces a 90-day cooldown per tool, then asks
// the LLM to produce a 4-scene storyboard + 105-125 word script in the exact
// JSON shape the spec demands. Every scene names a URL and a viewport target;
// the screenshot fetcher (src/screenshots.js) turns those into real UI captures.

import { chat } from '../llm.js';
import { fetchAiToolCandidates, buildSlug, isOnCooldown } from '../trends-aitools.js';
import { BLOCKED, sanitizeTrendTitle } from '../trends.js';

// Voice preset for AI-tools content. Slightly faster than the Did-You-Know
// preset (+8% vs +4%) — tech tutorial viewers want info fast, and shorter beats
// keep the 45-second target hit without cutting content.
export const AI_TOOLS_VOICE = {
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+8%',
  pitch: '+0Hz',
};

// Pick a fresh trending tool that hasn't been covered in the last 90 days.
async function pickTool(used) {
  let candidates;
  try {
    candidates = await fetchAiToolCandidates();
  } catch (err) {
    console.log(`  AI tools: trend fetch failed (${err.message})`);
    return null;
  }
  if (!candidates.length) {
    console.log('  AI tools: no candidates from any source.');
    return null;
  }
  for (const c of candidates) {
    if (BLOCKED.test(c.name + ' ' + (c.description || ''))) continue;
    if (isOnCooldown(c.name, used, 90)) {
      console.log(`  AI tools: "${c.name}" is on 90-day cooldown, skipping.`);
      continue;
    }
    return c;
  }
  console.log('  AI tools: every candidate is on cooldown or filtered.');
  return null;
}

// Generate the storyboard + script for ONE tool. Returns the payload shape the
// rest of the pipeline (screenshot fetcher, renderer, uploader) consumes.
export async function generateAiToolsContent(used = []) {
  const tool = await pickTool(used);
  if (!tool) return null;
  console.log(`  AI tools: picked "${tool.name}" from ${tool.source}`);
  console.log(`    URL: ${tool.url}`);

  const prompt = `You are NexusAI, a content strategist for a viral AI-tools YouTube Shorts channel.
You just picked this trending tool to cover today:

TOOL NAME: ${tool.name}
TOOL URL: ${tool.url}
TREND SOURCE: ${tool.source}
DESCRIPTION HINT: ${tool.description || '(none — infer from name/URL)'}

Write a 35-45 second Short about this tool. Target 100-130 spoken words. The audience is US-based makers, founders, marketers, and productivity nerds who want the tool + how to use it in 40 seconds flat. Zero fluff, high curiosity, real workflow.

CRITICAL VISUAL RULE: this channel uses ONLY real UI screenshots — no stock footage, no AI art. Every scene names an exact URL that a headless browser can screenshot AND names WHICH part of the page to capture (hero, product, pricing, docs, features). If a scene can't be sourced from the tool's own website, DO NOT propose it.

SCRIPT ARCHITECTURE:
- [0:00–0:03] Hook — one of:
  A) "Stop using [OLD METHOD] until you see what [TOOL] can do."
  B) "This AI [CATEGORY] tool feels completely illegal to know about."
  C) "[COMPANY] just dropped an AI tool that does [TASK] in seconds."
- [0:03–0:12] Problem + immediate proof (real UI visible right away)
- [0:12–0:35] 2-step workflow: (1) what to click/type (2) what appears
- [0:35–0:45] Pricing transparency (free / freemium / paid) + CTA ("Comment [KEYWORD]" or "Save this")

Return ONLY valid JSON, no markdown, matching this exact schema:
{
  "tracking_slug": "ToolName_PrimaryFeature_TargetUseCase (letters/numbers only, underscores between the 3 parts, e.g. GammaAI_PresentationGen_Marketers)",
  "tool_name": "${tool.name}",
  "official_url": "${tool.url}",
  "primary_feature": "1-3 word feature the video is really about (e.g. 'presentation generation')",
  "target_audience": "3-6 words (e.g. 'students, marketers, founders')",
  "title": "YouTube title, UNDER 60 chars, hypey, MUST include the tool name and end with '#Shorts'",
  "hook_text": "on-screen hook headline, ALL CAPS, 5-9 words, no punctuation, matches Pattern A/B/C above",
  "narration": "the full spoken voiceover, 100-130 words. Open with the hook line VERBATIM as the first sentence (Title Case in narration is fine). Then problem + proof + workflow + pricing + CTA. Use ' || ' between beats for the TTS engine's breath gaps — 4 to 6 markers total. NO markdown, no dashes/parentheses/brackets. Casual American English, contractions OK.",
  "scenes": [
    {
      "url": "the URL to screenshot for this scene — MUST be a page that exists on the tool's own domain (homepage, /pricing, /features, /product, or a specific docs URL)",
      "area": "hero | product | pricing | features | docs | full — what part of the page to capture",
      "caption": "on-screen kinetic caption for this scene, ALL CAPS, UNDER 32 characters"
    }
  ],
  "description": "2 short sentences for the YouTube description. End with 'Links and workflow breakdowns in the pinned comment!'. NO hashtags — those are appended automatically.",
  "tags": ["5-7 tags, most specific first: tool name, category, use case, tech-hacks, ai-tools-2026"],
  "pinned_comment": "one short line inviting the CTA keyword the narration asked for, ending with 👇"
}

SCENE RULES:
- Exactly 4 scenes. Each covers a distinct beat: hook, workflow, output, pricing/CTA.
- Every scene URL MUST be on the tool's own domain (${new URL(tool.url).hostname} or its subdomains).
- Pick "area" honestly — if the pricing page is /pricing, say "pricing"; if just the homepage hero shows the price, use "hero".
- Captions escalate curiosity: each one adds a new hook that keeps the viewer through the next 10 seconds.

Return the JSON, nothing else.`;

  let obj;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await chat(prompt, { temperature: 0.8, maxTokens: 3500, json: true });
      try { obj = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
      if (obj?.narration && obj?.hook_text && Array.isArray(obj?.scenes) && obj.scenes.length >= 3) break;
      obj = null;
    } catch (err) {
      console.log(`  AI-tools script attempt ${attempt + 1} failed (${err.message.slice(0, 100)}), retrying...`);
    }
  }
  if (!obj) return null;

  // Same hard content gate the trend engine uses — block anything that slipped
  // past the LLM into politically-sensitive/tragedy/health territory.
  const allText = [
    obj.tool_name, obj.title, obj.hook_text, obj.narration, obj.description,
    ...(obj.scenes || []).map(s => s?.caption),
  ].filter(Boolean).join(' | ');
  if (BLOCKED.test(allText)) {
    console.log(`  AI-tools output tripped content filter for "${tool.name}"; skipping.`);
    return null;
  }

  // Force the tracking_slug to be a stable key we can dedupe on later.
  const slug = obj.tracking_slug ||
    buildSlug(tool.name, obj.primary_feature || 'core', obj.target_audience || 'makers');

  // Clean the narration — same rules TTS expects (no dashes, no brackets).
  const narration = (obj.narration || '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s*[—–-]\s*/g, ', ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const scenes = (obj.scenes || []).slice(0, 5).map(s => ({
    url: (s?.url || '').trim(),
    area: (s?.area || 'hero').toLowerCase().trim(),
    caption: sanitizeTrendTitle(s?.caption || '').toUpperCase().slice(0, 40),
  })).filter(s => s.url);

  return {
    genre: 'aitools',
    tracking_slug: slug,
    tool_name: tool.name,
    official_url: tool.url,
    data_source: tool.source,
    primary_feature: obj.primary_feature || '',
    target_audience: obj.target_audience || '',
    title: (obj.title || `${tool.name} — This AI Tool Changes Everything #Shorts`).slice(0, 90),
    hook_text: (obj.hook_text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
    narration,
    scenes,
    description: (obj.description || 'Links and workflow breakdowns in the pinned comment!').trim(),
    tags: (obj.tags || []).slice(0, 8),
    pinned_comment: (obj.pinned_comment || 'Want the link? Comment below and I\'ll drop it 👇').trim(),
  };
}

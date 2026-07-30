// Consumer Awareness / Rights / Scam Prevention genre.
//
// The core research finding: post-July-2025 YouTube ships an "inauthentic
// content" policy that specifically demonetizes AI-persona health/finance
// content, and heavily suppresses static-images-plus-TTS pipelines. The
// counter is (a) source-grounded scripts (RAG) so every claim ties to a
// primary source URL, (b) real motion instead of screenshots, (c) a niche
// that isn't in the YMYL crosshairs.
//
// This genre satisfies all three:
//   - Every script is grounded on ONE real .gov / FTC / CISA / IRS / USDA URL.
//   - Video motion comes from src/screencast.js (Puppeteer records the actual
//     source page with cursor + scroll), not static screenshots.
//   - Consumer awareness isn't classified as YMYL by YouTube's policy.

import { chat } from '../llm.js';
import { fetchConsumerSources, fetchSourceBody, isSourceOnCooldown } from '../sources.js';
import { BLOCKED, sanitizeTrendTitle } from '../trends.js';
import { MOTIONS } from '../screencast.js';

// Voice — same Andrew neural, slightly slower than aitools since consumer
// content leans investigative/authoritative not tech-hypey. Still faster than
// the old DYK preset (+6% vs +4%) so a 100-word script hits the 45s target.
export const CONSUMER_VOICE = {
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+6%',
  pitch: '+0Hz',
};

// Pick a fresh source that hasn't been covered in the last 90 days AND that
// looks like it maps to a "hidden fee / scam / benefit / recall" angle a
// consumer would actually care about.
async function pickSource(used) {
  let sources;
  try {
    sources = await fetchConsumerSources();
  } catch (err) {
    console.log(`  Consumer sources: fetch failed (${err.message})`);
    return null;
  }
  if (!sources.length) return null;

  for (const s of sources) {
    if (BLOCKED.test(s.title + ' ' + (s.summary || ''))) continue;
    if (isSourceOnCooldown(s.url, used, 90)) continue;
    return s;
  }
  return null;
}

// Generate the script + storyboard for ONE consumer topic.
export async function generateConsumerContent(used = []) {
  const source = await pickSource(used);
  if (!source) return null;

  console.log(`  Consumer: picked "${source.title}" from ${source.authority}`);
  console.log(`    URL: ${source.url}`);

  // Fetch actual body text so the LLM writes from real content, not just a title.
  const body = await fetchSourceBody(source.url);
  const bodyContext = body ? `\nSOURCE BODY (excerpt for grounding — cite specifics from here):\n${body.slice(0, 3000)}` : '';

  const prompt = `You write a viral "consumer awareness" YouTube Shorts channel. Every video reveals ONE thing that ETHICALLY affects a viewer's daily life — a hidden fee, a scam, a legal right, a government benefit, a product recall, a corporate dark pattern. The script MUST be grounded on the primary source below, not general knowledge.

SOURCE AUTHORITY: ${source.authority}
SOURCE TITLE: ${source.title}
SOURCE URL: ${source.url}${bodyContext}

Format is a 35-45 second Short in the SPLIT-SCREEN SLUDGE layout: top half shows a live browser recording of the source page (cursor scrolling, highlighting), bottom half is a muted satisfying loop (mowing, pressure washing, etc.). Voiceover tells the story on top of both.

RULES:
- Audience: American adults 25-55 who want to feel smarter AND save money / avoid getting scammed.
- Every specific claim in the narration MUST be verifiable from the SOURCE BODY above. If the source doesn't say something, DON'T say it.
- Include ONE specific number (dollar figure, percentage, deadline date, statute number) pulled from the source.
- Include a concrete ACTION the viewer can take today (visit a URL, check a form, request a refund, screenshot a message, forward to a number).
- Tone: an investigative friend who just found out and had to tell you. Not preachy, not fearmongering.
- 100-125 spoken words. 35-45 second target duration.
- NO medical/financial-advice framing. Never say "you should do X with your money/health". Instead: "here's the rule / here's the policy / here's the deadline — the .gov link is in the comments".

Return ONLY valid JSON, no markdown, matching this exact schema:
{
  "tracking_slug": "SourceAuthority_TopicKeyword_ActionType (letters/numbers only, underscores between the 3 parts, e.g. FTC_CarDealerFees_RefundRequest)",
  "primary_source_url": "${source.url}",
  "primary_source_authority": "${source.authority}",
  "topic_category": "one of: hidden_fees | scam_alert | consumer_right | gov_benefit | product_recall | dark_pattern",
  "title": "YouTube title UNDER 60 chars. Front-load the specific number/dollar/company/deadline. End with '#Shorts'. Examples: 'The $1,600 Car Fee Dealers Hide (2026) #Shorts', 'FTC Just Ruled This Refund Is Automatic #Shorts'.",
  "hook_text": "on-screen hook, ALL CAPS, 5-9 words, no punctuation. Must contain a specific number or dollar figure OR a named company/agency. Examples: 'DEALERS HIDE THIS 1600 DOLLAR FEE', 'THE FTC JUST BANNED THIS SCAM'.",
  "narration": "the full spoken voiceover, 100-125 words. Open with the hook line VERBATIM as the first sentence. Use ' || ' between beats for TTS breath gaps — 4 to 6 markers total. NO markdown, no dashes/parentheses/brackets. Reference the source explicitly ('the FTC just published...', 'according to the IRS page...'). End with a specific action + 'the .gov link is in the comment below'.",
  "top_scenes": [
    {
      "url": "REAL URL that Puppeteer can navigate. Scene 1 MUST be the primary source URL (${source.url}). Scenes 2-4 MUST introduce visual variety — a MIX of the primary source (with a different motion/scroll depth than scene 1) AND at least ONE companion page from the same agency or a related .gov page a viewer would need. Companion candidates: the agency's homepage (e.g. https://consumer.ftc.gov, https://www.ftc.gov, https://www.cpsc.gov, https://www.fda.gov, https://www.consumerfinance.gov, https://www.cisa.gov), the agency's 'report a scam / file a complaint' page (https://reportfraud.ftc.gov, https://www.consumerfinance.gov/complaint/, https://www.cisa.gov/report), or a related law/rule page. NEVER repeat the same URL more than twice across the four scenes.",
      "motion": "one of: landing | scrollDown | scrollScan | hoverSelector. STRICTLY REQUIRED: use a DIFFERENT motion for each of the 4 scenes so no two scenes look identical. Suggested mapping: scene 1 = landing (idle at top, hero visible), scene 2 = scrollDown (viewer sees deeper detail), scene 3 = landing on the companion page (fresh visual), scene 4 = scrollScan (back on the source, showing the fix/report path).",
      "seconds": 6-10 integer — how long the top-half recording of this scene should be,
      "caption": "on-screen kinetic caption, ALL CAPS, UNDER 32 chars"
    }
  ],
  "description": "2 short sentences for the description. End with 'Full source in the pinned comment 👇'. No hashtags.",
  "tags": ["5-7 tags most specific first: authority name, topic keyword, action, 'consumer awareness', 'scam alert 2026' etc"],
  "pinned_comment": "one short line inviting viewers to click the source URL, ending with 👇"
}

SCENE RULES:
- Exactly 4 scenes. Each 6-10 seconds. Total 32-40s of top-half footage (bottom sludge just loops underneath).
- Every scene URL must be reachable and relevant to the topic.
- Motion values MUST be one of the three keys: landing, scrollDown, scrollScan.

Return the JSON, nothing else.`;

  let obj;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await chat(prompt, { temperature: 0.7, maxTokens: 4000, json: true });
      try { obj = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null; }
      if (obj?.narration && obj?.hook_text && Array.isArray(obj?.top_scenes) && obj.top_scenes.length >= 3) break;
      obj = null;
    } catch (err) {
      console.log(`  Consumer script attempt ${attempt + 1} failed (${err.message.slice(0, 100)}), retrying...`);
    }
  }
  if (!obj) return null;

  // Hard content gate — never publish anything that slipped past the LLM into
  // the health/politics/tragedy zone even after all the guardrails above.
  const allText = [
    obj.title, obj.hook_text, obj.narration, obj.description,
    ...(obj.top_scenes || []).map(s => s?.caption),
  ].filter(Boolean).join(' | ');
  if (BLOCKED.test(allText)) {
    console.log(`  Consumer output tripped content filter for "${source.title}"; skipping.`);
    return null;
  }

  // Sanitize narration for TTS (same rules edge-tts expects).
  const narration = (obj.narration || '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s*[—–-]\s*/g, ', ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Map scene motion names to actual functions from the screencast module.
  // Belt-and-suspenders defenses against duplicate visuals:
  //   1) If the LLM handed us 4 identical URLs, replace slot 3 with a
  //      companion homepage inferred from the source URL's origin so the
  //      video shows at least TWO distinct pages instead of one page x4.
  //   2) Force MOTION diversity by rotating through a fixed motion cycle
  //      indexed by scene position, ignoring whatever the LLM proposed
  //      when it produces a monoculture (e.g. scrollScan on all 4).
  const MOTION_CYCLE = ['landing', 'scrollDown', 'landing', 'scrollScan'];
  const rawScenes = (obj.top_scenes || []).slice(0, 5).filter(s => s?.url);

  // Compute a companion URL from the source origin as a fallback (e.g.
  // https://consumer.ftc.gov/consumer-alerts/... → https://consumer.ftc.gov).
  let companionUrl = null;
  try {
    companionUrl = new URL(source.url).origin;
  } catch { /* invalid source URL — no companion */ }

  const urlCounts = new Map();
  const scenes = rawScenes.map((s, i) => {
    let url = (s.url || '').trim();
    // If this URL has already appeared twice, swap to the companion once.
    const seen = urlCounts.get(url) || 0;
    if (seen >= 2 && companionUrl && url !== companionUrl) {
      url = companionUrl;
    }
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
    // Pick the motion: prefer the LLM's choice, but if the LLM's motion
    // matches an EARLIER scene's motion, override with the cycle so no
    // two consecutive scenes ever use the same motion pattern.
    const proposed = s.motion && MOTIONS[s.motion] ? s.motion : null;
    const prev = i > 0 ? (rawScenes[i - 1].motion) : null;
    const motionName = (proposed && proposed !== prev) ? proposed : MOTION_CYCLE[i % MOTION_CYCLE.length];
    return {
      url,
      motion: MOTIONS[motionName] || MOTIONS.scrollScan,
      seconds: Math.max(5, Math.min(parseInt(s.seconds) || 8, 12)),
      caption: sanitizeTrendTitle(s.caption || '').toUpperCase().slice(0, 40),
    };
  });
  // Log the final URL diversity so failures are visible in the pipeline output.
  const uniqueUrlCount = new Set(scenes.map(s => s.url)).size;
  console.log(`  Scene URL diversity: ${uniqueUrlCount} unique URL(s) across ${scenes.length} scenes`);

  return {
    genre: 'consumer',
    tracking_slug: obj.tracking_slug || `${source.source}_${source.title.slice(0, 30)}`.replace(/[^a-z0-9]/gi, ''),
    sourceUrl: source.url,
    sourceAuthority: source.authority,
    topicCategory: obj.topic_category || 'consumer_right',
    title: (obj.title || source.title).slice(0, 90),
    hook_text: (obj.hook_text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
    narration,
    top_scenes: scenes,
    description: (obj.description || 'Full source in the pinned comment 👇').trim(),
    tags: (obj.tags || []).slice(0, 8),
    pinned_comment: (obj.pinned_comment || `Full source here 👇\n\n👉 ${source.url}`).trim(),
    official_url: source.url,   // uploader.js already appends this into the pinned comment for aitools
  };
}

export function getOptimizePrompt() {
  return `You are a content director for "Distoir" — a premium YouTube Shorts channel. Genre: "Optimization." Every video reveals one science-backed upgrade that makes people perform better, sleep better, think sharper, or live longer. The footage shows the story. The voice explains it. Every clip matches what's being said.

Pick the most surprising, counterintuitive, or under-known science-backed optimization hack. Must be grounded in real published research. Avoid tired topics (drink water, sleep 8 hours). Find the unexpected angle.

Return ONLY valid JSON, no markdown:

{
  "title": "Under 60 chars. Results-focused, specific numbers if possible. e.g. '10 Seconds That Add 5 Years to Your Life'",
  "description": "2-3 sentences. Direct, compelling. End with: #Optimization #Science #Performance #Distoir #Shorts",
  "tags": ["optimization", "science", "performance", "focus", "health", "life hack", "shorts", "distoir"],
  "hook_text": "MUST use one of these formulas: (1) shocking number e.g. 'YOUR FOCUS DROPS 40 PERCENT AFTER LUNCH', (2) thing everyone does wrong e.g. 'YOU BREATHE WRONG EVERY DAY', (3) impossible-sounding result e.g. 'TWO MINUTES TRIPLES YOUR MEMORY'. MAX 7 WORDS. ALL CAPS. No punctuation. Must feel like a personal revelation the viewer never knew they needed.",
  "narration": "Exactly 80-word narration. Open with hook verbatim. Narrate like a sarcastic coach — sharp, confident, zero patience for excuses. Act 1 (2 sentences): call out the relatable failure most people have, be specific and a little brutal. Act 2 (2-3 sentences): give the EXACT method with precise steps — what, when, how long, show the mechanism. Include the real study name. Act 3 (2 sentences): the measurable result. Final sentence: so wild they screenshot it. Max 7 words per sentence.",
  "scenes": [
    {"keyword": "pexels search query", "narration_moment": "first 1-2 sentences of narration", "duration": 5},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 5},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 5},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 5},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 4},
    {"keyword": "pexels search query", "narration_moment": "next 1-2 sentences", "duration": 5},
    {"keyword": "pexels search query", "narration_moment": "final sentences", "duration": 4}
  ]
}

SCENE RULES — critical:
- Exactly 12 scenes, 4-5 seconds each
- "keyword" = Pexels stock VIDEO search query. Real footage. 3-5 words max.
- "narration_moment" = exact part of narration playing — fill in accurately
- Keyword must show EXACTLY the subject being narrated — not mood, the SUBJECT
- If narrator says "afternoon energy crashes hit hard" → keyword: "person tired desk afternoon coffee"
- If narrator says "breathe out slowly for 8 seconds" → keyword: "woman deep breathing eyes closed"
- If narrator says "dopamine spikes 200 percent" → keyword: "brain scan dopamine neurons lighting"
- Vary shots: close-up face/body, action shot, environment, macro scientific, before/after
- No abstract descriptions. No mood words. Concrete subjects only.
- Portrait/vertical orientation`;
}

export const OPTIMIZE_VOICE = {
  name: 'en-US-AriaNeural',
  rate: '+12%',
  pitch: '+0Hz',
};

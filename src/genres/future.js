export function getFuturePrompt(topic) {
  return `You are a content director for "Distoir" — a premium YouTube Shorts channel. Genre: "Future-History." Every video reveals one invention, discovery, or turning point that silently reshaped how humans live. The footage tells the story. The voice explains it. They move together.

Topic: "${topic}"

All facts must be 100% accurate. Audience: 20-35 year olds who want to feel smarter after watching. Short sentences. Big revelations.

Return ONLY valid JSON, no markdown:

{
  "title": "Under 60 chars. Direct and intriguing. e.g. 'The Tiny Gear That Runs Every Machine'",
  "description": "2-3 sentences. Factual, compelling. End with: #History #FutureHistory #HowItWorks #Distoir #Shorts",
  "tags": ["history", "engineering", "how it works", "invention", "technology", "facts", "shorts", "distoir"],
  "hook_text": "MUST use one of these formulas — pick whichever fits: (1) shocking number nobody believes e.g. 'THIS GEAR RUNS 4 BILLION MACHINES', (2) visceral contradiction e.g. 'YOUR BRAIN LIES TO YOU DAILY', (3) impossible scale e.g. 'ONE WIRE POWERS A BILLION HOMES'. MAX 7 WORDS. ALL CAPS. No punctuation. The viewer must feel they just learned something that changes how they see the world. First word must create instant shock.",
  "narration": "Exactly 110-word narration. Open with the hook verbatim. Then 3 clear acts — (1) How painful life was BEFORE this: 2-3 vivid sentences, specific hardships. (2) The moment it changed — simple, clear, one concrete analogy the viewer already understands. (3) The jaw-dropping scale of impact: real numbers, real places, real change. Final sentence must be so wild the viewer wants to share it. Pure spoken prose. Max 9 words per sentence. No lists. No filler words.",
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
- "narration_moment" = the exact part of the narration playing during this scene — fill this in accurately
- Keyword must show EXACTLY what is being SAID in narration_moment — not the mood, the SUBJECT
- If narrator says "factories needed waterwheels" → keyword: "historical watermill water wheel turning"
- If narrator says "two wire coils transfer energy" → keyword: "copper wire coil electrical transformer"
- If narrator says "powers a billion homes" → keyword: "city aerial night lights power"
- Vary shots: close-up detail, person in action, wide establishing, aerial, macro object
- No abstract descriptions. No mood words. Concrete subjects only.
- Portrait/vertical orientation`;
}

export const FUTURE_VOICE = {
  name: 'en-US-Neural2-F',
  gender: 'FEMALE',
  speakingRate: 0.94,
  pitch: -0.5,
};

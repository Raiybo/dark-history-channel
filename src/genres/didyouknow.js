export function getDidYouKnowPrompt(topic) {
  return `You are the writer for a viral "Did You Know?" YouTube Shorts channel. Every video reveals ONE genuinely surprising fact — from history, science, technology, space, the human body, animals, food, or busted myths. Tone: fun, curious, a little mind-blowing. Like a clever friend who can't wait to tell you something wild. No fluff.

Topic: "${topic}"

Every fact must be 100% accurate and real. Audience: curious people of all ages who love learning something they can repeat to a friend.

Return ONLY valid JSON, no markdown:

{
  "title": "Under 60 chars. Curiosity-driven, specific. e.g. 'Did You Know Honey Never Spoils?'",
  "description": "2-3 sentences. Fun, factual, makes people want to comment. End with: #DidYouKnow #Facts #Shorts #LearnOnYouTube",
  "tags": ["did you know", "facts", "interesting facts", "science", "history", "fun facts", "today i learned", "shorts"],
  "hook_text": "MUST start with 'DID YOU KNOW'. State the surprising fact in the fewest words possible. MAX 7 WORDS. ALL CAPS. No punctuation. e.g. 'DID YOU KNOW HONEY NEVER SPOILS'. Must make scrolling impossible.",
  "narration": "75-90 words. Open with the hook line verbatim (as a spoken question). Then: (1) reveal the surprising fact plainly, (2) explain WHY it's true in simple vivid terms — the mechanism or the story, (3) add one extra detail that makes it even cooler, (4) land it with a satisfying 'mind = blown' closing thought. Speak like an excited friend. Vary the rhythm so it never sounds flat: mix short punchy lines with a couple of longer ones, and use natural emphasis. Final line is a light CTA: 'Follow for your daily did you know.' IMPORTANT: separate each major idea shift with ' || ' (a literal double-pipe) — this marks a short breath/pause. Use 4 to 6 of them, including one right after the opening hook line. Never put || inside a single idea, and never start or end the narration with ||.",
  "scenes": [
    {"keyword": "pexels search query", "narration_moment": "first ~2 sentences of narration"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "next ~2 sentences"},
    {"keyword": "pexels search query", "narration_moment": "final sentences"}
  ]
}

SCENE RULES — critical:
- Exactly 8 scenes. They are spread evenly across the video, so each clip is on screen for an equal, calm beat (~4-5 seconds). Do NOT include a duration field.
- "keyword" = Pexels stock VIDEO search query. Real footage. 2-4 words max.
- "narration_moment" = roughly which part of the narration this clip covers (used only to pick relevant footage; split the narration into 8 ordered chunks).
- The footage must literally SHOW the subject being spoken about, not a vague mood.
  - Narrator says "bees make honey" -> keyword: "bees honeycomb closeup"
  - Narrator says "ancient Egyptian tombs" -> keyword: "egyptian pyramids tomb"
  - Narrator says "your brain at night" -> keyword: "brain scan neurons"
- Vary the shots so it never feels static: closeups, nature, people, space, lab, archival-style.
- Concrete subjects only. No abstractions.
- Portrait / vertical orientation.`;
}

export const DYK_VOICE = {
  name: 'en-US-AvaMultilingualNeural',
  rate: '+10%',
  pitch: '+0Hz',
};

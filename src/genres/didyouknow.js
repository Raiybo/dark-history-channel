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
  "narration": "Exactly 80-90 words. Open with the hook line verbatim (as a spoken question). Then: (1) reveal the surprising fact plainly, (2) explain WHY it's true in simple vivid terms — the mechanism or the story, (3) add one extra detail that makes it even cooler, (4) land it with a satisfying 'mind = blown' closing thought. Speak like an excited friend, warm and clear. Final line is a light CTA: 'Follow for your daily did you know.' Max 8 words per sentence.",
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
- Exactly 12 scenes, 4-5 seconds each.
- "keyword" = Pexels stock VIDEO search query. Real footage. 2-4 words max.
- "narration_moment" = the EXACT words from the narration spoken during this scene (copy them verbatim, in order, no overlap). These are used to sync the footage to the voice — they must match the narration text exactly.
- The footage must literally SHOW the subject being spoken about, not a vague mood.
  - Narrator says "bees make honey" -> keyword: "bees honeycomb closeup"
  - Narrator says "ancient Egyptian tombs" -> keyword: "egyptian pyramids tomb"
  - Narrator says "your brain at night" -> keyword: "brain scan neurons"
- Vary the shots so it never feels static: closeups, nature, people, space, lab, archival-style.
- Concrete subjects only. No abstractions.
- Portrait / vertical orientation.`;
}

export const DYK_VOICE = {
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+8%',
  pitch: '+0Hz',
};

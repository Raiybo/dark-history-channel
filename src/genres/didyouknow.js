export function getDidYouKnowPrompt(topic) {
  return `You are the writer for a viral "Did You Know?" YouTube Shorts channel. Every video reveals ONE genuinely surprising fact — from history, science, technology, space, the human body, animals, food, or busted myths. Tone: fun, curious, a little mind-blowing. Like a clever friend who can't wait to tell you something wild. No fluff.

Topic: "${topic}"

Every fact must be 100% accurate and real. Audience: curious people of all ages who love learning something they can repeat to a friend.

Return ONLY valid JSON, no markdown:

{
  "title": "UNDER 50 characters so YouTube never truncates it. Lead with the most curiosity-driving words; you do NOT need a 'Did You Know' prefix. e.g. 'Honey Never Spoils — Here's Why' or 'Goldfish Remember for Months?!'",
  "description": "2-3 fun, factual sentences that tease the surprise, ending with a short question that makes people want to comment. Do NOT add hashtags — they are appended automatically.",
  "tags": "Array of 5-8 tags that are SPECIFIC to THIS fact's subject, NOT generic. Order them most-specific-first — the first 3 become the hashtags shown above the title, so they must name the actual subject, place, animal, person, or field in this fact. For a fact about honey: [\"honey\",\"bees\",\"food science\",\"honey never spoils\",\"beekeeping\"]. For the Great Wall: [\"great wall of china\",\"china history\",\"ancient engineering\",\"world wonders\"]. Do NOT include generic tags like 'facts', 'did you know', 'shorts', or 'trivia' — those are appended automatically. Multi-word phrases are encouraged.",
  "hook_text": "MUST start with 'DID YOU KNOW THAT' and read as ONE complete, grammatically clean English sentence — subject, verb, surprising claim. ALL CAPS for visual punch but the words themselves must flow naturally when spoken aloud. 7-12 WORDS. No punctuation. NO telegraphic word-jamming or dropped articles. Use 'THAT' to join the claim. Use proper noun/verb agreement. Examples (good — read smoothly): 'DID YOU KNOW THAT OCTOPUSES HAVE THREE SEPARATE HEARTS', 'DID YOU KNOW THAT WOMBAT POOP COMES OUT CUBE SHAPED', 'DID YOU KNOW THAT YOUR TONGUE PRINT IS UNIQUE LIKE A FINGERPRINT'. Examples (BAD — awkward, jammed, or missing words): 'DID YOU KNOW HONEY SPOILS NEVER', 'DID YOU KNOW WOMBATS CUBES POOP', 'DID YOU KNOW OCTOPUS HEART THREE'. The hook is also spoken by the narrator as the literal first sentence — if it sounds clunky read aloud, rewrite it.",
  "pinned_comment": "One short, friendly question (UNDER 100 chars) the channel pins to spark replies — ask viewers for their reaction or a related guess. End with 👇. No hashtags. e.g. 'Did this one catch you off guard? 👇'",
  "narration": "60-75 words MAX — shorter Shorts get watched to the end, and completion rate is the #1 signal that makes the algorithm push a video. OPEN with the hook line verbatim (Title Case OK in narration, but the wording must be IDENTICAL to hook_text). The opening sentence must read as natural spoken English — never robotic, never word-jammed. Then in the VERY NEXT breath state the surprising VISUAL payoff (what we are about to SEE) so the viewer never waits for it. Then explain WHY it is true in vivid, concrete, simple words and add ONE extra detail that makes it cooler. Short punchy sentences, high energy, like an excited friend. END on a tight line that loops back to the opening idea so a rewatch feels natural, with a 2-3 word follow nudge baked in — e.g. 'Nature hides more like this. Follow for more.' Keep the outro SHORT; long endings get skipped. Use plain spoken words and simple punctuation only (no dashes, parentheses, or symbols — they make the voice stumble). IMPORTANT: separate each idea shift with ' || ' (a literal double-pipe) marking a short breath. Use 4 to 6 of them, including one right after the opening hook line. Never put || inside a single idea, and never start or end the narration with ||.",
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
- Exactly 8 scenes. They are spread evenly across the video (~4-5s each). Do NOT include a duration field.
- "keyword" = a Pexels stock VIDEO search query (2-4 words). Pexels has GENERIC stock — it does NOT have specific named people, branded products, or specific historical events. So:
  - DO NOT search for specific people: "Steve Jobs" -> use "tech ceo presenting"; "Napoleon" -> "general on horseback battlefield"; "Mark Zuckerberg" -> "young man hoodie laptop".
  - DO NOT search for specific events: "Black Plague" -> "medieval village dark"; "Watergate" -> "1970s washington dc"; "Wall Street crash" -> "stock market screens red".
  - DO NOT search for branded products: "iPhone" -> "smartphone in hand"; "Coca-Cola" -> "soda glass bottle".
  - Always use the GENERIC visual surrogate — era, setting, occupation, object type, mood.
- "narration_moment" = the EXACT words from the narration this clip plays over. Split the FULL narration into 8 equal, in-order chunks (chunk 1 = the first ~1/8 of the words, chunk 8 = the last) and quote each chunk verbatim. They must cover the whole narration with no gaps or overlap.
- AUDIO-VISUAL SYNC IS CRITICAL: each scene is shown on screen exactly while its narration_moment is being SPOKEN. So scene i's keyword MUST depict the literal concrete subject the narrator says in chunk i. Walk through the narration in order: when a chunk says "the crab never ages", that scene's keyword is "crab closeup"; when a chunk says "the sun is a giant ball of plasma", that scene's keyword is "sun surface closeup". The viewer must SEE the thing at the same moment they HEAR it. Choose the keyword from the MAIN concrete noun in that chunk.
- SCENE 1 IS THE MOST IMPORTANT: it must show the single most striking, instantly-recognizable shot of the reveal's core subject IMMEDIATELY — the visual that proves the hook. Never a slow or abstract establishing shot; the payoff visual must be on screen in the first second.
- Each keyword must be DISTINCT (no two scenes asking for the same footage).
- Examples of GOOD keywords by theme:
  - Dark history: "medieval castle interior dim", "old battlefield smoke", "ancient ruins night", "victorian london street fog"
  - Famous people (use occupation/era surrogates): "billionaire signing documents", "tech ceo presenting stage", "scientist lab microscope", "athlete stadium crowd"
  - Money / power: "stock market trading screens", "luxury yacht ocean", "wall street skyscrapers", "private jet runway"
  - Psychology: "person thinking close up", "crowd watching presentation", "brain scan animation", "two people conversation"
- Vary the shots so it never feels static: closeups, wide shots, people, places, objects.
- Concrete visual subjects only. No abstractions.
- Portrait / vertical orientation.`;
}

export const DYK_VOICE = {
  // +10% slurred words; +4% keeps energy while staying crisp and clear.
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+4%',
  pitch: '+0Hz',
};

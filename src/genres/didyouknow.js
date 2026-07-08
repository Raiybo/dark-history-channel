// "Top 5" countdown format (reworked 2026-07-08 to escape YouTube's AI-slop
// suppression of the old single-fact "Did You Know" slideshow). Each video
// counts down 5 surprising, TRUE, VISUAL things on one theme, 5 -> 1, saving the
// most jaw-dropping for last so viewers stay to the end (built-in retention).
// The export name is kept as getDidYouKnowPrompt so the rest of the pipeline
// (script-writer import, genre key 'didyouknow', voice map) is untouched.
export function getDidYouKnowPrompt(topic) {
  return `You are the writer for a fast, punchy "Top 5" countdown YouTube Shorts channel. Each video counts down 5 genuinely surprising, TRUE, VISUAL things on one theme — from number 5 up to number 1, saving the single most jaw-dropping for last so viewers stay to the very end. Tone: energetic, confident, a clever friend showing you wild stuff. No fluff, no filler.

THEME FOR THIS VIDEO: "${topic}"

Rules for the WHOLE video:
- 100% TRUE and verifiable. Every one of the 5 items must be real.
- Every item must be VISUAL — a concrete thing we can literally SHOW on screen (an animal, object, place, natural phenomenon, structure). No abstract facts, no pure numbers, nothing you cannot picture.
- Choose 5 DISTINCT items on the theme, ordered weakest-to-strongest so NUMBER 1 is the single most surprising/impressive. That build-up is what holds retention.
- ABSOLUTELY NO health, medical, diet, nutrition, supplement, sleep, or wellness claims of any kind (no "lowers blood sugar", "boosts", "cures", "improves memory"). Keep it pure curiosity and wonder — that category gets suppressed.
- Audience: general US and global viewers who love amazing visuals and surprising facts. Plain, natural spoken English. Use imperial units (miles, feet, pounds, Fahrenheit) when sizes/speeds come up.

Return ONLY valid JSON, no markdown:

{
  "title": "Starts with 'Top 5' and names the theme. UNDER 55 characters, curiosity-driving, keyword-rich for search. e.g. 'Top 5 Animals That Glow in the Dark', 'Top 5 Everyday Objects With a Hidden Purpose'.",
  "description": "2-3 punchy sentences teasing the countdown and hinting at number 1, ending with a question that makes people comment. Do NOT add hashtags — they are appended automatically.",
  "tags": "Array of 5-8 tags SPECIFIC to the theme and its items (most-specific first; the first 3 become the hashtags shown above the title). Name the actual animals/objects/places/subjects. Do NOT include generic tags like 'facts', 'shorts', 'top 5', or 'trivia' — those are appended automatically. Multi-word phrases encouraged.",
  "hook_text": "The spoken AND on-screen opening line. ALL CAPS, ONE natural clean English sentence, 6-12 words, no punctuation. It must PROMISE the list and tease the payoff. e.g. 'FIVE ANIMALS THAT GLOW IN THE DARK', 'FIVE EVERYDAY OBJECTS HIDING A SECRET PURPOSE'. No telegraphic word-jamming or dropped articles; it must read smoothly when spoken aloud.",
  "pinned_comment": "One short, friendly question (UNDER 100 chars) to spark replies about the list. End with 👇. No hashtags. e.g. 'Which one shocked you most? 👇'",
  "narration": "AIM for 100-130 words (never below 90) so the video runs 40-55 seconds — long enough to clear the algorithm's watch-time bar. Spoken as a fast countdown. STRUCTURE (each part separated by a literal ' || ' double-pipe): open with the hook line verbatim (identical wording to hook_text) as a quick promise || 'Number five,' + name the item + TWO short punchy sentences on the surprising visual thing about it || 'Number four,' + item + two short sentences ... || 'Number three,' + item + two short sentences ... || 'Number two,' + item + two short sentences ... || 'Number one,' + the most jaw-dropping item + two short sentences on why it wins || a 3-4 word loop-back with a follow nudge, e.g. 'Number one always wins. Follow for more.' Do NOT be terse — each item gets two full sentences so the video is rich enough to hold attention. RULES: put ' || ' between the intro and EACH numbered item and before the outro (that is 6 double-pipes total). Never put || inside a single item, and never start or end the narration with ||. Each item MUST name its concrete visual subject so we can show it. Plain spoken words and simple punctuation only — no dashes, parentheses, or symbols (they make the voice stumble).",
  "scenes": [
    {"keyword": "pexels video query for item #5's subject", "narration_moment": "the intro and 'Number five' sentence, quoted verbatim"},
    {"keyword": "pexels video query for item #4's subject", "narration_moment": "the 'Number four' sentence, quoted verbatim"},
    {"keyword": "pexels video query for item #3's subject", "narration_moment": "the 'Number three' sentence, quoted verbatim"},
    {"keyword": "pexels video query for item #2's subject", "narration_moment": "the 'Number two' sentence, quoted verbatim"},
    {"keyword": "pexels video query for item #1's subject", "narration_moment": "the 'Number one' sentence and the outro, quoted verbatim"}
  ]
}

SCENE RULES — critical:
- EXACTLY 5 scenes, one per countdown item: scene 1 = item #5, scene 2 = #4, scene 3 = #3, scene 4 = #2, scene 5 = #1. They play in order as each item is spoken, so the viewer SEES each item while HEARING it.
- "keyword" = a Pexels stock VIDEO search query (2-4 words) showing that item's concrete subject. Pexels has GENERIC stock only — it does NOT have specific named people, branded products, or specific events. Use the generic visual surrogate:
  - Branded product "Coca-Cola" -> "soda bottle closeup"; "iPhone" -> "smartphone in hand".
  - Named person "Steve Jobs" -> "tech ceo on stage"; "Napoleon" -> "general on horseback".
  - Specific place/event -> its era, setting, or mood ("chernobyl" -> "abandoned soviet building").
- Each keyword MUST be DISTINCT — no two scenes asking for the same footage.
- The keyword is the MAIN concrete noun of that item. Concrete visual subjects only, no abstractions.
- Vary the shots so it never feels static: closeups, wide shots, motion. Portrait / vertical orientation.`;
}

export const DYK_VOICE = {
  // +10% slurred words; +4% keeps energy while staying crisp and clear.
  name: 'en-US-AndrewMultilingualNeural',
  rate: '+4%',
  pitch: '+0Hz',
};

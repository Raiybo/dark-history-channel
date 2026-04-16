import { GoogleGenerativeAI } from '@google/generative-ai';

async function withRetry(fn, retries = 5, delayMs = 15000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message.includes('503') || err.message.includes('overloaded') || err.message.includes('temporarily') || err.message.includes('unavailable');
      if (isRetryable && i < retries - 1) {
        console.log(`  Model busy, retrying in ${delayMs / 1000}s... (attempt ${i + 2}/${retries})`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

export async function generateScript(idea) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are writing a narration script for the YouTube channel "Dark Chronicles" — a channel that takes REAL, serious historical events and narrates them entirely in Gen Alpha / Brainrot internet slang.

THE CONCEPT: The contrast between serious, disturbing history and absurd internet slang IS the comedy and the hook. Historical facts must be accurate. The slang makes it go viral.

BRAINROT VOCABULARY (mix these naturally throughout — do not force every word, make it flow):
- Rizz / No rizz / Negative rizz (charm, charisma or lack of it)
- Sigma / Alpha / Beta (dominant, successful, or weak person)
- Skibidi (weird, chaotic, unhinged behavior)
- Ohio / Pure Ohio energy (cursed, bizarre, wrong)
- Gyatt / Gyattdamn (expression of shock or disbelief)
- NPC (someone acting mindlessly, following orders)
- Mewing / Looksmaxxing (self-improvement, optimizing appearance)
- W / L / Massive L / Taking an L (win or loss)
- Based (admirable, respectable, doing what you want)
- Delulu (completely delusional)
- Glazing (over-praising, simping for someone)
- Understood the assignment / Missed the assignment entirely
- No cap (no lie, for real, seriously)
- It's giving... (it resembles, the vibes are)
- Caught an L / Took the biggest L in history
- Main character energy / NPC energy
- Fanum tax (taking someone's resources, food, land)
- Aura / Lost all their aura / Aura points
- Lowkey / Highkey
- Cooked (in serious trouble, ruined, finished)
- Ate and left no crumbs (executed perfectly)
- Ratio'd (publicly humiliated or defeated)
- Slay / Slayed (performed excellently)
- Era (a phase or period — "his villain era", "her redemption era")
- Bussin (excellent, incredible)
- Fr fr (for real for real — emphasis)
- On god (I swear, absolutely)
- Touch grass (go outside, disconnected from reality)
- The audacity (disbelief at someone's behavior)
- Not him/her doing X (sarcastic disbelief)
- Bestie (addressing the audience or a historical figure)
- Main character syndrome (thinking you are the center of everything)
- Mid (mediocre, average)
- Rent free (living in someone's head)

EXAMPLE HOOKS:
- "King Louis XVI had absolutely zero rizz, negative aura, and it cost him his entire head, no cap."
- "Napoleon was a certified sigma grindset king until Russia said 'nah, you're cooked bestie.'"
- "The Black Death was giving pure Ohio energy and nobody had the rizz to stop it."
- "Vlad the Impaler was NOT mewing, he was NOT looksmaxxing, he was just fully cooked in the head fr fr."

Story brief:
- Topic: ${idea.topic}
- Specific angle: ${idea.angle}
- Opening hook: ${idea.hook}
- Era: ${idea.era}
- Location: ${idea.location}

Write a full narration script divided into 12 chapters. Each chapter: 120-150 words, full brainrot slang, but real historical facts underneath. Write as if a chronically online Gen Alpha is narrating a serious documentary.

Return ONLY valid JSON with no markdown, no code fences:

{
  "title": "YouTube title in brainrot style, max 70 chars (e.g. 'The French Revolution But King Louis Had Zero Rizz')",
  "description": "YouTube description 3-4 sentences mixing brainrot and real history. End with: #DarkHistory #BrainrotHistory #GenAlpha #History",
  "tags": ["brainrot history", "dark history", "gen alpha history", "skibidi history", "add 6 more specific tags"],
  "chapters": [
    {
      "heading": "Chapter heading in brainrot style (e.g. 'The NPC Era Begins', 'Main Character Loses Aura')",
      "narration": "Full narration 120-150 words mixing Gen Alpha slang with real history. Pure spoken prose, no asterisks, no stage directions."
    }
  ]
}

Rules:
- Chapter 1 MUST begin with this hook (rewritten in brainrot style): "${idea.hook}"
- Write exactly 12 chapters
- Every chapter must have at least 4-5 brainrot slang terms used naturally
- Historical facts must be accurate — the slang is the delivery, not the content
- Tone: unhinged Gen Alpha narrator who somehow knows everything about history
- End the final chapter reflecting on what this means for history — but in brainrot terms`;

  const script = await withRetry(async () => {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Gemini returned non-JSON for script`);
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.chapters || parsed.chapters.length !== 12) {
      throw new Error(`Expected 12 chapters, got ${parsed.chapters?.length}`);
    }
    return parsed;
  });

  return script;
}

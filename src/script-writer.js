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

  const prompt = `You write scripts for a YouTube Shorts channel explaining how things work using Gen Alpha brainrot slang. Each Short is exactly 60 seconds when spoken at normal pace.

CONCEPT: Take a fascinating real scientific or everyday explanation and deliver it in brainrot Gen Alpha language. The facts must be 100% accurate. The slang makes it entertaining and shareable.

BRAINROT VOCABULARY (use naturally, not forced):
rizz, sigma, ohio, skibidi, gyatt, NPC, mewing, based, delulu, cooked, slay, bussin, glazing, no cap, it's giving, caught an L, main character energy, fanum tax, aura, lowkey, highkey, fr fr, mid, era, bestie, on god, ratio, understood the assignment

Topic: "${idea.topic}"
Angle: "${idea.angle}"
Hook: "${idea.hook}"

Write a single 150-word narration script. Structure:
1. Hook (first 2 sentences) — opens with the hook, immediately surprising
2. Explanation (middle) — the actual science/explanation in brainrot terms, simple and clear
3. Mind-blow ending (last 2 sentences) — the most shocking fact, ends with a call to follow

Rules:
- Exactly 150 words (counts as ~60 seconds at speaking pace)
- Use at least 6 brainrot slang terms naturally
- Facts must be scientifically accurate
- No chapter headings, no stage directions — pure narration only
- End with "Follow for daily facts that hit different." or similar brainrot CTA

Return ONLY valid JSON, no markdown:

{
  "title": "YouTube Shorts title with brainrot flair, max 60 chars, include #Shorts",
  "description": "2-3 sentence description mixing brainrot and real explanation. End with: #Shorts #HowThingsWork #LearnOnTikTok #Science #BrainrotFacts",
  "tags": ["shorts", "how things work", "brainrot", "science", "facts", "gen alpha", "add 4 more relevant tags"],
  "narration": "The full 150-word script as a single paragraph of spoken prose."
}`;

  const script = await withRetry(async () => {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Gemini returned non-JSON for script`);
    return JSON.parse(jsonMatch[0]);
  });

  return script;
}

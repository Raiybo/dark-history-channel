import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateScript(idea) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const prompt = `You are writing a narration script for the YouTube channel "Dark Chronicles" — a channel that tells true, disturbing, and forgotten stories from history with a serious, atmospheric tone.

Story brief:
- Topic: ${idea.topic}
- Specific angle: ${idea.angle}
- Opening hook: ${idea.hook}
- Era: ${idea.era}
- Location: ${idea.location}

Write a full narration script divided into 8 chapters. Each chapter should be 100-150 words of tight, gripping prose. No filler. No hedging. Write as if narrating a documentary.

Return ONLY valid JSON with no markdown, no code fences:

{
  "title": "Final YouTube video title (max 70 chars)",
  "description": "YouTube video description, 3-4 sentences summarizing the story. End with: #DarkHistory #TrueHistory #History",
  "tags": ["dark history", "true history", "historical mysteries", "add 7 more specific tags"],
  "chapters": [
    {
      "heading": "Chapter heading (3-6 words, atmospheric)",
      "narration": "Full narration text for this chapter, 100-150 words, no stage directions, pure spoken prose."
    }
  ]
}

Rules:
- Chapter 1 MUST begin with the exact hook: "${idea.hook}"
- Write exactly 8 chapters
- Each chapter narration is spoken aloud — no parenthetical, no asterisks, no formatting
- Tone: serious, haunting, documentary — not sensationalist
- End the final chapter with reflection on what this story means for history`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini returned non-JSON for script`);

  const script = JSON.parse(jsonMatch[0]);

  if (!script.chapters || script.chapters.length !== 8) {
    throw new Error(`Expected 8 chapters, got ${script.chapters?.length}`);
  }

  return script;
}

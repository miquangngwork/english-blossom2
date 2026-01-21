import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LEVEL_MAP: Record<number, string> = {
  1: "A1", 2: "A1", 3: "A2", 4: "A2", 
  5: "B1", 6: "B1", 7: "B2", 8: "B2", 9: "C1",
};

export const difficultyToCefrLevel = (difficulty: number) => {
  return LEVEL_MAP[Math.min(9, Math.max(1, Math.round(difficulty)))] ?? "A1";
};

export type AIQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  skillTag: "vocab" | "grammar";
};

function normalizeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const cleaned = options
    .map((opt) => String(opt ?? "").trim())
    .filter(Boolean);
  // Keep order but drop duplicates (case-insensitive)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const opt of cleaned) {
    const key = opt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(opt);
  }
  return unique;
}

function parseAIQuestion(data: any): AIQuestion {
  if (!data || typeof data !== "object") throw new Error("Invalid AI format");
  const question = String(data.question ?? "").trim();
  const options = normalizeOptions(data.options);
  const skillTag = data.skillTag === "grammar" ? "grammar" : "vocab";

  if (!question) throw new Error("Missing question");
  if (options.length < 4) throw new Error("Not enough options");

  // Prefer exact correctAnswer, else allow correctIndex.
  let correctAnswer = String(data.correctAnswer ?? "").trim();
  const correctIndex = Number.isInteger(data.correctIndex) ? Number(data.correctIndex) : null;

  if (!correctAnswer && correctIndex !== null && correctIndex >= 0 && correctIndex < options.length) {
    correctAnswer = options[correctIndex]!;
  }

  if (!correctAnswer) throw new Error("Missing correctAnswer");

  // Ensure correctAnswer matches one of options (case-insensitive).
  const matchIdx = options.findIndex((o) => o.toLowerCase() === correctAnswer.toLowerCase());
  if (matchIdx === -1) throw new Error("correctAnswer not in options");
  correctAnswer = options[matchIdx]!;

  // Use first 4 options for consistent UI.
  const trimmedOptions = options.slice(0, 4);
  // If correctAnswer got sliced out (rare), swap it back in.
  if (!trimmedOptions.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
    trimmedOptions[0] = correctAnswer;
  }

  return {
    question,
    options: trimmedOptions,
    correctAnswer,
    skillTag,
  };
}

export async function generateQuestion(difficulty: number): Promise<AIQuestion> {
  const level = difficultyToCefrLevel(difficulty);

  // SỬA PROMPT: Ép AI tập trung vào Vocabulary in Context
  const prompt = `
    Generate ONE multiple-choice English question for Level ${level}.

    STRICT REQUIREMENTS:
    - **FOCUS**: 90% Vocabulary (word choice, collocations, phrasal verbs in context), 10% Grammar.
    - **TYPE**: Fill-in-the-blank sentence with exactly ONE blank: "_____".
    - Provide EXACTLY 4 options.
    - All 4 options must be plausible; only ONE is correct.
    - correctAnswer MUST be one of the options (exact match).
    - Options MUST be in a random order (do NOT always put the correct answer first).

    OUTPUT JSON ONLY:
    {
      "question": "The sentence with a _____ to fill.",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "correctIndex": 1,
      "skillTag": "vocab"
    }
  `;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const content = res.choices[0]?.message?.content || "{}";
      const data = JSON.parse(content);
      return parseAIQuestion(data);
    } catch (error) {
      console.error(`Placement AI Error (attempt ${attempt}):`, error);
    }
  }

  return {
    question: "The view from the top of the mountain was _____.",
    options: ["breathless", "breathtaking", "breathing", "breath"],
    correctAnswer: "breathtaking",
    skillTag: "vocab",
  };
}
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

export async function generateQuestion(difficulty: number): Promise<AIQuestion> {
  const level = difficultyToCefrLevel(difficulty);

  // SỬA PROMPT: Ép AI tập trung vào Vocabulary in Context
  const prompt = `
    Generate ONE multiple-choice English question for Level ${level}.
    
    STRICT REQUIREMENT:
    - **FOCUS**: 90% Vocabulary (Word choice, Collocations, Phrasal Verbs in context), 10% Grammar.
    - **TYPE**: Fill-in-the-blank sentences where the user must choose the word that fits the meaning best.
    - **CONSTRAINT**: Do NOT ask simple grammar rules like "verb tenses" unless it changes the meaning significantly.
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "question": "The sentence with a _____ to fill.",
      "options": ["OptionA", "OptionB", "OptionC", "OptionD"],
      "correctAnswer": "OptionA",
      "skillTag": "vocab"
  export async function generateQuestion(difficulty: number, usedQuestions: string[] = []): Promise<AIQuestion> {
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, 
      temperature: 0.8, // Tăng độ sáng tạo một chút
    });

    const content = res.choices[0]?.message?.content || "{}";
    const data = JSON.parse(content);
    
    if (!data.question || !Array.isArray(data.options)) throw new Error("Invalid AI format");

    return {
        question: data.question,
        options: data.options,
        correctAnswer: data.correctAnswer,
        skillTag: data.skillTag || "vocab"
    };

  } catch (error) {
    console.error("Placement AI Error:", error);
    return {
        question: "The view from the top of the mountain was _____.",
        options: ["breathtaking", "breathless", "breathing", "breath"],
        correctAnswer: "breathtaking",
        skillTag: "vocab"
    };
  }
}
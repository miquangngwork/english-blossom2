import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const generateGameData = async (words: string[], level: string) => {
  if (!words || words.length === 0) return null;

  // Lấy tối đa 12 từ để làm game cho đa dạng (Matching cần ít nhất 4, WordHunt cần 6)
  const selectedWords = words.sort(() => 0.5 - Math.random()).slice(0, 12);

  console.log(`[GAME-AI] Generating games for words: ${selectedWords.join(", ")}`);

  const prompt = `
    Role: Game Content Generator.
    Input Words: ${JSON.stringify(selectedWords)}.
    Level: ${level}.

    Task: Generate JSON data for 3 mini-games using ONLY the input words.

    GAME 1: "matching" (4 pairs)
    - Create 4 pairs of word + definition/synonym (Vietnamese meaning is preferred for A1-B1).
    - Format: { "id": 1, "term": "English Word", "match": "Vietnamese Meaning" }

    GAME 2: "wordHunt" (Grid generation data)
    - Select 6 words from input.
    - Convert them to UPPERCASE.
    - Format: { "words": ["WORD1", "WORD2"], "gridSize": 10 } (Frontend will generate the grid).

    GAME 3: "speedMatch" (10 questions)
    - Create 10 rapid-fire questions.
    - Mixed TRUE (Word matches Meaning) and FALSE (Word matches WRONG Meaning).
    - Format: { "word": "...", "meaning": "...", "isCorrect": true/false }

    OUTPUT JSON ONLY:
    {
      "matching": [...],
      "wordHunt": { "words": [...] },
      "speedMatch": [...]
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = res.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (e) {
    console.error("Game AI Error:", e);
    return null;
  }
};
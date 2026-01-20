import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface UserContext {
  level: string;
  interests: string[];
  goal: string;
  occupation?: string;
}

export interface VocabItem {
  word: string;
  meaning: string;
  definition?: string;
  example?: string;
  ipa?: string;
  type?: string;
}

const getTargetLevel = (currentLevel: string): string => {
  const map: Record<string, string> = {
    "A1": "A1-A2", "A2": "B1-B2", "B1": "B2-C1",
    "B2": "C1", "C1": "C1-C2", "C2": "C2"
  };
  return map[currentLevel] || "B1";
};

// 1. HÀM TẠO BỘ TỪ VỰNG
export const generateVocabDeck = async (
  userId: string,
  context: UserContext,
): Promise<VocabItem[]> => {
  const baseTopic = context.interests.length > 0 
    ? context.interests[Math.floor(Math.random() * context.interests.length)] 
    : "General Life";
  const targetLevel = getTargetLevel(context.level);
  const REQUEST_QTY = 25;

  console.log(`[AI-VOCAB] User ${userId} | Topic: ${baseTopic} | Fetching ${REQUEST_QTY} words...`);

  const prompt = `
    Role: English Teacher.
    Task: 
    1. Pick a specific NICHE MICRO-TOPIC based on "${baseTopic}".
    2. Generate exactly ${REQUEST_QTY} words/idioms for this micro-topic.

    Profile: Level ${context.level} -> Target ${targetLevel}. Occupation: ${context.occupation || "Student"}.

    RULES FOR SPEED & QUALITY:
    - **Quantity**: ${REQUEST_QTY} words (Strict).
    - **Examples**: MUST be short (under 10 words).
    - **Meaning**: Vietnamese.
    - **Variety**: Nouns, Verbs, Adjectives.
    
    OUTPUT JSON:
    {
      "microTopic": "Chosen Topic Name",
      "words": [
        {
          "word": "Resilient",
          "type": "adj",
          "ipa": "/rɪˈzɪl.jənt/",
          "meaning": "Kiên cường", 
          "example": "She remained resilient despite the crisis."
        }
      ]
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 1.0, 
    });

    const content = res.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);

    if (Array.isArray(result.words)) return result.words;
    if (Array.isArray(result.vocabulary)) return result.vocabulary;
    return [];
  } catch (e) {
    console.error("[AI-VOCAB] Error calling OpenAI:", e);
    return [];
  }
};

// 2. HÀM TẠO CÂU HỎI TEST
export const generateTestQuestions = async (words: string[]) => {
  if (!words || words.length === 0) return [];
  
  // Nếu số từ ít (< 5), ta nhân bản lên để đủ tạo 20 câu hỏi
  let targetList = [...words];
  while (targetList.length < 20) {
      targetList = targetList.concat(words);
  }
  // Lấy 20 từ (có thể lặp lại nếu danh sách gốc ngắn)
  const selectedWords = targetList.sort(() => 0.5 - Math.random()).slice(0, 20);

  console.log(`[AI-TEST] Generating 20 questions from ${words.length} source words...`);

  const prompt = `
    Role: Professional English Examiner.
    Task: Create EXACTLY 20 Multiple Choice Questions (MCQ) to test these words: ${JSON.stringify(words.slice(0, 15))}.
    
    REQUIREMENTS:
    1. **Quantity**: EXACTLY 20 questions.
    2. **Type**: Fill-in-the-blank sentences (Contextual usage).
    3. **Language**: Questions in English. **Explanations in VIETNAMESE**.
    4. **Format**: JSON only.

    EACH QUESTION MUST HAVE:
    - "question": The sentence with "_____" blank.
    - "options": Array of 4 words (A, B, C, D).
    - "correctAnswer": The correct word (must be one of the options).
    - "explanation": Vietnamese text explaining WHY the answer is correct (grammar/context).
    - "meanings": Object mapping each option to its Vietnamese meaning.

    JSON OUTPUT EXAMPLE:
    {
      "questions": [
        {
          "question": "She showed great _____ during the difficult times.",
          "options": ["resilience", "happy", "run", "blue"],
          "correctAnswer": "resilience",
          "explanation": "Câu này cần một danh từ chỉ phẩm chất tích cực trong hoàn cảnh khó khăn. 'Resilience' (sự kiên cường) là phù hợp nhất về ngữ nghĩa.",
          "meanings": {
             "resilience": "Sự kiên cường",
             "happy": "Vui vẻ (Tính từ - sai từ loại)",
             "run": "Chạy (Động từ - sai)",
             "blue": "Màu xanh (Không hợp nghĩa)"
          }
        }
      ]
    }
  `;
  
  try {
      const res = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Dùng 4o-mini để xử lý context dài tốt hơn 3.5
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.8
      });
      
      const data = JSON.parse(res.choices[0]?.message?.content || "{}");
      
      // Validation: Đảm bảo có questions
      if (!data.questions || !Array.isArray(data.questions)) return [];
      
      return data.questions;
  } catch (e) {
      console.error("[AI-TEST] Error:", e);
      return [];
  }
};
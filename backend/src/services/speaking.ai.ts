import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const cleanJson = (text: string) => text.replace(/```json/g, "").replace(/```/g, "").trim();

// ... (Hàm evaluateIelts giữ nguyên như cũ) ...
export const evaluateIelts = async (question: string, transcript: string) => {
    const prompt = `
    Role: Official IELTS Speaking Examiner.
    Task: Assess the candidate response using the provided IELTS Speaking Band Descriptors.

    Question: "${question}"
    Transcript: "${transcript}"

    BAND DESCRIPTORS (SOURCE):
    Band 9
    - FC: Fluent with only very occasional repetition or self-correction. Any hesitation is for content, not language. Cohesion fully acceptable. Topic development fully coherent and appropriately extended.
    - LR: Total flexibility and precise use in all contexts. Sustained accurate and idiomatic language.
    - GRA: Structures precise and accurate at all times, apart from native-speaker-like slips.
    - P: Full range of phonological features for precise/subtle meaning. Connected speech sustained. Effortlessly understood. Accent has no effect.

    Band 8
    - FC: Fluent with only very occasional repetition/self-correction. Occasional word/grammar search. Coherent and relevant topic development.
    - LR: Wide resource, flexible. Skilful use of less common/idiomatic items despite occasional inaccuracies. Effective paraphrase.
    - GRA: Wide range, flexible. Majority error-free. Occasional inappropriacies/non-systematic errors; a few basic errors may persist.
    - P: Wide range of phonological features. Sustains rhythm, stress, intonation across long utterances with occasional lapses. Easily understood; minimal accent effect.

    Band 7
    - FC: Long turns without noticeable effort. Some hesitation/repetition/self-correction, often mid-sentence, but coherence maintained. Flexible use of discourse markers.
    - LR: Flexible resource for variety of topics. Some less common/idiomatic items with inappropriacies. Effective paraphrase.
    - GRA: Range of structures, frequent error-free sentences. Simple and complex sentences used effectively despite some errors. A few basic errors persist.
    - P: Shows all positive features of band 6 and some (not all) of band 8.

    Band 6
    - FC: Keeps going; willingness to produce long turns. Coherence may be lost due to hesitation/repetition/self-correction. Uses a range of discourse markers but not always appropriately.
    - LR: Sufficient to discuss topics at length. Inappropriate use may occur but meaning is clear. Generally able to paraphrase.
    - GRA: Mix of short/complex forms; variety with limited flexibility. Errors frequent in complex structures but rarely impede communication.
    - P: Range of phonological features with variable control. Chunking generally appropriate; rhythm may be affected. Some intonation/stress not sustained. Mispronunciation causes occasional lack of clarity. Generally understood without much effort.

    Band 5
    - FC: Usually keeps going but relies on repetition/self-correction/slow speech. Hesitations for basic lexis/grammar. Overuses discourse markers. Complex speech causes disfluency.
    - LR: Sufficient for familiar/unfamiliar topics but limited flexibility. Attempts paraphrase with mixed success.
    - GRA: Basic forms fairly well controlled. Complex structures attempted but limited and error-prone; may require reformulation.
    - P: Shows all positives of band 4 and some of band 6.

    Band 4
    - FC: Unable to keep going without noticeable pauses. Slow speech with frequent repetition. Often self-corrects. Links simple sentences with repetitive connectives; coherence breakdowns.
    - LR: Sufficient for familiar topics only; basic meaning on unfamiliar topics. Frequent inappropriacies; rarely paraphrases.
    - GRA: Basic forms; some short error-free utterances. Subordination rare; short turns; repetitive structures; frequent errors.
    - P: Some acceptable features but limited range. Chunking has frequent rhythm lapses. Attempts stress/intonation with limited control. Frequent mispronunciations causing lack of clarity; requires effort to understand.

    Band 3
    - FC: Frequent/long pauses for word search. Limited linking; cannot go beyond simple responses. Often unable to convey basic message.
    - LR: Very limited to simple vocabulary; inadequate for unfamiliar topics.
    - GRA: Basic forms attempted; errors numerous except in memorised utterances.
    - P: Shows some features of band 2 and some of band 4.

    Band 2
    - FC: Lengthy pauses before nearly every word. Isolated words recognisable; virtually no communicative significance.
    - LR: Very limited; isolated words or memorised utterances. Little communication without mime/gesture.
    - GRA: No evidence of basic sentence forms.
    - P: Few acceptable phonological features; delivery impairs connected speech. Mostly mispronounced; little meaning conveyed; often unintelligible.

    Band 1
    - FC/LR/GRA: Essentially none; totally incoherent; no communicative language unless memorised.
    - P: Occasional recognisable words/phonemes only; no overall meaning; unintelligible.

    Band 0: Does not attend.

    IMPORTANT RULES:
    - A candidate must fully fit the positive features of a level to be rated at that band.
    - Rate on average performance.
    - Do NOT invent errors. Only flag errors clearly incorrect in the transcript.

    SCORING RULES:
    - Score each criterion in 0.5 increments: FC, LR, GRA, P.
    - Overall band is the average of the four criteria, rounded to the nearest 0.5.

    FEEDBACK REQUIREMENTS:
    - Provide 2-4 concrete strengths tied to the descriptors.
    - Provide 2-4 concrete improvements tied to the descriptors.
    - Provide correctedTranscript only if real errors exist.
    - Provide betterVersion that is natural and concise, not overly advanced.
    - Provide errorList with exact errorSpan, correction, and reason.

    OUTPUT JSON ONLY:
    {
      "band": number,
      "fluency": number,
      "vocabulary": number,
      "grammar": number,
      "pronunciation": number,
      "bandRationale": {
        "fluency": "1-2 sentences",
        "vocabulary": "1-2 sentences",
        "grammar": "1-2 sentences",
        "pronunciation": "1-2 sentences"
      },
      "correctedTranscript": "...",
      "betterVersion": "...",
      "strengths": ["..."],
      "improvements": ["..."],
      "vocabSuggestions": ["..."] ,
      "errorList": [
        { "errorSpan": "...", "correction": "...", "reason": "..." }
      ]
    }
    `;
    // ... (Phần gọi OpenAI giữ nguyên)
    try {
        const res = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        });
        return JSON.parse(cleanJson(res.choices[0]?.message?.content || "{}"));
    } catch (e) { return null; }
};

// 1. SỬA HÀM CHẤM INTERVIEW (Ý TƯỞNG SÂU SẮC HƠN)
export const evaluateInterview = async (question: string, transcript: string) => {
  const prompt = `
    Role: Senior Communication Strategist & Charisma Coach.
    Task: Analyze the user's answer for a high-stakes social interview.
    
    Question: "${question}"
    Answer: "${transcript}"
    
    REQUIREMENTS FOR "IDEA UPGRADE":
    - Do NOT just give a generic advice.
    - Provide a **Detailed Strategy** (3-4 sentences) on how to structure a better answer.
    - Suggest a specific **Psychological Angle** or **Storytelling Framework** (e.g., STAR method, Golden Circle) to make it persuasive.
    
    OUTPUT JSON ONLY:
    {
      "score": number, // 0-100
      "comment": "Short punchy feedback",
      "logicAnalysis": "Deep dive into the user's reasoning flow",
      "ideaUpgrade": "A detailed paragraph explaining a smarter, more impressive way to answer this, focusing on emotional intelligence and depth.",
      "keywords": ["3 advanced terms/idioms related to the topic"]
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });
    return JSON.parse(cleanJson(res.choices[0]?.message?.content || "{}"));
  } catch (error) { return null; }
};

// 2. SỬA HÀM TẠO CÂU HỎI (HỖ TRỢ PART & ĐA DẠNG CHỦ ĐỀ)
export const generateQuestion = async (mode: 'ielts' | 'interview', userWords: string[], part: number = 2) => {
  let prompt = "";
  
  if (mode === 'ielts') {
    // LOGIC CHO IELTS TỪNG PART
    const context = userWords.length > 0 ? `Context words: ${userWords.join(", ")}` : "Topic: General";
    
    if (part == 1) {
      prompt = `Create 1 IELTS Speaking PART 1 question.
      Topic: Personal life or daily routines (home, work, study, hobbies, friends, food, transport, technology use, leisure).
      Style: Short, direct, natural interview question.
      Constraint: Requires a full-sentence answer, avoid overly generic prompts.`;
    } else if (part == 3) {
      prompt = `Create 1 IELTS Speaking PART 3 question.
      ${context}.
      Style: Abstract, discussion, social issues.
      Constraint: Complex question requiring opinion/speculation, include a “why/how” angle.`;
    } else {
      prompt = `Create 1 IELTS Speaking PART 2 Topic Card (Cue Card).
      ${context}.
      Make it varied and specific (avoid common topics).
      Format: "Describe a [topic]... You should say: who/what/where... and explain why..."`;
    }
    prompt += ` Return JSON: { "question": "..." }`;

  } else {
    // LOGIC CHO INTERVIEW (ĐA DẠNG HÓA)
    const themes = [
        "Ethical Dilemmas (Tình huống đạo đức)",
        "Social Dynamics & Relationships (Quan hệ xã hội)",
        "Leadership & Conflict Resolution (Lãnh đạo)",
        "Mental Health & Self-growth",
        "Cultural Differences",
        "Modern Romance & Family"
    ];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];

    prompt = `
      Create 1 "Beauty Pageant" or "Behavioral Interview" question.
      Target Theme: ${randomTheme}.
      Constraint: NO Technology topics. Focus on Human nature, Emotion, and Society.
      Example: "If you had to choose between being respected or being liked, which would you choose?"
      Return JSON: { "question": "..." }
    `;
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.8
  });
  
  return JSON.parse(cleanJson(res.choices[0]?.message?.content || "{}"));
};
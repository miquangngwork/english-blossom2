import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";
import { evaluateIelts, evaluateInterview, generateQuestion, generateSpeakingHint } from "../services/speaking.ai";
import { ensureDbShape } from "../utils/dbShape";

// API 1: Lấy chủ đề
export const getSpeakingTopic = async (req: AuthRequest, res: Response) => {
  try {
    await ensureDbShape();
    const userId = req.userId!;
    // Nhận thêm query 'part' (mặc định là 2 nếu không gửi)
    const { mode, part } = req.query; 
    
    const targetMode = (mode === 'interview') ? 'interview' : 'ielts';
    // Ép kiểu part về số nguyên, mặc định là 2
    const targetPart = part ? parseInt(part as string) : 2; 
    
    let words: string[] = [];
    if (targetMode === 'ielts') {
        const learningItems = await prisma.userVocab.findMany({
        where: { userId, status: { in: ["learning", "new"] } },
        select: { vocab: { select: { word: true } } },
            take: 5
        });
        words = learningItems.map((i: any) => i.vocab.word);
    }

    // Truyền targetPart vào hàm AI
    const result = await generateQuestion(targetMode, words, targetPart);
    
    res.json({
      question: result.question,
      mode: targetMode,
      part: targetPart,
      requiredWords: words
    });

  } catch (error) {
    console.error(error);
    res.json({ question: "Tell me about yourself.", mode: "ielts" });
  }
};

export const getSpeakingHint = async (req: AuthRequest, res: Response) => {
  try {
    await ensureDbShape();
    const userId = req.userId!;
    const { mode, question, requiredWords } = req.body as {
      mode?: "ielts" | "interview";
      question?: string;
      requiredWords?: string[];
    };

    const targetMode = mode === "interview" ? "interview" : "ielts";
    const q = (question || "").toString().trim();
    if (!q) return res.status(400).json({ message: "Thiếu question" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const level = user?.profile?.levelCefr || "A2";

    const hint = await generateSpeakingHint({
      mode: targetMode,
      question: q,
      level,
      requiredWords: Array.isArray(requiredWords) ? requiredWords : [],
    });

    res.json(hint);
  } catch (e: any) {
    console.error("getSpeakingHint error:", e);
    res.status(500).json({ message: "Lỗi tạo hint" });
  }
};

// API 2: Chấm điểm (Giữ nguyên logic cũ, code này không đổi)
export const evaluateSpeaking = async (req: AuthRequest, res: Response) => {
    // ... (Giữ nguyên như version trước)
    // Copy lại nội dung hàm evaluateSpeaking từ câu trả lời trước
    try {
        const { mode, question, transcript } = req.body;
        let result: any;
        let scoreToSave = 0;
    
        if (mode === 'interview') {
            result = await evaluateInterview(question, transcript);
            scoreToSave = result && result.score ? (result.score / 10) : 0;
        } else {
            result = await evaluateIelts(question, transcript);
            scoreToSave = result && result.band ? result.band : 0;
        }
    
        if (result) {
            await prisma.speakingSession.create({
              data: {
                userId: req.userId!,
                mode: mode || "ielts",
                transcript: transcript || "",
                score: scoreToSave
              }
            });
        }
        res.json({ ...result, mode });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};
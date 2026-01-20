import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";
import { generateVocabDeck } from "../services/vocab.ai";
import { ensureDbShape } from "../utils/dbShape";

interface SurveyBody {
  interests?: string[];
  goal?: string;
  occupation?: string;
}

export const submitSurvey = async (req: AuthRequest, res: Response) => {
  const { interests, goal, occupation } = req.body as SurveyBody;
  const userId = req.userId!;

  console.log(">>> [ONBOARDING] Nhận yêu cầu từ User:", userId);

  if (!interests || !Array.isArray(interests) || interests.length === 0) {
    return res.status(400).json({ message: "Vui lòng chọn ít nhất một sở thích." });
  }

  try {
    await ensureDbShape();
    // 1. Cập nhật Profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            interests: interests,
            goal: goal || "General",
            occupation: occupation || "Student"
          }
        }
      },
      include: { profile: true }
    });

    // 2. Gọi AI
    const userLevel = updatedUser.profile?.levelCefr || "A1";
    console.log(`>>> [ONBOARDING] Gọi AI tạo từ (Level: ${userLevel}, Topic: ${interests[0]})...`);
    
    const newWords = await generateVocabDeck(userId, {
        level: userLevel,
        interests: interests,
        goal: goal || "General",
        occupation: occupation || "Student"
    });

    console.log(`>>> [ONBOARDING] AI trả về ${newWords.length} từ.`);

    if (newWords.length === 0) {
        throw new Error("AI trả về danh sách rỗng (Lỗi kết nối hoặc parse JSON).");
    }

    // 3. Lưu vào DB
    const batchId = `batch_${Date.now()}`;
    let savedCount = 0;
    const dbErrors: string[] = [];

    for (const item of newWords) {
        try {
            const safeExample = item.example ?? ""; // Fix lỗi null/undefined

            // Tìm hoặc tạo từ trong từ điển gốc
            let wordRecord = await prisma.vocabWord.findFirst({ where: { word: item.word } });
            if (!wordRecord) {
                wordRecord = await prisma.vocabWord.create({
                    data: {
                        word: item.word,
                        meaning: item.meaning,
                        example: safeExample,
                        levelCefr: userLevel,
                        topic: interests[0] || "General"
                    }
                });
            }

            // Gán cho user
            await prisma.userVocab.create({
                data: {
                    userId,
                    vocabId: wordRecord.id,
                    status: "learning",
                    batchId: batchId,
                    nextReview: new Date()
                }
            });
            savedCount++;
        } catch (dbError) {
            console.error(`>>> [LỖI DB] Không lưu được từ: ${item.word}`, dbError);
            if (dbErrors.length < 3) dbErrors.push(String((dbError as any)?.message || dbError));
        }
    }

    console.log(`>>> [SUCCESS] Đã lưu thành công ${savedCount} từ.`);

    if (savedCount === 0) {
      return res.status(500).json({
        message: "Không lưu được từ vựng vào DB (schema drift hoặc quyền DB).",
        count: 0,
        batchId,
        errors: dbErrors,
      });
    }

    res.json({
      message: "Success",
      count: savedCount,
      batchId: batchId,
    });

  } catch (error: any) {
    console.error(">>> [ONBOARDING ERROR]:", error);
    res.status(500).json({ message: "Lỗi hệ thống: " + error.message });
  }
};
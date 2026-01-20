import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";
import { generateVocabDeck, generateTestQuestions } from "../services/vocab.ai";
import { generateGameData } from "../services/game.ai";
import { ensureDbShape } from "../utils/dbShape";

// 1. Lấy danh sách bộ từ
export const getVocabBatches = async (req: AuthRequest, res: Response) => {
    try {
        await ensureDbShape();
        const userId = req.userId!;
        const batches = await prisma.userVocab.findMany({
            where: { userId },
            distinct: ['batchId'],
            select: { batchId: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        
        const formatted = batches
            .filter(b => b.batchId)
            .map(b => ({
                id: b.batchId,
                name: `Bộ từ vựng ${new Date(b.createdAt).toLocaleDateString('vi-VN')} (${new Date(b.createdAt).toLocaleTimeString('vi-VN')})`
            }));
        
        res.json(formatted);
    } catch (e) { res.json([]); }
};

// 2. Lấy từ vựng theo Batch
export const getLearningVocab = async (req: AuthRequest, res: Response) => {
  try {
        await ensureDbShape();
    const userId = req.userId!;
    const { batchId } = req.query;
    
    let targetBatchId = batchId as string;
    
    if (!targetBatchId || targetBatchId === 'latest') {
        const latestEntry = await prisma.userVocab.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        targetBatchId = latestEntry?.batchId || "";
    }

    if (!targetBatchId) return res.json([]);

    const userVocabs = await prisma.userVocab.findMany({
      where: { userId, batchId: targetBatchId },
      include: { vocab: true }
    });

    const formatted = userVocabs.map(item => ({
      id: item.vocab.id, 
      word: item.vocab.word,
      meaning: item.vocab.meaning,
      example: item.vocab.example,
      status: item.status
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy từ vựng" });
  }
};

// 3. Đánh dấu đã thuộc
export const markMastered = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { vocabId } = req.body; 

        if (!vocabId) return res.status(400).json({ message: "Thiếu vocabId" });

        const userVocab = await prisma.userVocab.findFirst({
            where: { userId, vocabId }
        });

        if (userVocab) {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 100);

            await prisma.userVocab.update({
                where: { id: userVocab.id },
                data: { 
                    status: "mastered",
                    nextReview: futureDate 
                }
            });
            res.json({ success: true });
        } else {
            res.status(404).json({ message: "Không tìm thấy từ này" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Lỗi lưu trạng thái" });
    }
};

// 4. Tạo thêm bộ từ vựng (UPDATE: CÓ VÒNG LẶP NẠP BÙ)
export const generateMoreVocab = async (req: AuthRequest, res: Response) => {
    try {
        await ensureDbShape();
        const userId = req.userId!;
        const TARGET_COUNT = 15; // Mục tiêu bắt buộc
        const MAX_RETRIES = 3;   // Gọi tối đa 3 lần để tránh treo server

        console.log(`[VOCAB] User ${userId} requesting more vocab...`);

        // A. Lấy Profile & Lịch sử học
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true }
        });
        if (!user || !user.profile) return res.status(400).json({ message: "Chưa có hồ sơ" });

        // Lấy tất cả từ đã học để làm bộ lọc (Blacklist)
        const allUserVocabs = await prisma.userVocab.findMany({
            where: { userId: userId },
            select: { vocab: { select: { word: true } } }
        });
        const knownWordsSet = new Set(allUserVocabs.map(item => item.vocab.word.trim().toLowerCase()));

        // Biến lưu kết quả tạm
        let finalWords: any[] = [];
        let seenInSession = new Set<string>(); // Tránh trùng ngay trong chính lần tạo này
        let attempts = 0;

        // --- BẮT ĐẦU VÒNG LẶP (LOOP) ---
        // Chạy cho đến khi đủ 15 từ hoặc hết số lần thử
        while (finalWords.length < TARGET_COUNT && attempts < MAX_RETRIES) {
            attempts++;
            console.log(`[LOOP] Attempt ${attempts}: Current valid words = ${finalWords.length}/${TARGET_COUNT}`);

            // Gọi AI (Mỗi lần gọi sẽ random topic khác nhau nhờ logic bên service)
            const aiCandidates = await generateVocabDeck(userId, {
                level: user.profile.levelCefr,
                interests: user.profile.interests,
                goal: user.profile.goal,
                occupation: user.profile.occupation || "Student"
            });

            if (!aiCandidates) continue;

            // Lọc từ
            for (const item of aiCandidates) {
                const wordLower = item.word.trim().toLowerCase();

                // 1. Nếu đã học rồi -> BỎ
                if (knownWordsSet.has(wordLower)) continue;
                
                // 2. Nếu đã có trong danh sách chuẩn bị lưu -> BỎ
                if (seenInSession.has(wordLower)) continue;

                // 3. Nếu OK -> LẤY
                seenInSession.add(wordLower);
                finalWords.push(item);

                // Nếu đủ 15 thì BREAK NGAY LẬP TỨC
                if (finalWords.length >= TARGET_COUNT) break;
            }
        }
        // --- KẾT THÚC VÒNG LẶP ---

        if (finalWords.length === 0) {
            return res.status(500).json({ message: "AI không tìm được từ mới phù hợp, hãy thử lại sau." });
        }

        console.log(`[VOCAB] Finalizing batch with ${finalWords.length} words.`);

        // E. Lưu vào DB (Giữ nguyên logic cũ)
        const batchId = `batch_${Date.now()}`;
        let savedCount = 0;
        const dbErrors: string[] = [];

        for (const item of finalWords) {
            try {
                // Kiểm tra xem từ đã có trong từ điển chung chưa
                let wordRecord = await prisma.vocabWord.findFirst({ where: { word: item.word } });
                
                // Chưa có thì tạo mới trong từ điển
                if (!wordRecord) {
                    wordRecord = await prisma.vocabWord.create({
                        data: {
                            word: item.word,
                            meaning: item.meaning,
                            example: item.example || "",
                            levelCefr: user.profile.levelCefr, 
                            topic: "AI Generated"
                        }
                    });
                }

                // Liên kết từ đó với User
                await prisma.userVocab.create({
                    data: {
                        userId,
                        vocabId: wordRecord.id,
                        status: "new",
                        batchId: batchId,
                        nextReview: new Date()
                    }
                });
                savedCount++;
            } catch (err) {
                console.error("Lỗi lưu từ:", item.word, err);
                if (dbErrors.length < 3) dbErrors.push(String((err as any)?.message || err));
            }
        }

        if (savedCount === 0) {
            return res.status(500).json({
                message: "AI có trả về từ, nhưng không lưu được vào DB (schema drift hoặc quyền DB).",
                count: 0,
                batchId,
                errors: dbErrors,
            });
        }

        res.json({ 
            message: savedCount < TARGET_COUNT 
                ? `Đã cố gắng nhưng chỉ tìm được ${savedCount} từ mới.` 
                : "Đã tạo đủ 15 từ mới.", 
            count: savedCount, 
            batchId 
        });

    } catch (error: any) {
        console.error("Generate Error:", error);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};

// ... Các hàm khác giữ nguyên ...
// ... (các import giữ nguyên)

export const getGameData = async (req: AuthRequest, res: Response) => {
    try {
        await ensureDbShape();
        const userId = req.userId!;
        const { batchId } = req.query; // Nhận batchId từ frontend
        
        let targetBatch = batchId as string;
        
        // Nếu không có batchId hoặc là 'latest', lấy bộ mới nhất
        if (!targetBatch || targetBatch === 'latest') {
             const latest = await prisma.userVocab.findFirst({ 
                 where: { userId }, 
                 orderBy: { createdAt: 'desc' } 
             });
             targetBatch = latest?.batchId || "";
        }

        if (!targetBatch) return res.json({ matching: [], wordHunt: {}, speedMatch: [] });

        // Lấy từ vựng thuộc bộ đó
        const userVocabs = await prisma.userVocab.findMany({
            where: { userId, batchId: targetBatch },
            include: { vocab: true }
        });

        const words = userVocabs.map(uv => uv.vocab.word);
        
        // Lấy Level của user để AI chỉnh độ khó
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
        const level = user?.profile?.levelCefr || "A1";

        const gameData = await generateGameData(words, level); 
        res.json(gameData);

    } catch (e) { 
        console.error(e);
        res.status(500).json({ matching: [], wordHunt: {}, speedMatch: [] }); 
    }
};

export const getTestContext = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { batchId } = req.query;
        let targetBatch = batchId as string;
        if (!targetBatch || targetBatch === 'latest') {
             const latest = await prisma.userVocab.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
             targetBatch = latest?.batchId || "";
        }
        const userVocabs = await prisma.userVocab.findMany({ where: { userId, batchId: targetBatch }, include: { vocab: true } });
        const wordList = userVocabs.map(uv => uv.vocab.word);

        const hardItems = await prisma.hardWord.findMany({
            where: { userId, ...(targetBatch ? { batchId: targetBatch } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 30
        });
        const hardWords = hardItems.map(h => h.word);
        const prioritizedWords = Array.from(new Set([...hardWords, ...wordList]));
        
        // Gọi service AI để tạo câu hỏi
        const questions = await generateTestQuestions(prioritizedWords);
        res.json({ questions });
    } catch (error) { res.status(500).json({ questions: [] }); }
};

export const saveHardWords = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { hardWords, batchId, reason } = req.body;

        if (!Array.isArray(hardWords) || hardWords.length === 0) {
            return res.json({ success: true, count: 0 });
        }

        const data = hardWords
            .filter((w: any) => typeof w === "string" && w.trim().length > 0)
            .map((w: string) => ({
                userId,
                word: w.trim(),
                batchId: batchId || null,
                reason: reason || null
            }));

        if (data.length === 0) return res.json({ success: true, count: 0 });

        await prisma.hardWord.createMany({ data, skipDuplicates: true });
        res.json({ success: true, count: data.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Lỗi lưu hard words" });
    }
};
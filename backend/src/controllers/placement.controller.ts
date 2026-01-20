import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { difficultyToCefrLevel, generateQuestion } from "../services/placement.ai";

const TOTAL_QUESTIONS = 30; // Yêu cầu của bạn

// 1. API START
export const startPlacement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await prisma.assessment.deleteMany({ where: { userId: userId, finalScore: null } });

    const assessment = await prisma.assessment.create({
      data: { userId: userId, totalQuestions: TOTAL_QUESTIONS },
    });

    // Bắt đầu từ mức 3.0 (A2)
    const startDiff = 3.0;
    const aiQuestion = await generateQuestion(startDiff);
    
    const item = await prisma.assessmentItem.create({
        data: {
            assessmentId: assessment.id,
            difficulty: startDiff,
            skillTag: aiQuestion.skillTag,
            question: aiQuestion.question,
            options: aiQuestion.options,
            correctAnswer: aiQuestion.correctAnswer
        }
    });

    res.json({ 
        assessmentId: assessment.id,
        question: {
            id: item.id,
            content: item.question,
            options: item.options,
            current: 1,
            total: TOTAL_QUESTIONS
        }
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khởi tạo bài test" });
  }
};

// 2. API NEXT QUESTION
export const nextQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId, answer } = req.body;
    const userId = req.userId!;

    const lastItem = await prisma.assessmentItem.findFirst({
        where: { assessmentId },
        orderBy: { createdAt: 'desc' }
    });

    if (!lastItem) return res.status(400).json({ message: "Error flow" });

    // Chấm điểm
    const isCorrect = lastItem.correctAnswer === answer;
    await prisma.assessmentItem.update({
        where: { id: lastItem.id },
        data: { userAnswer: answer, isCorrect }
    });

    // --- LOGIC ADAPTIVE (5 ĐÚNG TĂNG, 3 SAI GIẢM) ---
    const history = await prisma.assessmentItem.findMany({
        where: { assessmentId, isCorrect: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    let currentDifficulty = lastItem.difficulty;
    let correctStreak = 0;
    let wrongStreak = 0;

    for (const item of history) {
        if (item.isCorrect) { correctStreak++; wrongStreak = 0; } 
        else { wrongStreak++; correctStreak = 0; }
        if (correctStreak === 0 && wrongStreak === 0) break;
    }

    if (isCorrect) {
        if (correctStreak >= 5) currentDifficulty = Math.min(9, currentDifficulty + 1.0);
    } else {
        if (wrongStreak >= 3) currentDifficulty = Math.max(1, currentDifficulty - 0.5);
    }
    // ------------------------------------------------

    // Kiểm tra kết thúc
    const count = await prisma.assessmentItem.count({ where: { assessmentId, isCorrect: { not: null } } });

    if (count >= TOTAL_QUESTIONS) {
        const correctItems = await prisma.assessmentItem.findMany({ where: { assessmentId, isCorrect: true } });
        const avgDiff = correctItems.length > 0 
            ? correctItems.reduce((sum, i) => sum + i.difficulty, 0) / correctItems.length
            : 1;
        
        const finalLevel = difficultyToCefrLevel(avgDiff);
        const finalScore = (correctItems.length / TOTAL_QUESTIONS) * 100;

        await prisma.assessment.update({ where: { id: assessmentId }, data: { finalScore, finalLevel } });
        await prisma.profile.update({ where: { userId }, data: { levelCefr: finalLevel } as any });

        return res.json({ done: true, finalScore, finalLevel });
    }

    // Câu hỏi tiếp theo
    const aiQuestion = await generateQuestion(currentDifficulty);
    const newItem = await prisma.assessmentItem.create({
        data: {
            assessmentId,
            difficulty: currentDifficulty,
            skillTag: aiQuestion.skillTag,
            question: aiQuestion.question,
            options: aiQuestion.options,
            correctAnswer: aiQuestion.correctAnswer
        }
    });

    res.json({
        done: false,
        question: {
            id: newItem.id,
            content: newItem.question,
            options: newItem.options,
            current: count + 1,
            total: TOTAL_QUESTIONS
        }
    });

  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getPlacementStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const completed = await prisma.assessment.findFirst({
            where: { userId, finalScore: { not: null } },
            orderBy: { createdAt: 'desc' }
        });
        
        // Check xem đã điền form chưa
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
        const hasProfile = user?.profile?.interests && user.profile.interests.length > 0;

        res.json({ 
            hasFinishedTest: !!completed, 
            level: completed?.finalLevel,
            hasProfile: !!hasProfile 
        });
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
};
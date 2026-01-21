import { Response } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { difficultyToCefrLevel, generateQuestion } from "../services/placement.ai";

const TOTAL_QUESTIONS = 30; // Yêu cầu của bạn

const normalizeOptions = (options: unknown): string[] =>
    Array.isArray(options) ? options.map((opt) => String(opt)) : [];

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
    }
    return a;
}

function roundToHalf(x: number) {
    return Math.round(x * 2) / 2;
}

function clamp(x: number, min: number, max: number) {
    return Math.max(min, Math.min(max, x));
}

function thetaToCefr(theta: number): string {
    if (theta < 2.5) return "A1";
    if (theta < 4.5) return "A2";
    if (theta < 6.5) return "B1";
    if (theta < 8.5) return "B2";
    return "C1";
}

function estimateTheta(items: Array<{ difficulty: number; isCorrect: boolean }>): number {
    // Simple 1PL-like online update.
    const a = 1.35; // discrimination
    let theta = 3.0; // start near A2
    let lr = 0.85;

    for (const item of items) {
        const b = item.difficulty;
        const z = a * (theta - b);
        const p = 1 / (1 + Math.exp(-z));
        const y = item.isCorrect ? 1 : 0;
        theta = theta + lr * a * (y - p);
        theta = clamp(theta, 1, 9);
        lr = Math.max(0.35, lr * 0.97);
    }

    return theta;
}

type OptionsColumnKind = "jsonb" | "json" | "textArray" | "unknown";
let optionsColumnKind: OptionsColumnKind = "unknown";

async function detectOptionsColumnKind(): Promise<OptionsColumnKind> {
    if (optionsColumnKind !== "unknown") return optionsColumnKind;
    try {
        const rows = await prisma.$queryRaw<
            Array<{ data_type: string; udt_name: string }>
        >(Prisma.sql`
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'AssessmentItem'
                AND column_name = 'options'
            LIMIT 1;
        `);

        const row = rows[0];
        if (!row) return (optionsColumnKind = "unknown");
        if (row.udt_name === "jsonb") return (optionsColumnKind = "jsonb");
        if (row.udt_name === "json") return (optionsColumnKind = "json");
        if (row.udt_name === "_text") return (optionsColumnKind = "textArray");
        return (optionsColumnKind = "unknown");
    } catch {
        return (optionsColumnKind = "unknown");
    }
}

async function createAssessmentItemFlexible(params: {
    assessmentId: string;
    difficulty: number;
    skillTag: string;
    question: string;
    options: string[];
    correctAnswer: string;
}): Promise<{ id: string; question: string; options: unknown }> {
    const id = crypto.randomUUID();
    const kind = await detectOptionsColumnKind();

    if (kind === "textArray") {
        const rows = await prisma.$queryRaw<
            Array<{ id: string; question: string; options: unknown }>
        >(Prisma.sql`
            INSERT INTO "AssessmentItem" ("id", "assessmentId", "difficulty", "skillTag", "question", "options", "correctAnswer")
            VALUES (${id}, ${params.assessmentId}, ${params.difficulty}, ${params.skillTag}, ${params.question}, ${params.options}::text[], ${params.correctAnswer})
            RETURNING "id", "question", "options";
        `);
        return rows[0]!;
    }

    // Default to JSON/JSONB using a JSON string cast to avoid binary-format issues.
    const optionsJson = JSON.stringify(params.options);
    const castType = kind === "json" ? Prisma.sql`::json` : Prisma.sql`::jsonb`;

    const rows = await prisma.$queryRaw<
        Array<{ id: string; question: string; options: unknown }>
    >(Prisma.sql`
        INSERT INTO "AssessmentItem" ("id", "assessmentId", "difficulty", "skillTag", "question", "options", "correctAnswer")
        VALUES (${id}, ${params.assessmentId}, ${params.difficulty}, ${params.skillTag}, ${params.question}, ${optionsJson}${castType}, ${params.correctAnswer})
        RETURNING "id", "question", "options";
    `);

    return rows[0]!;
}

let dbShapeEnsured = false;
async function ensureDbShape() {
    if (dbShapeEnsured) return;
    dbShapeEnsured = true;

    // These are safe, idempotent fixes for common drift when migrations haven't been applied.
    // If a statement fails (e.g., permissions or already-correct types), we ignore and continue.
    try {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "AssessmentItem" ALTER COLUMN "options" TYPE JSONB USING to_jsonb("options");'
        );
    } catch (e) {
        console.error("ensureDbShape: options alter failed", e);
    }

    try {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "UserVocab" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;'
        );
    } catch (e) {
        console.error("ensureDbShape: userVocab createdAt add failed", e);
    }
}

// 1. API START
export const startPlacement = async (req: AuthRequest, res: Response) => {
  try {
        await ensureDbShape();
    const userId = req.userId!;
    await prisma.assessment.deleteMany({ where: { userId: userId, finalScore: null } });

    const assessment = await prisma.assessment.create({
      data: { userId: userId, totalQuestions: TOTAL_QUESTIONS },
    });

    // Bắt đầu từ mức 3.0 (A2)
    const startDiff = 3.0;
    const aiQuestion = await generateQuestion(startDiff);

    // Shuffle options server-side so correct answer isn't always first.
    const shuffledOptions = shuffleArray(aiQuestion.options);
    
    const item = await createAssessmentItemFlexible({
      assessmentId: assessment.id,
      difficulty: startDiff,
      skillTag: aiQuestion.skillTag,
      question: aiQuestion.question,
            options: shuffledOptions,
      correctAnswer: aiQuestion.correctAnswer,
    });

    res.json({ 
        assessmentId: assessment.id,
        question: {
            id: item.id,
            content: item.question,
            options: normalizeOptions(item.options),
            current: 1,
            total: TOTAL_QUESTIONS
        }
    });
  } catch (error) {
        console.error("startPlacement error:", error);
    res.status(500).json({ message: "Lỗi khởi tạo bài test" });
  }
};

// 2. API NEXT QUESTION
export const nextQuestion = async (req: AuthRequest, res: Response) => {
  try {
        await ensureDbShape();
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

    // --- LOGIC ADAPTIVE (theta estimation) ---
    const answeredItems = await prisma.assessmentItem.findMany({
        where: { assessmentId, isCorrect: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { difficulty: true, isCorrect: true }
    });

    const theta = estimateTheta(
        answeredItems.map((i) => ({
            difficulty: i.difficulty,
            isCorrect: Boolean(i.isCorrect),
        }))
    );

    // Choose next difficulty slightly below theta to target ~65% success.
    const nextDifficulty = clamp(roundToHalf(theta - 0.5), 1, 9);
    // ------------------------------------------------

    // Kiểm tra kết thúc
    const count = await prisma.assessmentItem.count({ where: { assessmentId, isCorrect: { not: null } } });

    if (count >= TOTAL_QUESTIONS) {
        const correctItems = await prisma.assessmentItem.findMany({
            where: { assessmentId, isCorrect: true },
            select: { id: true }
        });

        const finalTheta = theta;
        const finalLevel = thetaToCefr(finalTheta);
        const finalScore = (correctItems.length / TOTAL_QUESTIONS) * 100;

        await prisma.assessment.update({ where: { id: assessmentId }, data: { finalScore, finalLevel } });
        await prisma.profile.update({ where: { userId }, data: { levelCefr: finalLevel } as any });

        return res.json({ done: true, finalScore, finalLevel, assessmentId });
    }

    // Câu hỏi tiếp theo
        const aiQuestion = await generateQuestion(nextDifficulty);
        const shuffledOptions = shuffleArray(aiQuestion.options);
    const newItem = await createAssessmentItemFlexible({
      assessmentId,
            difficulty: nextDifficulty,
      skillTag: aiQuestion.skillTag,
      question: aiQuestion.question,
            options: shuffledOptions,
      correctAnswer: aiQuestion.correctAnswer,
    });

    res.json({
        done: false,
        question: {
            id: newItem.id,
            content: newItem.question,
            options: normalizeOptions(newItem.options),
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

export const getPlacementResult = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const assessmentId = String(req.query.assessmentId || "").trim();

        const assessment = assessmentId
            ? await prisma.assessment.findFirst({
                  where: { id: assessmentId, userId },
                  include: {
                      items: {
                          orderBy: { createdAt: "asc" },
                          select: {
                              id: true,
                              difficulty: true,
                              skillTag: true,
                              question: true,
                              options: true,
                              correctAnswer: true,
                              userAnswer: true,
                              isCorrect: true,
                              createdAt: true,
                          },
                      },
                  },
              })
            : await prisma.assessment.findFirst({
                  where: { userId, finalScore: { not: null } },
                  orderBy: { createdAt: "desc" },
                  include: {
                      items: {
                          orderBy: { createdAt: "asc" },
                          select: {
                              id: true,
                              difficulty: true,
                              skillTag: true,
                              question: true,
                              options: true,
                              correctAnswer: true,
                              userAnswer: true,
                              isCorrect: true,
                              createdAt: true,
                          },
                      },
                  },
              });

        if (!assessment) return res.status(404).json({ message: "Không tìm thấy kết quả" });

        const items = assessment.items.map((it, idx) => ({
            index: idx + 1,
            id: it.id,
            difficulty: it.difficulty,
            skillTag: it.skillTag,
            question: it.question,
            options: normalizeOptions(it.options),
            correctAnswer: it.correctAnswer,
            userAnswer: it.userAnswer,
            isCorrect: it.isCorrect,
        }));

        const answered = items.filter((i) => typeof i.isCorrect === "boolean");
        const theta = estimateTheta(
            answered.map((i) => ({ difficulty: i.difficulty, isCorrect: Boolean(i.isCorrect) }))
        );

        res.json({
            assessmentId: assessment.id,
            finalScore: assessment.finalScore,
            finalLevel: assessment.finalLevel,
            theta,
            total: items.length,
            correct: answered.filter((i) => i.isCorrect).length,
            items,
        });
    } catch (e) {
        console.error("getPlacementResult error:", e);
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};
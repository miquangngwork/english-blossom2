import { Router } from "express";
import { 
    getLearningVocab, 
    markMastered, 
    getGameData, 
    generateMoreVocab,
    getTestContext,
    getVocabBatches,
    saveHardWords
} from "../controllers/vocab.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Định nghĩa các đường dẫn
router.get("/batches", authMiddleware, getVocabBatches);
router.get("/learning", authMiddleware, getLearningVocab);
router.post("/master", authMiddleware, markMastered);
router.get("/game", authMiddleware, getGameData);
router.post("/more", authMiddleware, generateMoreVocab);
router.get("/test", authMiddleware, getTestContext);
router.post("/hard-words", authMiddleware, saveHardWords);

// DÒNG QUAN TRỌNG ĐỂ SỬA LỖI:
export default router;
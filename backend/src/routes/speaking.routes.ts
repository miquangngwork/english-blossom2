import { Router } from "express";
import { evaluateSpeaking, getSpeakingHint, getSpeakingTopic } from "../controllers/speaking.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/topic", authMiddleware, getSpeakingTopic); // <-- Mới
router.post("/eval", authMiddleware, evaluateSpeaking);
router.post("/hint", authMiddleware, getSpeakingHint);

export default router;
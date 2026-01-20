import { Router } from "express";
import { evaluateSpeaking, getSpeakingTopic } from "../controllers/speaking.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/topic", authMiddleware, getSpeakingTopic); // <-- Mới
router.post("/eval", authMiddleware, evaluateSpeaking);

export default router;
import { Router } from "express";
import { submitSurvey } from "../controllers/onboarding.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Định nghĩa đường dẫn nhận Form khảo sát
router.post("/survey", authMiddleware, submitSurvey);

// QUAN TRỌNG: Phải có dòng này để app.ts nhận diện được
export default router;
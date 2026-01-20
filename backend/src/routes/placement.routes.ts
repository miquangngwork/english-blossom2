import { Router } from "express";
import { 
    startPlacement, 
    nextQuestion, 
    getPlacementStatus 
} from "../controllers/placement.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/start", authMiddleware, startPlacement);
router.post("/next", authMiddleware, nextQuestion);
router.get("/status", authMiddleware, getPlacementStatus); // Dòng này sẽ hết lỗi

export default router;
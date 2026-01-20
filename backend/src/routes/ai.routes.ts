import { Router } from "express";
import { generateGeneral } from "../controllers/ai.controller";

const router = Router();

// Định nghĩa đường dẫn POST / (tương ứng với /api/generate ở app.ts)
router.post("/", generateGeneral);

export default router;
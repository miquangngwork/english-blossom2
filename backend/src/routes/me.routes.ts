import { Router } from "express";
import { getMe, changePassword } from "../controllers/me.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getMe);
router.post("/change-password", authMiddleware, changePassword);

export default router;

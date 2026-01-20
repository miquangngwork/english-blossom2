import { Router } from "express";
import { listUsers, listRequests, updateRequestStatus } from "../controllers/admin.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/users", authMiddleware, listUsers);
router.get("/requests", authMiddleware, listRequests);
router.patch("/requests/:id", authMiddleware, updateRequestStatus);

export default router;


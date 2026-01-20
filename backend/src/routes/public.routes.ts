import { Router } from "express";
import { publicListUsers, publicListRequests } from "../controllers/admin.controller";

const router = Router();

router.get("/users", publicListUsers);
router.get("/requests", publicListRequests);

export default router;





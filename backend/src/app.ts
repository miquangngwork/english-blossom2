import express, { Request, Response } from "express";
import cors from "cors";
import path from "path"; // <--- Thêm dòng này
import "dotenv/config"; 

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// --- [QUAN TRỌNG] MỞ QUYỀN TRUY CẬP THƯ MỤC FRONTEND ---
// When compiled to dist/, __dirname changes (src -> dist). Resolve paths from repo root instead.
const backendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendDir, "..");
const frontendRoot = path.join(repoRoot, "frontend");
const frontendPublic = path.join(frontendRoot, "public");

// Serve HTML files in frontend root (index.html, trangspeaking.html, ...)
app.use(express.static(frontendRoot));

// Serve public assets (/_sdk, /models if needed via relative paths)
app.use(express.static(frontendPublic));

// Optional explicit mount for SDK assets
app.use("/_sdk", express.static(path.join(frontendPublic, "_sdk")));

// Serve face-api models over HTTP to avoid file:// CORS errors
const modelsDir = process.env.FACE_MODELS_DIR || path.join(frontendPublic, "models");
app.use("/models", express.static(modelsDir));

// --- IMPORT ROUTES ---
import authRoutes from "./routes/auth.routes";
import meRoutes from "./routes/me.routes";
import placementRoutes from "./routes/placement.routes";
import adminRoutes from "./routes/admin.routes";
import requestRoutes from "./routes/request.routes";
import publicRoutes from "./routes/public.routes";
import vocabRoutes from "./routes/vocab.routes";
import speakingRoutes from "./routes/speaking.routes";
import onboardingRoutes from "./routes/onboarding.routes";
import aiRoutes from "./routes/ai.routes"; 

// --- ĐĂNG KÝ ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/vocab", vocabRoutes);
app.use("/api/speaking", speakingRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/generate", aiRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export default app;
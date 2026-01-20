import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      profile: {
        create: {
          goal: "general",
          levelCefr: "A1",
          timezone: "Asia/Ho_Chi_Minh",
          dailyTarget: 15,
        },
      },
    },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token });
};

export const login = async (req: Request, res: Response) => {
  console.log("LOGIN BODY:", req.body); // 👈 THÊM DÒNG NÀY
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token });
};

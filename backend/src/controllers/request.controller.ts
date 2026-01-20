import { Request, Response } from "express";
import prisma from "../utils/prisma";

export const createRequest = async (req: Request, res: Response) => {
  try {
    const { type, name, email, phone, level, timeslot, message } = req.body as {
      type: string;
      name?: string;
      email?: string;
      phone?: string;
      level?: string;
      timeslot?: string;
      message?: string;
    };

    if (!type) {
      return res.status(400).json({ message: "Thiếu type" });
    }

    const saved = await prisma.request.create({
      data: {
        type,
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        level: level ?? null,
        timeslot: timeslot ?? null,
        message: message ?? null,
        status: "new",
      },
    });

    res.json(saved);
  } catch (err: any) {
    console.error("createRequest error:", err);
    return res.status(500).json({
      message: "Lưu yêu cầu thất bại",
      detail: err?.message,
    });
  }
};


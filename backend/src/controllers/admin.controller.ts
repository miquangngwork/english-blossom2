import { Request, Response } from "express";
import prisma from "../utils/prisma";

export const listUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
};

// Public version (không cần auth, chỉ đọc)
export const publicListUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
};

export const listRequests = async (_req: Request, res: Response) => {
  const reqs = await prisma.request.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(reqs);
};

// Public version (không cần auth, chỉ đọc)
export const publicListRequests = async (_req: Request, res: Response) => {
  const reqs = await prisma.request.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(reqs);
};

export const updateRequestStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  if (!status) {
    return res.status(400).json({ message: "Thiếu status" });
  }
  if (!id) {
    return res.status(400).json({ message: "Thiếu id" });
  }
  const updated = await prisma.request.update({
    where: { id: String(id) },
    data: { status },
  });
  res.json(updated);
};


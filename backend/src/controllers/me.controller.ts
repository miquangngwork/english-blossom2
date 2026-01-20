import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import bcrypt from "bcrypt";

export const getMe = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  res.json(user);
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy người dùng" });
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Mật khẩu mới phải từ 8 ký tự trở lên" });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hash },
  });

  res.json({ message: "Đổi mật khẩu thành công" });
};

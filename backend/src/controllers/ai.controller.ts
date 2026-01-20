import { Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateGeneral = async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Thiếu prompt" });
    }

    console.log("📝 Đang xử lý Prompt chung tại /api/generate...");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Hoặc gpt-4o-mini
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || "";
    
    // Trả về đúng format mà Frontend đang đợi
    res.json({ text: text, result: text });

  } catch (error: any) {
    console.error("❌ Lỗi API Generate:", error.message);
    res.status(500).json({ message: "Lỗi tạo nội dung AI", error: error.message });
  }
};
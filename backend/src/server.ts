// Thêm dòng này đầu tiên để load file .env
import "dotenv/config"; 

import app from "./app";

const PORT = Number(process.env.PORT) || 5000;

// Kiểm tra xem Key đã nhận chưa (In ra terminal để debug)
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ LỖI NGHIÊM TRỌNG: Chưa tìm thấy OPENAI_API_KEY trong file .env");
    console.error("👉 Hãy tạo file .env ở thư mục gốc và điền API Key vào.");
} else {
    console.log("✅ Đã tìm thấy API Key (Độ dài: " + process.env.OPENAI_API_KEY.length + " ký tự)");
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
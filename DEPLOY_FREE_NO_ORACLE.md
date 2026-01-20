# Deploy miễn phí khi không đăng ký được Oracle

Dưới đây là 2 phương án **không cần VPS Oracle**. Cả hai đều cho phép **mọi người truy cập qua internet**.

> Thực tế: “free 100% + ổn định + domain cố định” rất khó nếu bạn không có VPS và cũng không mua domain. Vì vậy mình đưa 2 lựa chọn:
> - **Phương án 1 (khuyến nghị): Tailscale Funnel** → URL HTTPS khá ổn định, không cần mở port, chạy được cả khi mạng bị CGNAT.
> - **Phương án 2: Cloudflare Quick Tunnel hoặc ngrok free** → nhanh, nhưng URL thường đổi nếu restart.

---

## Phương án 1 (Khuyến nghị): Chạy trên máy bạn + Tailscale Funnel (HTTPS, public)

### Khi nào nên chọn?
- Bạn **không có VPS**, **không mở port được**, hoặc **bị CGNAT**.
- Bạn chấp nhận: máy tính chạy server phải **bật máy + có mạng** để web online.

### 1) Cài và login Tailscale
1. Tạo tài khoản miễn phí: https://tailscale.com/
2. Cài Tailscale trên máy chạy server (Windows/macOS/Linux).
3. Đăng nhập để máy nằm trong Tailnet.

### 2) Cài Postgres và Node trên máy bạn
- Cài Node.js LTS (20) từ https://nodejs.org/
- Cài PostgreSQL từ https://www.postgresql.org/download/

Tạo DB giống như trên VPS (bằng pgAdmin hoặc psql):
- DB: `english_blossom`
- User: `english_user`

### 3) Cấu hình `.env` cho backend
Tạo file `backend/.env` (trên máy bạn):
```bash
DATABASE_URL="postgresql://english_user:DB_PASS_HERE@localhost:5432/english_blossom?schema=public"
OPENAI_API_KEY="sk-..."
```

### 4) Build và chạy backend
Trong thư mục `backend/`:
```bash
npm install
npm run prisma:generate
npm run build
npm run prisma:migrate
npm start
```
Mặc định server chạy `http://localhost:5000` và serve luôn frontend.

### 5) Public hóa bằng Funnel
**Quan trọng:** Funnel là tính năng của Tailscale để public URL ra internet.

- Mở Tailscale Admin Console → mục **Funnel** (hoặc Settings) → bật/cho phép Funnel cho tailnet.

Sau đó trên máy chạy server:
- Nếu bạn dùng Tailscale CLI, bạn có thể chạy lệnh dạng:
```bash
tailscale funnel 5000
```
Tailscale sẽ in ra 1 URL HTTPS công khai kiểu:
- `https://<ten-may>.<tailnet>.ts.net`

**Test:** mở URL đó từ 4G/điện thoại (không chung Wi‑Fi) để chắc chắn public.

### 6) Chạy 24/7
- Bạn có thể chạy bằng PM2 (cài như bình thường) để tự restart khi lỗi.
- Nếu máy bạn tắt/ngủ → web sẽ offline.

---

## Phương án 2: Cloudflare Quick Tunnel (siêu nhanh, nhưng URL có thể đổi)

### Khi nào nên chọn?
- Bạn cần demo gấp.
- Bạn chấp nhận URL thay đổi nếu restart tunnel.

### Cách làm (tổng quan)
1. Tải `cloudflared` (Cloudflare Tunnel client)
2. Chạy web ở `localhost:5000`
3. Chạy quick tunnel trỏ vào `http://localhost:5000`

Cloudflare sẽ cấp URL dạng `https://random-string.trycloudflare.com`.

---

## So sánh nhanh
- **Tailscale Funnel:** link khá ổn định + HTTPS, không cần port forwarding, hợp nếu muốn chạy “tạm như production” nhưng không có VPS.
- **Cloudflare quick/ngrok free:** nhanh nhất, nhưng URL hay đổi, hợp demo.

---

## Gợi ý thêm (nếu bạn muốn URL cố định đẹp)
- Có thể dùng **GitHub Pages** host frontend miễn phí (URL `https://<user>.github.io/...`).
- Backend vẫn cần nơi chạy ổn định (VPS hoặc tunnel).

Nếu bạn muốn mình hướng dẫn chi tiết đúng theo máy bạn đang dùng:
- Bạn chạy server trên Windows hay Linux?
- Bạn muốn dùng Tailscale Funnel hay Cloudflare Tunnel?

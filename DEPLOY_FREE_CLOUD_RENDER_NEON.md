# Deploy không phụ thuộc máy bạn (Free-ish): Render (Backend) + Neon (Postgres) + subdomain miễn phí

Mục tiêu: web chạy trên internet **không cần VPS riêng** và **không phụ thuộc máy bạn**.

Sự thật cần biết (để khỏi mất công):
- 100% “free + luôn luôn online + không cần thẻ” là rất hiếm.
- Các nền tảng free thường có 1 trong các hạn chế: **ngủ (sleep)** khi không có traffic, giới hạn giờ chạy, hoặc yêu cầu thẻ để chống abuse.

Phương án dưới đây là **dễ làm + hợp với Node/Prisma/Postgres**:
- Backend: **Render** (có subdomain miễn phí)
- Database: **Neon Postgres** (free tier)
- Frontend: dự án này backend đang serve luôn `frontend/` nên bạn có thể để chung (đơn giản nhất).

---

## 1) Chuẩn bị repo (đã làm một phần)

### 1.1 Backend phải đọc `PORT` từ env
Các cloud (Render/Heroku-style) sẽ cấp port qua biến môi trường `PORT`.
- Repo đã được chỉnh ở backend/src/server.ts để dùng `process.env.PORT || 5000`.

### 1.2 Scripts production
Đã thêm trong backend/package.json:
- `build`: `tsc`
- `start`: `node dist/server.js`
- `prisma:migrate`: `prisma migrate deploy`

---

## 2) Tạo database miễn phí trên Neon

1. Vào https://neon.tech/ → Sign up (free)
2. Create Project → chọn region gần VN (Singapore/Japan nếu có)
3. Neon sẽ cấp connection string kiểu:
   - `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`

Copy connection string này để lát set `DATABASE_URL`.

**Quan trọng (Neon + Prisma migrations):**
- Neon thường có 2 loại connection string: **Pooled** (qua pooler) và **Direct**.
- Prisma migrations (DDL/ALTER TABLE) nên chạy bằng **Direct** connection string để tránh lỗi migrate hoặc migrate không áp dụng.
- Nếu bạn chỉ muốn đơn giản: hãy dùng **Direct** connection string cho `DATABASE_URL` trên Render.

---

## 3) Deploy backend lên Render

1. Vào https://render.com/ → Sign up
2. New → **Web Service**
3. Connect repo GitHub của bạn (bạn cần push code lên GitHub)
4. Cấu hình:
   - Root Directory: `backend`
   - Runtime: Node
  - Build Command (khuyến nghị để DB luôn đúng schema):
    - `npm install && npm run prisma:generate && npm run prisma:migrate && npm run build`
  - Start Command:
    - `npm start`

> Nếu bạn muốn migrate chạy đúng 1 lần khi deploy, Render có “Deploy Hook/Release command” tuỳ gói; cách ở trên thường vẫn chạy ổn.

### 3.1 Environment Variables trên Render
Vào tab Environment của service, thêm:
- `DATABASE_URL` = connection string từ Neon (**khuyến nghị dùng Direct**)
- `OPENAI_API_KEY` = key OpenAI của bạn

(Option) Nếu có path models custom:
- `FACE_MODELS_DIR` (thường không cần vì models nằm trong repo `frontend/public/models` và Express serve theo đường dẫn `/models`)

### 3.2 Subdomain miễn phí
Render sẽ cấp URL kiểu:
- `https://your-service-name.onrender.com`

---

## 4) Test sau khi deploy

- Mở `https://...onrender.com/health` → phải ra `{ "status": "ok" }`
- Mở `https://...onrender.com/` → phải thấy trang frontend (index.html)

---

## 5) Những vấn đề hay gặp

### 5.1 Service ngủ (sleep)
Nếu gói free sleep khi idle:
- Lần đầu người dùng vào sẽ “chờ” vài giây đến vài chục giây.
- Cách tránh hoàn toàn thường phải dùng gói trả phí.

### 5.2 Prisma migrate lỗi do SSL
Neon thường yêu cầu SSL. Dùng connection string có `sslmode=require`.

### 5.3 Static assets/models không load
Vì backend serve `frontend/` bằng express.static, nên miễn là repo deploy đầy đủ thư mục `frontend/` thì sẽ OK.

---

## 6) Nếu bạn muốn URL “đẹp” nhưng không mua domain
Bạn vẫn có thể dùng URL platform:
- Render: `*.onrender.com`
- Fly.io: `*.fly.dev`
- Koyeb: `*.koyeb.app`

---

## 7) Nếu bạn muốn mình set chuẩn theo repo này
Bạn cần làm 1 việc: **push repo lên GitHub** (public/private đều được).
Sau đó gửi mình:
- Tên platform bạn muốn dùng (Render hay Fly.io)
- Screenshot phần settings build/start command nếu bạn bị lỗi

Mình sẽ chỉ chính xác nên điền gì để deploy pass.

# 🎙️ S-voice – Phòng thu Giọng đọc AI & Biên tập Kịch bản Đa ngôn ngữ

> **Khởi tạo bởi Nhà báo Đặng Sinh** • Giải pháp Phòng thu Âm thanh AI & Tiền xử lý Văn bản Báo chí Đa ngôn ngữ xây dựng trên nền tảng **Gemini 3.8 TTS (`@google/genai`)** & **Web Audio DSP Engine**.

---

## 🌟 Điểm nổi bật cốt lõi

1. **Tiền xử lý Văn bản Báo chí Chuẩn Phát thanh (Nhóm A)**:
   - Tự động phát hiện ngôn ngữ đầu vào (9 ngôn ngữ: Việt, Anh-Mỹ, Anh-Anh, Pháp, Tây Ban Nha, Trung, Nhật, Hàn, Thái) kèm Đồng hồ đo thời lượng đọc (`Script Timer`).
   - **Rà soát Chính tả, Bung chữ viết tắt báo chí (`TP.HCM`, `UBND`, `NĐ-CP`, `TT-BXD`, `ĐBQH`...) & Số liệu (`23/10/2026`, `2,5 tỷ USD`, `80 km/h`)** bằng `gemini-3.5-flash-lite` với **Structured Output (`response_format` JSON Schema)** tiết kiệm 80% Output Token.
   - **Từ điển Phát âm (`Phonetic Alias`)**, **AI Podcast Splitter (Chuyển văn bản thành Kịch bản đối đáp 2 vai)** và **Dịch & Lồng tiếng Đa ngôn ngữ 1 chạm**.
2. **Thanh công cụ Đạo diễn Biểu cảm & Nhịp điệu (Nhóm B)**:
   - Chèn nhanh 9 thẻ biểu cảm phi ngôn từ góc nhọn của Gemini 3.8 TTS: `<short pause>`, `<long pause>`, `<breath>`, `<sigh>`, `<laugh>`, `<chuckle>`, `<cough>`, `<gasp>`, `<throat-clearing>`.
   - Chèn phản ứng chêm lời hội thoại 2 người: `|ừm hứm|`, `|thật sao?|`, `|đúng rồi|`, `|chính xác|` và nút `🔠 NHẤN TRỌNG ÂM`.
3. **5 Giọng đọc Tiêu biểu Đa vùng miền & Xưởng Giọng Cá nhân (Nhóm C)**:
   - **Đặng Sinh (Nam - Hà Nội • `Charon`/`Orus`)**, **Ngọc Hà (Nữ - Sài Gòn • `Kore`/`Aoede`)**, **Bé Tư Cầm Thi (Nữ - Cần Thơ • `Leda`/`Sulafat`)**, **Minh Nhật (Nam - Đà Nẵng • `Puck`/`Iapetus`)**, **Thầy Đồ Nghệ (Nam - Nghệ An • `Gacrux`/`Algenib`)**.
   - **Voice Design (`POST /v1beta/voices`, `type: "prompted"`)** & **Voice Replication (`type: "replicated"`, mặc định `store: false` trả về mã `voicekey_...` lưu tại `localStorage` 7 ngày để bảo vệ hạn ngạch 200 giọng của chủ sở hữu, hỗ trợ xuất/nhập file `.svoice`)**.
4. **Bảo vệ Quỹ API Chủ sở hữu 4 Lớp & Bàn trộn Âm thanh Auto-Ducking (-14dB)**:
   - **Lớp 1**: Structured Output JSON Schema.
   - **Lớp 2**: `IndexedDB` Audio Hash Cache (tự động phát lại các câu không đổi mà không tốn Token).
   - **Lớp 3**: Multi-speaker Dialogue Batching trong 1 lệnh `interactions.create`.
   - **Lớp 4**: Fair-Use Rate Limiter (Giới hạn 3.000 ký tự/lượt, chờ 5 giây chống bấm lặp, 20 lượt/ngày/thiết bị).
   - **Auto-Ducking DSP**: Tự động hạ nhạc nền xuống `-14dB` khi có tiếng đọc và nâng nhạc lên ở khoảng nghỉ `<short pause>` / `<long pause>`.

---

## 🚀 Hướng dẫn Cài đặt & Triển khai (Local & Vercel)

```bash
# 1. Cài đặt thư viện
npm install

# 2. Tạo file môi trường cục bộ từ mẫu
cp .env.example .env.local
# Điền VITE_GEMINI_API_KEY="..." vào .env.local (hoặc để trống để trải nghiệm ngay với bộ tổng hợp sóng âm 24kHz dự phòng)

# 3. Chạy máy chủ phát triển
npm run dev

# 4. Đóng gói bản Production
npm run build
```

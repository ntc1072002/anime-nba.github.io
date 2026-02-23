
# 🎬 BAOTANGTRUYEN - Web Anime & Manga Platform

## 📝 Tổng Quan
Platform đọc truyện (manga) & xem anime hoàn chỉnh với:
- ✅ Đọc truyện & xem anime song song
- ✅ Upload ảnh bìa (cover) cho truyện/anime
- ✅ Quản trị nội dung qua Admin Panel
- ✅ Authentication (Firebase Auth + JWT)
- ✅ Cloud Storage (Google Cloud Storage)
- ✅ Database (Firestore)
- ✅ Responsive UI/UX

---

## 🚀 Cách Chạy

### Yêu Cầu
- Node.js v14+
- npm hoặc yarn
- Firebase Project (có Firestore & Cloud Storage)
- Service Account Key từ Firebase

### Bước 1: Chuẩn Bị Firebase
1. Tạo Firebase Project: https://console.firebase.google.com/
2. Tải Service Account Key → lưu vào `backend/serviceAccountKey.json`
3. Lấy Firebase Config → cập nhật vào `frontend/src/config-firebase.js`

### Bước 2: Chạy Backend
```bash
cd backend
npm install
npm start
# Server chạy trên http://localhost:5000
```

### Bước 3: Chạy Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend chạy trên http://localhost:5173
```

---

## 📚 Tài Liệu

### 📖 Hướng dẫn Chính
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Hướng dẫn cấu hình & sử dụng toàn bộ
- **[COVER_UPLOAD_GUIDE.md](COVER_UPLOAD_GUIDE.md)** - Hướng dẫn upload ảnh bìa
- **[CHANGELOG.md](CHANGELOG.md)** - Các thay đổi & next steps

### 🌐 Truy Cập
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api/...
- **Admin Panel**: http://localhost:5173/#/admin

---

## 🔐 Tính Năng

### Người Dùng
- ✅ Xem danh sách truyện/anime
- ✅ Xem ảnh bìa (cover)
- ✅ Đọc chapters
- ✅ Xem episodes
- ✅ Đăng nhập/đăng xuất
- ✅ Follow/Like truyện/anime

### Admin
- ✅ Thêm truyện/anime
- ✅ Upload ảnh bìa
- ✅ Thêm chapters/episodes
- ✅ Quản lý người dùng

---

## 📂 Cấu Trúc Dự Án

```
baotangtruyen_vippro/
├── backend/
│   ├── config/
│   │   └── db.js           # Firebase config
│   ├── server.js           # Main backend
│   ├── package.json
│   └── serviceAccountKey.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── utils/
│   │   ├── config.js       # API_BASE config
│   │   └── config-firebase.js
│   ├── package.json
│   └── index.html
├── database/
│   └── schema.sql          # (Legacy - dùng Firestore)
├── SETUP_GUIDE.md          # Hướng dẫn cấu hình
├── COVER_UPLOAD_GUIDE.md   # Hướng dẫn upload ảnh
├── CHANGELOG.md            # Thay đổi
└── README.md               # File này
```

---

## 🐛 Debug & Vấn Đề

### Ảnh bìa không hiển thị?
→ Xem [COVER_UPLOAD_GUIDE.md](COVER_UPLOAD_GUIDE.md#-debug---nếu-ảnh-không-hiển-thị)

### Không thể đăng nhập?
→ Xem [SETUP_GUIDE.md](SETUP_GUIDE.md#-debug--vấn-đề-thường-gặp)

### Frontend không kết nối Backend?
→ Kiểm tra `config.js` → `API_BASE` = `http://localhost:5000`

---

## 📱 API Endpoints

| Method | Endpoint | Mô Tả |
|--------|----------|-------|
| GET | `/api/manga` | Lấy danh sách truyện |
| GET | `/api/manga/:id` | Lấy chi tiết truyện |
| GET | `/api/manga/:id/chapters` | Lấy chapters |
| POST | `/api/manga` | Tạo truyện (admin) |
| POST | `/api/manga/:id/cover` | Upload cover (admin) |
| GET | `/api/anime` | Lấy danh sách anime |
| GET | `/api/anime/:id` | Lấy chi tiết anime |
| GET | `/api/anime/:id/episodes` | Lấy episodes |
| POST | `/api/anime` | Tạo anime (admin) |
| POST | `/api/anime/:id/cover` | Upload cover (admin) |

---

## 🚀 Deploy

### Frontend (Vercel, Netlify)
```bash
npm run build
# Deploy folder `dist/`
```

### Backend (Heroku, Railway, Cloud Run)
```bash
# Set environment variables
PORT=5000
NODE_ENV=production
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

git push heroku main
```

---

## 📝 Ghi Chú

- Dùng **Firestore** (không phải MySQL)
- Ảnh bìa lưu trên **Google Cloud Storage**
- Auth dùng **Firebase Auth + JWT**
- Frontend: **React + Vite**
- Backend: **Node.js + Express**

---

## 📞 Liên Hệ

Kiểm tra các file hướng dẫn để biết thêm chi tiết:
- [SETUP_GUIDE.md](SETUP_GUIDE.md)
- [COVER_UPLOAD_GUIDE.md](COVER_UPLOAD_GUIDE.md)
- [CHANGELOG.md](CHANGELOG.md)

---

**Cập nhật**: 2024 - Web-Anime Platform

# 📸 Media Gallery - Cloud Edition

Upload và chia sẻ ảnh/video với mọi người. File được lưu trên **Cloudinary** 

## 🚀 Deploy lên Render.com 

### Bước 1: Chuẩn bị Cloudinary

1. Đăng ký miễn phí tại [cloudinary.com](https://cloudinary.com)
2. Copy credentials từ Dashboard:
   - Cloud Name
   - API Key
   - API Secret

### Bước 2: Deploy lên Render

1. Push code lên **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Media Gallery with Cloudinary"
   git remote add origin https://github.com/YOUR_USERNAME/media-gallery.git
   git push -u origin main
   ```

2. Đăng nhập [render.com](https://render.com) bằng GitHub

3. Tạo **New → Web Service**:
   - Connect repo của bạn
   - Region: Singapore (gần nhất)
   - Branch: `main`
   - Root Directory: (để trống)
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

4. Thêm Environment Variables (trong tab Environment):
   ```
   CLOUDINARY_CLOUD_NAME = your_cloud_name
   CLOUDINARY_API_KEY = your_api_key
   CLOUDINARY_API_SECRET = your_api_secret
   ```

5. Nhấn **Create Web Service** và đợi deploy (~2-3 phút)

6. Sau khi xong, website sẽ có URL dạng: `https://your-app.onrender.com`

### Bước 3: Hoàn tất! 🎉

- Truy cập URL của bạn
- Upload ảnh/video
- Chia sẻ link cho mọi người!

## 💡 Tính năng

- ✅ Upload ảnh (JPG, PNG, GIF, WEBP, SVG)
- ✅ Upload video (MP4, WEBM, MOV)
- ✅ Lưu trên Cloudinary (25GB miễn phí)
- ✅ Server chạy 24/7 trên Render
- ✅ Responsive trên mobile
- ✅ Xem fullscreen với lightbox
- ✅ Xóa file trực tiếp

## 🔧 Chạy local (để test)

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/media-gallery.git
cd media-gallery

# 2. Tạo file .env từ .env.example
cp .env.example .env
# Sửa .env với credentials của bạn

# 3. Install & chạy
npm install
npm start

# 4. Mở http://localhost:3000
```

## 📁 Cấu trúc file

```
├── server.js          # Backend (Express + Cloudinary)
├── index.html         # Frontend
├── package.json       # Dependencies
├── .env.example       # Template cho env variables
├── .gitignore         # Ignores node_modules, .env
├── README.md          # Hướng dẫn
└── SPEC.md           # Specification
```

## ⚠️ Lưu ý

- **Cloudinary free tier**: 25GB storage, 25GB bandwidth/tháng
- **Render free tier**: Service sleep sau 15 phút không dùng, wake up ~30s
  - Để tránh sleep: Dùng Render Background Worker hoặc cron job ping

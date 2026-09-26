# Media Gallery

Thư viện ảnh và video công khai. Khách có thể xem, tìm kiếm, lọc, mở toàn màn hình và sao chép liên kết. Chỉ admin đăng nhập mới có thể tải lên hoặc xóa tệp. Media tiếp tục được lưu trên Cloudinary trong thư mục `media-gallery`.

## Cấu hình admin

Không có đăng ký công khai. Tạo một tài khoản quản trị duy nhất bằng các biến môi trường:

- `ADMIN_USERNAME`: tên đăng nhập admin.
- `ADMIN_PASSWORD_HASH`: mật khẩu admin đã băm bằng scrypt.
- `SESSION_SECRET`: khóa ngẫu nhiên dùng ký cookie phiên, tối thiểu 32 ký tự.

Tạo hash trên máy của bạn. Lệnh sẽ hỏi mật khẩu không hiển thị ký tự và chỉ in chuỗi hash:

```bash
node scripts/hash-admin-password.js
```

Tạo `SESSION_SECRET` bằng lệnh sau và lưu trực tiếp vào biến môi trường, không đưa vào Git:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cookie phiên có `HttpOnly`, `SameSite=Strict`, thời hạn 8 giờ và bật `Secure` khi kết nối HTTPS. Sau 5 lần đăng nhập sai từ cùng IP, endpoint đăng nhập tạm khóa trong 15 phút.

## Chạy local

```bash
npm install
cp .env.example .env
```

Điền Cloudinary credentials cùng `ADMIN_USERNAME`, hash từ script và một khóa `SESSION_SECRET` ngẫu nhiên vào `.env`. Không commit `.env`; file này đã nằm trong `.gitignore`.

```bash
npm start
```

Mở [http://localhost:3000](http://localhost:3000). Thư viện vẫn công khai; chọn **Đăng nhập admin** để tải lên hoặc xóa.

## Cấu hình Render

Trước khi deploy phiên bản này, mở **Web Service → Environment** trên Render và thêm các biến dưới đây. Nếu deploy khi thiếu biến admin, server sẽ dừng khởi động để không vô tình mở upload/xóa công khai. Tạo hash và khóa phiên trên máy của bạn; không gửi mật khẩu cho người khác và không ghi giá trị thật vào repository.

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
SESSION_SECRET
```

Lưu thay đổi và deploy lại service. Truy cập URL HTTPS của ứng dụng, nhấn **Đăng nhập admin** rồi đăng nhập bằng `ADMIN_USERNAME` và mật khẩu gốc tương ứng với hash. Nếu thay `SESSION_SECRET`, các cookie phiên hiện tại mất hiệu lực.

## Quyền truy cập API

- `GET /api/media`: công khai.
- `GET /api/auth/status`: công khai, chỉ trả trạng thái đăng nhập.
- `POST /api/auth/login` và `POST /api/auth/logout`: endpoint phiên admin.
- `POST /api/upload`: yêu cầu phiên admin hợp lệ.
- `DELETE /api/media?public_id=...&resource_type=image|video`: yêu cầu phiên admin hợp lệ. Route `DELETE /api/media/:id` cũng được hỗ trợ.

## Tính năng

- Tải nhiều ảnh và video lên Cloudinary; JPEG, PNG và WebP được nén trên trình duyệt khi phù hợp.
- GIF, SVG và video được gửi nguyên trạng.
- Tìm kiếm theo tên, lọc ảnh/video, sao chép liên kết và xem toàn màn hình.
- Thống kê thư viện, trạng thái kết nối, tiến trình upload và giao diện responsive.
- Không có tài khoản tự đăng ký.

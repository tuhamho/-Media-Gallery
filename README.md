# Media Gallery

Thư viện ảnh và video công khai. Khách có thể xem, tìm kiếm, lọc theo loại/album/ngày, yêu thích trên trình duyệt, sao chép liên kết và tải tệp. Chỉ admin đăng nhập mới có thể tải lên, xóa tệp, quản lý album và xem thống kê. Media tiếp tục được lưu trên Cloudinary trong thư mục `media-gallery`.

## Website

Truy cập [Media Gallery](https://media-gallery-2he4.onrender.com/).

## Cấu hình admin

Không có đăng ký công khai. Tạo một tài khoản quản trị duy nhất bằng các biến môi trường:

- `ADMIN_USERNAME`: tên đăng nhập admin.
- `ADMIN_PASSWORD_HASH`: mật khẩu admin đã băm bằng scrypt.
- `SESSION_SECRET`: khóa ngẫu nhiên dùng ký cookie phiên, tối thiểu 32 ký tự.

Tạo hash trên máy của bạn. Lệnh sẽ hỏi mật khẩu không hiển thị ký tự và chỉ in chuỗi hash:

```bash
node scripts/hash-admin-password.js
```

Tạo `SESSION_SECRET` trên máy của bạn và nhập trực tiếp vào biến môi trường; không đưa giá trị vào Git:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cookie phiên có `HttpOnly`, `SameSite=Strict`, thời hạn 8 giờ và bật `Secure` khi kết nối HTTPS. Sau 5 lần đăng nhập sai từ cùng IP, endpoint đăng nhập tạm khóa trong 15 phút.

## Chạy local

```bash
npm install
cp .env.example .env
```

Điền Cloudinary credentials cùng `ADMIN_USERNAME`, hash từ script và một `SESSION_SECRET` ngẫu nhiên vào `.env`. Không commit `.env`; file này đã nằm trong `.gitignore`.

```bash
npm start
```

Mở [http://localhost:3000](http://localhost:3000). Khách xem thư viện công khai; chọn **Đăng nhập admin** để tải lên, xóa hoặc quản lý album. Từ `index.html` có thể kiểm tra tìm kiếm, bộ lọc, yêu thích và giao diện sáng/tối.

## Cấu hình Render

Trong **Web Service → Environment** trên Render, cấu hình các biến sau. Nếu thiếu cấu hình admin, server sẽ dừng khởi động để không mở upload/xóa công khai. Tạo hash và khóa phiên trên máy của bạn; không gửi mật khẩu cho người khác và không ghi giá trị thật vào repository.

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
SESSION_SECRET
```

Lưu thay đổi và deploy lại service. Mở URL HTTPS, nhấn **Đăng nhập admin**, rồi dùng `ADMIN_USERNAME` và mật khẩu gốc tương ứng với hash. Nếu thay `SESSION_SECRET`, các cookie phiên hiện tại mất hiệu lực. Không cần thêm dịch vụ database hay biến môi trường cho album.

## Album và dữ liệu bền vững

Danh sách album cùng liên kết tới media được lưu thành một manifest JSON riêng trong Cloudinary (`resource_type: raw`, thư mục `media-gallery`), thay vì filesystem tạm của Render. Vì vậy album vẫn tồn tại sau lần khởi động lại/deploy. Tạo, đổi tên, gán hoặc xóa album không xóa các ảnh/video hiện có; xóa media bằng chức năng quản trị sẽ bỏ liên kết của tệp đó khỏi album sau khi Cloudinary xác nhận.

Manifest chỉ chứa tên album, thời gian tạo và public ID của media vốn công khai. Các ảnh/video hiện có không bị di chuyển hay ghi đè. Tài khoản Cloudinary cần quyền upload và đọc/xóa media hiện dùng; thao tác album cần thêm quyền upload/ghi một tệp raw. Nếu quyền đó chưa có, album sẽ báo lỗi lưu.

## Tính năng và giới hạn

- JPEG, PNG và WebP được thu nhỏ cạnh dài tối đa khoảng 1920 px rồi mã hóa WebP trong trình duyệt nếu trình duyệt hỗ trợ; GIF, SVG và video không bị nén. Nếu không hỗ trợ WebP, ảnh gốc được tải lên.
- Giới hạn tải lên hiện tại là 100 MiB mỗi tệp; video trên 80 MiB có cảnh báo trước khi tải. Dung lượng thống kê lấy từ dữ liệu Cloudinary trả về.
- Yêu thích và giao diện sáng/tối được lưu riêng trong trình duyệt đang dùng.
- Trang quản trị lấy hạn mức dung lượng từ Cloudinary Admin API nếu API trả về dữ liệu hợp lệ; nếu không, giao diện ghi rõ không khả dụng, không tự ước lượng.
- Tệp có nút liên kết công khai và tải về. Tệp tải về qua endpoint ứng dụng để đặt tên tệp dễ hiểu.

## Giao diện cá nhân

Nút **Themes** mở 18 lựa chọn, chia thành các nhóm thiết kế gốc, tối giản, sáng tạo, kỷ niệm và đặc biệt. Mỗi lựa chọn có preview, mô tả và dấu đang chọn. Dùng Tab để di chuyển, Enter/Space để chọn, phím mũi tên/Home/End để duyệt các thẻ; Escape hoặc nút đóng để thoát. **Reset to Current design** đưa về giao diện gốc.

- `index.html`: giữ CSS gốc, tích hợp bộ chọn, các SVG tự vẽ và bố cục dải Photobooth bằng chính các thẻ media hiện có.
- `themes.css`: bố cục và chi tiết riêng cho từng theme; giảm họa tiết trên điện thoại, giữ focus rõ và tôn trọng `prefers-reduced-motion`.
- `themes.js`: đọc lựa chọn trước khi nội dung trang xuất hiện; lưu theme và chế độ sáng/tối riêng từng theme trong localStorage. Không gọi API hoặc lưu thông tin đăng nhập.

Các khóa trình duyệt là `media-gallery-gallery-theme`, `media-gallery-theme` và `media-gallery-theme-modes`. Không cần thêm biến môi trường hoặc thư viện ứng dụng. Pinterest dùng CSS columns với tỷ lệ ảnh gốc; Classic Photobooth gom 3–4 tệp mỗi dải khi đủ tệp, dải cuối có thể ít hơn. Bộ lọc và thao tác với tệp vẫn dùng dữ liệu API hiện có.

Để kiểm tra bằng mắt, chạy `npm start`, mở trang ở kích thước desktop và điện thoại, so sánh Pinterest, Dashboard, Scrapbook, Polaroid, Neon Cyber và Dreamy Love. Thử đổi theme trong lúc upload, tải lại trang, mở viewer, trở về Current design và kiểm tra đăng xuất. Các kiểm tra DOM/CSS tự động không thay thế việc kiểm tra hiển thị thực tế hoặc upload lên Cloudinary.

## API

- `GET /api/media`, `GET /api/albums`, `GET /api/media/:publicId/download`: công khai.
- `GET /api/auth/status`: công khai, chỉ trả trạng thái đăng nhập.
- `POST /api/auth/login`, `POST /api/auth/logout`: quản lý phiên admin.
- `POST /api/upload`: yêu cầu phiên admin hợp lệ.
- `POST /api/albums`, `PATCH /api/albums/:albumId`, `DELETE /api/albums/:albumId`, `PUT /api/media/:publicId/album`: yêu cầu phiên admin.
- `GET /api/admin/stats`: yêu cầu phiên admin.
- `DELETE /api/media?public_id=...&resource_type=image|video` (hoặc `DELETE /api/media/:publicId`): yêu cầu phiên admin.

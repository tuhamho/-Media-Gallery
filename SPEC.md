# Media Gallery - Cloud Edition

## Project Overview
- **Type**: Full-stack web application (Node.js + Cloud)
- **Core Functionality**: Upload, preview, and share images/videos
- **Storage**: Cloudinary (25GB free tier)
- **Hosting**: Render.com (free tier, 24/7)

## Architecture

### Frontend (index.html)
- Single HTML file with embedded CSS/JS
- Responsive design with dark mode theme
- Drag & drop upload zone
- Media grid with thumbnails
- Lightbox viewer
- Share link copy

### Backend (server.js)
- Express.js server
- Multer + Cloudinary for file uploads
- REST API endpoints
- CORS enabled

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/media` | Get all media files |
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload files (multipart) |
| DELETE | `/api/media/:id` | Delete a file |

## Deployment Steps

1. **Cloudinary Setup**
   - Sign up at cloudinary.com
   - Get Cloud Name, API Key, API Secret
   - Create `.env` file with credentials

2. **GitHub Setup**
   - Create new repository
   - Push all code (except .env)

3. **Render.com Setup**
   - Connect GitHub repo
   - Add environment variables
   - Deploy

## Supported File Types

### Images
- JPG, JPEG, PNG, GIF, WEBP, SVG

### Videos
- MP4, WEBM, MOV, AVI

## Limitations

### Free Tier
- **Cloudinary**: 25GB storage, 25GB bandwidth/month
- **Render**: Sleeps after 15 min inactivity

### Data Persistence
- Media metadata stored in memory (resets on restart)
- Files stored on Cloudinary (persistent)
- For production: add database (MongoDB Atlas free tier)

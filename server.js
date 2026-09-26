const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer with Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'media-gallery',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mov', 'avi'],
        transformation: [{ quality: 'auto' }]
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Serve static files
app.use(express.static(__dirname));

// Store media metadata (in memory - for demo, use DB in production)
const mediaFiles = [];

// API: Get all media files
app.get('/api/media', (req, res) => {
    res.json(mediaFiles);
});

// API: Upload files
app.post('/api/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => {
        const mediaItem = {
            id: file.public_id,
            name: file.original_filename,
            url: file.secure_url,
            type: file.resource_type === 'video' ? 'video' : 'image',
            size: file.bytes,
            createdAt: new Date()
        };

        // Add to our in-memory store
        mediaFiles.unshift(mediaItem);

        return mediaItem;
    });

    res.json({
        success: true,
        files: uploadedFiles
    });
});

// API: Delete a file
app.delete('/api/media/:publicId', async (req, res) => {
    const publicId = req.params.publicId;

    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });

        // Remove from in-memory store
        const index = mediaFiles.findIndex(f => f.id === publicId);
        if (index > -1) {
            mediaFiles.splice(index, 1);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

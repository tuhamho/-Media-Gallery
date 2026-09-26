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

const MEDIA_FOLDER_PREFIX = 'media-gallery/';

function toMediaItem(resource, resourceType) {
    const publicId = resource.public_id || resource.filename;
    const format = resource.format;
    const fallbackName = publicId ? publicId.split('/').pop() : 'Untitled';
    const name = resource.originalname || resource.original_filename ||
        (format && !fallbackName.toLowerCase().endsWith(`.${format.toLowerCase()}`)
            ? `${fallbackName}.${format}`
            : fallbackName);

    return {
        id: publicId,
        name,
        url: resource.secure_url || resource.path,
        type: resourceType === 'video' || (resource.mimetype || '').startsWith('video/') ? 'video' : 'image',
        size: Number(resource.bytes ?? resource.size) || 0,
        createdAt: resource.created_at || new Date().toISOString()
    };
}

async function listCloudinaryResources(resourceType) {
    const resources = [];
    let nextCursor;

    do {
        const result = await cloudinary.api.resources({
            type: 'upload',
            resource_type: resourceType,
            prefix: MEDIA_FOLDER_PREFIX,
            max_results: 500,
            ...(nextCursor ? { next_cursor: nextCursor } : {})
        });
        resources.push(...result.resources.map(resource => toMediaItem(resource, resourceType)));
        nextCursor = result.next_cursor;
    } while (nextCursor);

    return resources;
}

// API: Get all media files
app.get('/api/media', async (req, res) => {
    try {
        const [images, videos] = await Promise.all([
            listCloudinaryResources('image'),
            listCloudinaryResources('video')
        ]);
        res.json([...images, ...videos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
        console.error('Failed to list Cloudinary media:', error.message);
        res.status(500).json({ error: 'Failed to load media' });
    }
});

// API: Upload files
app.post('/api/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => toMediaItem({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
    }, file.mimetype && file.mimetype.startsWith('video/') ? 'video' : 'image'));

    res.json({
        success: true,
        files: uploadedFiles
    });
});

// API: Delete a file
app.delete('/api/media', async (req, res) => {
    const publicId = req.query.public_id;
    const resourceType = req.query.resource_type;
    if (typeof publicId !== 'string' || !publicId || !['image', 'video'].includes(resourceType)) {
        return res.status(400).json({ error: 'Invalid media identifier or resource type' });
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        if (result.result !== 'ok' && result.result !== 'not found') {
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete Cloudinary media:', error.message);
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

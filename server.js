const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { promisify } = require('util');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'mg_admin_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map();
const activeSessions = new Map();

const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const sessionSecret = process.env.SESSION_SECRET;
const hashParts = (adminPasswordHash || '').split('$');
if (!adminUsername || hashParts.length !== 3 || hashParts[0] !== 'scrypt' ||
    !/^[a-f0-9]{32,}$/i.test(hashParts[1]) || !/^[a-f0-9]{128}$/i.test(hashParts[2]) ||
    !sessionSecret || sessionSecret.length < 32) {
    throw new Error('Admin authentication is not configured. Set ADMIN_USERNAME, a valid ADMIN_PASSWORD_HASH, and SESSION_SECRET.');
}
const configuredSalt = Buffer.from(hashParts[1], 'hex');
const configuredPasswordHash = Buffer.from(hashParts[2], 'hex');

app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));

function signSession(timestamp, nonce) {
    return crypto.createHmac('sha256', sessionSecret).update(`admin.${timestamp}.${nonce}`).digest('hex');
}

function getSessionCookie(req) {
    const cookieHeader = req.headers.cookie || '';
    const pair = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
    if (!pair) return '';
    try {
        return decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
    } catch (error) {
        return '';
    }
}

function isAdminSessionValid(req) {
    const parts = getSessionCookie(req).split('.');
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{64}$/i.test(parts[2])) return false;
    const issuedAt = Number(parts[0]);
    const now = Date.now();
    if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > SESSION_MAX_AGE_MS) return false;
    const expected = Buffer.from(signSession(parts[0], parts[1]), 'hex');
    const supplied = Buffer.from(parts[2], 'hex');
    const signatureMatches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    return signatureMatches && activeSessions.get(parts[1]) === issuedAt + SESSION_MAX_AGE_MS;
}

function requireAdmin(req, res, next) {
    if (!isAdminSessionValid(req)) return res.status(401).json({ error: 'Admin sign-in required', code: 'AUTH_REQUIRED' });
    next();
}

function clearLoginAttempts(key) {
    loginAttempts.delete(key);
}

app.get('/api/auth/status', (req, res) => {
    const authenticated = isAdminSessionValid(req);
    res.json({ authenticated, username: authenticated ? adminUsername : null });
});

app.post('/api/auth/login', async (req, res) => {
    const key = req.ip;
    const now = Date.now();
    let record = loginAttempts.get(key);
    if (record && now - record.firstAttemptAt >= LOGIN_WINDOW_MS) {
        loginAttempts.delete(key);
        record = null;
    }
    if (record && record.count >= MAX_LOGIN_ATTEMPTS) {
        const retrySeconds = Math.ceil((LOGIN_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
        res.set('Retry-After', String(retrySeconds));
        return res.status(429).json({ error: 'Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau ít phút.' });
    }

    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    let suppliedHash;
    try {
        suppliedHash = await scrypt(password, configuredSalt, configuredPasswordHash.length);
    } catch (error) {
        console.error('Admin password verification failed:', error.message);
        return res.status(500).json({ error: 'Không thể xác thực lúc này.' });
    }
    const usernameMatches = username === adminUsername;
    const passwordMatches = crypto.timingSafeEqual(configuredPasswordHash, suppliedHash);
    if (!usernameMatches || !passwordMatches) {
        if (!record) record = { firstAttemptAt: now, count: 0 };
        record.count += 1;
        loginAttempts.set(key, record);
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    clearLoginAttempts(key);
    const timestamp = String(now);
    const nonce = crypto.randomBytes(16).toString('hex');
    const value = `${timestamp}.${nonce}.${signSession(timestamp, nonce)}`;
    for (const [activeNonce, expiresAt] of activeSessions) {
        if (expiresAt <= now) activeSessions.delete(activeNonce);
    }
    activeSessions.set(nonce, now + SESSION_MAX_AGE_MS);
    res.cookie(SESSION_COOKIE, value, {
        httpOnly: true,
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_MAX_AGE_MS
    });
    res.json({ success: true, username: adminUsername });
});

app.post('/api/auth/logout', (req, res) => {
    const sessionParts = getSessionCookie(req).split('.');
    if (sessionParts.length === 3) activeSessions.delete(sessionParts[1]);
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        sameSite: 'strict',
        path: '/'
    });
    res.json({ success: true });
});

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
app.post('/api/upload', requireAdmin, upload.array('files', 20), (req, res) => {
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
async function deleteMedia(req, res) {
    const publicId = req.params.publicId || req.query.public_id;
    const resourceType = req.query.resource_type || req.body?.resource_type;
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
}

app.delete('/api/media', requireAdmin, deleteMedia);
app.delete('/api/media/:publicId', requireAdmin, deleteMedia);

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

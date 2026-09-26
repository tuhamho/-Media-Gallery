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
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const loginAttempts = new Map();
const activeSessions = new Map();
const ALBUM_MANIFEST_PUBLIC_ID = 'media-gallery/gallery-metadata.json';
let albumStoreCache = null;
let albumMutationQueue = Promise.resolve();
let cloudinaryUsageCache = null;
let mediaListCache = null;
let mediaListPromise = null;

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
    limits: { fileSize: MAX_UPLOAD_BYTES } // 100MB limit
});

// Serve static files
app.use(express.static(__dirname));

const MEDIA_FOLDER_PREFIX = 'media-gallery/';
const MEDIA_CACHE_MS = 30 * 1000;

function cloneAlbumStore(store) {
    return { version: 1, albums: store.albums.map(album => ({ ...album, mediaIds: [...album.mediaIds] })) };
}

async function readAlbumStore() {
    if (albumStoreCache) return cloneAlbumStore(albumStoreCache);
    try {
        const resource = await cloudinary.api.resource(ALBUM_MANIFEST_PUBLIC_ID, { resource_type: 'raw', type: 'upload' });
        const response = await fetch(resource.secure_url);
        if (!response.ok) throw new Error('Unable to read the album manifest from Cloudinary.');
        const stored = await response.json();
        albumStoreCache = {
            version: 1,
            albums: Array.isArray(stored.albums) ? stored.albums.filter(album =>
                album && typeof album.id === 'string' && typeof album.name === 'string'
            ).map(album => ({
                id: album.id,
                name: album.name,
                createdAt: album.createdAt || new Date().toISOString(),
                mediaIds: Array.isArray(album.mediaIds) ? [...new Set(album.mediaIds.filter(id => typeof id === 'string'))] : []
            })) : []
        };
        return cloneAlbumStore(albumStoreCache);
    } catch (error) {
        if (error.http_code === 404 || error.error?.http_code === 404) {
            albumStoreCache = { version: 1, albums: [] };
            return cloneAlbumStore(albumStoreCache);
        }
        throw error;
    }
}

async function writeAlbumStore(store) {
    const content = Buffer.from(JSON.stringify(store), 'utf8').toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${content}`, {
        resource_type: 'raw',
        public_id: ALBUM_MANIFEST_PUBLIC_ID,
        overwrite: true,
        invalidate: true,
        type: 'upload'
    });
    albumStoreCache = cloneAlbumStore(store);
}

function mutateAlbumStore(mutation) {
    const operation = albumMutationQueue.then(async () => {
        const store = await readAlbumStore();
        const result = mutation(store);
        await writeAlbumStore(store);
        return result;
    });
    albumMutationQueue = operation.catch(() => {});
    return operation;
}

function validateAlbumName(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim();
    return name && name.length <= 80 && !/[\u0000-\u001f]/.test(name) ? name : null;
}

function getAlbumForMedia(store, publicId) {
    return store.albums.find(album => album.mediaIds.includes(publicId)) || null;
}

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

async function getLibraryMedia() {
    if (mediaListCache && Date.now() - mediaListCache.checkedAt < MEDIA_CACHE_MS) return mediaListCache.items;
    if (mediaListPromise) return mediaListPromise;
    mediaListPromise = (async () => {
        const [images, videos] = await Promise.all([
            listCloudinaryResources('image'),
            listCloudinaryResources('video')
        ]);
        const items = [...images, ...videos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        mediaListCache = { checkedAt: Date.now(), items };
        return items;
    })();
    try {
        return await mediaListPromise;
    } finally {
        mediaListPromise = null;
    }
}

// API: Get all media files
app.get('/api/media', async (req, res) => {
    try {
        const [media, store] = await Promise.all([
            getLibraryMedia(),
            readAlbumStore()
        ]);
        res.json(media.map(item => {
            const album = getAlbumForMedia(store, item.id);
            return { ...item, albumId: album?.id || null, albumName: album?.name || null };
        }));
    } catch (error) {
        console.error('Failed to list Cloudinary media:', error.message);
        res.status(500).json({ error: 'Failed to load media' });
    }
});

app.get('/api/albums', async (req, res) => {
    try {
        const [store, media] = await Promise.all([
            readAlbumStore(),
            getLibraryMedia()
        ]);
        const mediaAlbumIds = new Map();
        for (const album of store.albums) {
            for (const id of album.mediaIds) mediaAlbumIds.set(id, album.id);
        }
        res.json(store.albums.map(album => ({
            id: album.id,
            name: album.name,
            createdAt: album.createdAt,
            count: media.filter(item => mediaAlbumIds.get(item.id) === album.id).length
        })));
    } catch (error) {
        console.error('Failed to load albums:', error.message);
        res.status(500).json({ error: 'Failed to load albums' });
    }
});

app.post('/api/albums', requireAdmin, async (req, res) => {
    const name = validateAlbumName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Tên album phải có từ 1 đến 80 ký tự.' });
    try {
        const album = await mutateAlbumStore(store => {
            if (store.albums.some(existing => existing.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
                const error = new Error('Tên album đã tồn tại.');
                error.status = 409;
                throw error;
            }
            const created = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), mediaIds: [] };
            store.albums.push(created);
            return { id: created.id, name: created.name, createdAt: created.createdAt, count: 0 };
        });
        res.status(201).json(album);
    } catch (error) {
        if (error.status === 409) return res.status(409).json({ error: error.message });
        console.error('Failed to create album:', error.message);
        res.status(500).json({ error: 'Failed to save album' });
    }
});

app.patch('/api/albums/:albumId', requireAdmin, async (req, res) => {
    const name = validateAlbumName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Tên album phải có từ 1 đến 80 ký tự.' });
    try {
        const album = await mutateAlbumStore(store => {
            const target = store.albums.find(existing => existing.id === req.params.albumId);
            if (!target) return null;
            if (store.albums.some(existing => existing.id !== target.id && existing.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
                const error = new Error('Tên album đã tồn tại.');
                error.status = 409;
                throw error;
            }
            target.name = name;
            return { id: target.id, name: target.name, createdAt: target.createdAt, count: target.mediaIds.length };
        });
        if (!album) return res.status(404).json({ error: 'Không tìm thấy album.' });
        res.json(album);
    } catch (error) {
        if (error.status === 409) return res.status(409).json({ error: error.message });
        console.error('Failed to rename album:', error.message);
        res.status(500).json({ error: 'Failed to save album' });
    }
});

app.delete('/api/albums/:albumId', requireAdmin, async (req, res) => {
    try {
        const deleted = await mutateAlbumStore(store => {
            const index = store.albums.findIndex(album => album.id === req.params.albumId);
            if (index < 0) return false;
            store.albums.splice(index, 1);
            return true;
        });
        if (!deleted) return res.status(404).json({ error: 'Không tìm thấy album.' });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete album:', error.message);
        res.status(500).json({ error: 'Failed to save album' });
    }
});

app.put('/api/media/:publicId/album', requireAdmin, async (req, res) => {
    const { publicId } = req.params;
    const albumId = req.body?.albumId;
    if (albumId !== null && typeof albumId !== 'string') return res.status(400).json({ error: 'Invalid album ID.' });
    try {
        const existingMedia = (await getLibraryMedia()).find(item => item.id === publicId);
        if (!existingMedia || !publicId.startsWith(MEDIA_FOLDER_PREFIX)) {
            return res.status(404).json({ error: 'Không tìm thấy tệp trong thư viện.' });
        }
        const result = await mutateAlbumStore(store => {
            if (albumId && !store.albums.some(album => album.id === albumId)) {
                const error = new Error('Không tìm thấy album.');
                error.status = 404;
                throw error;
            }
            for (const album of store.albums) album.mediaIds = album.mediaIds.filter(id => id !== publicId);
            const album = albumId ? store.albums.find(item => item.id === albumId) : null;
            if (album) album.mediaIds.push(publicId);
            return album ? { id: album.id, name: album.name } : null;
        });
        res.json({ success: true, album: result });
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ error: error.message });
        console.error('Failed to assign media to album:', error.message);
        res.status(500).json({ error: 'Failed to update album assignment' });
    }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [media, store] = await Promise.all([
            getLibraryMedia(),
            readAlbumStore()
        ]);
        if (!cloudinaryUsageCache || Date.now() - cloudinaryUsageCache.checkedAt > 5 * 60 * 1000) {
            try {
                const usage = await cloudinary.api.usage();
                const storage = usage.storage;
                cloudinaryUsageCache = {
                    checkedAt: Date.now(),
                    storage: Number.isFinite(storage?.usage) && Number.isFinite(storage?.limit) && storage.limit > 0
                        ? { usageBytes: storage.usage, limitBytes: storage.limit, usedPercent: Number.isFinite(storage.used_percent) ? storage.used_percent : (storage.usage / storage.limit) * 100 }
                        : null
                };
            } catch (error) {
                console.error('Cloudinary usage report unavailable:', error.message);
                cloudinaryUsageCache = { checkedAt: Date.now(), storage: null };
            }
        }
        res.json({
            images: media.filter(item => item.type === 'image').length,
            videos: media.filter(item => item.type === 'video').length,
            totalSizeBytes: media.reduce((total, item) => total + item.size, 0),
            albumCount: store.albums.length,
            maxUploadBytes: MAX_UPLOAD_BYTES,
            cloudinaryStorage: cloudinaryUsageCache.storage || { available: false }
        });
    } catch (error) {
        console.error('Failed to load admin statistics:', error.message);
        res.status(500).json({ error: 'Failed to load statistics' });
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
    mediaListCache = null;

    res.json({
        success: true,
        files: uploadedFiles
    });
});

app.get('/api/media/:publicId/download', async (req, res) => {
    const publicId = req.params.publicId;
    const resourceType = req.query.resource_type;
    if (!publicId.startsWith(MEDIA_FOLDER_PREFIX) || !['image', 'video'].includes(resourceType)) {
        return res.status(400).json({ error: 'Invalid media download request.' });
    }
    const filename = String(req.query.name || 'media-download')
        .replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_')
        .replace(/\.{2,}/g, '.')
        .slice(0, 180);
    const downloadUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        type: 'upload',
        secure: true,
        flags: `attachment:${filename}`
    });
    res.redirect(302, downloadUrl);
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
        mediaListCache = null;
        await mutateAlbumStore(store => {
            for (const album of store.albums) album.mediaIds = album.mediaIds.filter(id => id !== publicId);
        });
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

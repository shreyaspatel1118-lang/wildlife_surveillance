const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const multer = require('multer');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const fs = require('fs');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
const upload = multer({ storage: multer.memoryStorage() });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in environment');
  process.exit(1);
}

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db, bucket, metaColl;
let galleryMode = 'mongo';

const localGalleryDir = path.join(__dirname, '..', 'output_evidence', 'gallery');
const localIndexPath = path.join(localGalleryDir, 'gallery_index.json');

if (!fs.existsSync(localGalleryDir)) {
  fs.mkdirSync(localGalleryDir, { recursive: true });
}

function readLocalIndex() {
  if (!fs.existsSync(localIndexPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(localIndexPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read local gallery index:', err.message);
    return [];
  }
}

function writeLocalIndex(items) {
  fs.writeFileSync(localIndexPath, JSON.stringify(items, null, 2));
}

async function init() {
  try {
    await client.connect();
    db = client.db();
    bucket = new GridFSBucket(db, { bucketName: 'images' });
    metaColl = db.collection('images_meta');
    await metaColl.createIndex({ classified: 1, shown: 1 });
    console.log('Mongo gallery mode enabled');
    galleryMode = 'mongo';
  } catch (err) {
    console.warn('MongoDB unavailable, using local gallery fallback:', err.message);
    galleryMode = 'local';
  }
}
init().catch(err => { console.error(err); galleryMode = 'local'; });

// Upload captured image (multipart field: image)
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file');
    if (galleryMode === 'mongo' && bucket && metaColl) {
      const filename = req.file.originalname || `img-${Date.now()}.jpg`;
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { capturedAt: new Date(), source: req.body.source || null }
      });
      uploadStream.end(req.file.buffer);
      uploadStream.on('finish', async (file) => {
        const meta = {
          fileId: file._id,
          filename: file.filename,
          capturedAt: file.metadata?.capturedAt || new Date(),
          classified: false,
          label: null,
          shown: false
        };
        await metaColl.insertOne(meta);
        res.json({ ok: true, id: file._id.toString(), meta });
      });
      uploadStream.on('error', (e) => { throw e; });
      return;
    }

    const id = randomUUID();
    const filename = req.file.originalname || `img-${Date.now()}.jpg`;
    const savedName = `${id}-${filename}`;
    const filePath = path.join(localGalleryDir, savedName);
    fs.writeFileSync(filePath, req.file.buffer);
    const meta = {
      fileId: id,
      filename,
      path: filePath,
      capturedAt: new Date().toISOString(),
      classified: false,
      label: null,
      shown: false
    };
    const items = readLocalIndex();
    items.push(meta);
    writeLocalIndex(items);
    res.json({ ok: true, id, meta });
  } catch (err) {
    console.error(err);
    res.status(500).send('upload error');
  }
});

// Mark an image as classified
app.post('/classify/:id', async (req, res) => {
  try {
    const label = req.body.label || null;
    if (galleryMode === 'mongo' && metaColl) {
      const id = new ObjectId(req.params.id);
      const result = await metaColl.findOneAndUpdate(
        { fileId: id },
        { $set: { classified: true, label, classifiedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!result.value) return res.status(404).send('not found');
      res.json({ ok: true, meta: result.value });
      return;
    }

    const items = readLocalIndex();
    const idx = items.findIndex(item => item.fileId === req.params.id);
    if (idx === -1) return res.status(404).send('not found');
    items[idx].classified = true;
    items[idx].label = label;
    items[idx].classifiedAt = new Date().toISOString();
    writeLocalIndex(items);
    res.json({ ok: true, meta: items[idx] });
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
});

// Serve raw image by GridFS fileId
app.get('/image/:id', async (req, res) => {
  try {
    if (galleryMode === 'mongo' && bucket) {
      const id = new ObjectId(req.params.id);
      const download = bucket.openDownloadStream(id);
      download.on('error', () => res.sendStatus(404));
      download.pipe(res);
      return;
    }

    const items = readLocalIndex();
    const item = items.find(entry => entry.fileId === req.params.id);
    if (!item || !item.path || !fs.existsSync(item.path)) {
      return res.sendStatus(404);
    }
    res.sendFile(item.path);
  } catch (err) {
    res.status(400).send('bad id');
  }
});

// Gallery: return only images that are classified
app.get('/gallery', async (req, res) => {
  try {
    const showOnlyNotShown = req.query.onlyNotShown === '1' || req.query.onlyNotShown === 'true';
    let items = [];

    if (galleryMode === 'mongo' && metaColl) {
      const query = { classified: true };
      if (showOnlyNotShown) query.shown = false;
      const docs = await metaColl.find(query).sort({ classifiedAt: -1 }).toArray();
      items = docs.map(d => ({
        id: d.fileId.toString(),
        filename: d.filename,
        label: d.label,
        url: `/image/${d.fileId.toString()}`
      }));
    } else {
      const docs = readLocalIndex().filter(item => item.classified && (!showOnlyNotShown || !item.shown));
      items = docs.sort((a, b) => new Date(b.classifiedAt || b.capturedAt) - new Date(a.classifiedAt || a.capturedAt)).map(d => ({
        id: d.fileId,
        filename: d.filename,
        label: d.label,
        url: `/image/${d.fileId}`
      }));
    }
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
});

// Mark items shown
app.post('/gallery/mark-shown', async (req, res) => {
  try {
    if (galleryMode === 'mongo' && metaColl) {
      const ids = (req.body.ids || []).map(i => new ObjectId(i));
      await metaColl.updateMany({ fileId: { $in: ids } }, { $set: { shown: true, shownAt: new Date() } });
      return res.json({ ok: true });
    }

    const ids = new Set(req.body.ids || []);
    const items = readLocalIndex();
    for (const item of items) {
      if (ids.has(item.fileId)) {
        item.shown = true;
        item.shownAt = new Date().toISOString();
      }
    }
    writeLocalIndex(items);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).send('error'); }
});

// Serve static gallery page
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Gallery server listening on ${PORT}`));

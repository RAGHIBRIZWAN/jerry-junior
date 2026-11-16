import { Router } from 'express';
import multer from 'multer';
import Category from '../../models/Category.js';
import Product from '../../models/Product.js';
import { saveCategoryImage, deleteMedia } from '../../utils/images.js';

const router = Router();
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    cb(badRequest('Photo must be a JPG, PNG or WEBP image'));
  },
}).single('image');

const keyOf = (name) => String(name || '').trim().toLowerCase();

// Every category used by a product, plus the photo you set for it (if any).
router.get('/', async (req, res) => {
  const [names, docs] = await Promise.all([Product.distinct('category', { category: { $ne: '' } }), Category.find().lean()]);
  const byKey = new Map(docs.map((d) => [d.key, d]));
  const seen = new Set();
  const list = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    const key = keyOf(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const count = await Product.countDocuments({ category: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    list.push({ name: byKey.get(key)?.name || name, image: byKey.get(key)?.image || '', products: count });
  }
  res.json(list);
});

// Set or replace the photo of a category. Body (multipart): name + image
router.post('/', upload, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw badRequest('Category name is required');
  if (!req.file) throw badRequest('Please choose a photo');
  const image = await saveCategoryImage(req.file.buffer).catch((err) => {
    throw err.status ? err : badRequest(`Could not read that photo: ${err.message}`);
  });
  const key = keyOf(name);
  const old = await Category.findOne({ key });
  const doc = await Category.findOneAndUpdate({ key }, { name, key, image }, { upsert: true, returnDocument: 'after' });
  if (old?.image) await deleteMedia(old.image);
  res.status(201).json(doc);
});

// Remove the photo of a category (the home page then shows its first letter instead).
router.delete('/', async (req, res) => {
  const key = keyOf(req.query.name);
  if (!key) throw badRequest('Category name is required');
  const doc = await Category.findOneAndDelete({ key });
  if (doc?.image) await deleteMedia(doc.image);
  res.json({ ok: true });
});

export default router;

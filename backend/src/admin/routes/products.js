import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import { saveProductImage, saveProductVideo, deleteMedia, VIDEO_TYPES } from '../../utils/images.js';

const router = Router();

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024; // videos live in the free Atlas database (512MB), so keep them small

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO, files: 20 },
  fileFilter(req, file, cb) {
    if (file.fieldname === 'images' && IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    if (file.fieldname === 'videos' && VIDEO_TYPES[file.mimetype]) return cb(null, true);
    cb(badRequest(`"${file.originalname}" is not a supported file (photos: JPG/PNG/WEBP, videos: MP4/WEBM/MOV)`));
  },
}).fields([
  { name: 'images', maxCount: 15 },
  { name: 'videos', maxCount: 5 },
]);

function parseFields(body) {
  const title = String(body.title || '').trim();
  const price = Number(body.price);
  if (!title) throw badRequest('Name is required');
  if (!Number.isFinite(price) || price < 0) throw badRequest('Price must be a positive number');
  const sizes = String(body.sizes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const bool = (v) => v === 'true' || v === true || v === 'on';
  return {
    title,
    caption: String(body.caption || '').trim(),
    price: Math.round(price),
    category: String(body.category || '').trim(),
    sizes: [...new Set(sizes)],
    inStock: bool(body.inStock),
    newArrival: bool(body.newArrival),
    published: body.published === undefined ? true : bool(body.published),
  };
}

const parseList = (json) => {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * Works out the final image and video lists.
 * - existingImages / existingVideos: JSON arrays of current paths to keep (in order)
 * - uploaded files: new images / videos
 * - cover: "existing:<path>" or "new:<index>" -> that image moves to position 0
 */
async function buildMedia(body, files, previous = { images: [], videos: [] }) {
  const newImages = files.images || [];
  const newVideos = files.videos || [];
  for (const f of newImages) if (f.size > MAX_IMAGE) throw badRequest(`"${f.originalname}" is bigger than 5MB`);

  const keepImages = parseList(body.existingImages).filter((s) => previous.images.includes(s));
  const keepVideos = parseList(body.existingVideos).filter((s) => previous.videos.includes(s));

  const added = [];
  try {
    for (const f of newImages) added.push(await saveProductImage(f.buffer));
  } catch (err) {
    await Promise.all(added.map(deleteMedia));
    throw badRequest(`Could not read one of the photos: ${err.message}`);
  }
  const addedVideos = [];
  for (const f of newVideos) addedVideos.push(await saveProductVideo(f.buffer, path.extname(f.originalname) || VIDEO_TYPES[f.mimetype]));

  const images = [...keepImages, ...added];
  const cover = String(body.cover || '');
  let coverSrc;
  if (cover.startsWith('existing:')) coverSrc = cover.slice(9);
  else if (cover.startsWith('new:')) coverSrc = added[Number(cover.slice(4))];
  if (coverSrc && images.includes(coverSrc)) images.unshift(...images.splice(images.indexOf(coverSrc), 1));

  return {
    images,
    videos: [...keepVideos, ...addedVideos],
    added: [...added, ...addedVideos],
    removed: [
      ...previous.images.filter((s) => !keepImages.includes(s)),
      ...previous.videos.filter((s) => !keepVideos.includes(s)),
    ],
  };
}

router.get('/', async (req, res) => {
  res.json(await Product.find().sort({ createdAt: -1 }).lean());
});

router.post('/', upload, async (req, res) => {
  const fields = parseFields(req.body);
  const media = await buildMedia(req.body, req.files || {});
  try {
    const product = await Product.create({ ...fields, images: media.images, videos: media.videos });
    res.status(201).json(product);
  } catch (err) {
    await Promise.all(media.added.map(deleteMedia));
    throw err;
  }
});

router.put('/:id', upload, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const fields = parseFields(req.body);
  const media = await buildMedia(req.body, req.files || {}, { images: product.images, videos: product.videos || [] });
  Object.assign(product, fields, { images: media.images, videos: media.videos });
  await product.save();
  await Promise.all(media.removed.map(deleteMedia));
  res.json(product);
});

// Quick toggles from the products list: { inStock }, { published }, { newArrival }
router.patch('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  const update = {};
  if (typeof req.body?.inStock === 'boolean') update.inStock = req.body.inStock;
  if (typeof req.body?.published === 'boolean') update.published = req.body.published;
  if (typeof req.body?.newArrival === 'boolean') update.newArrival = req.body.newArrival;
  if (update.published) {
    const p = await Product.findById(req.params.id, { price: 1 }).lean();
    if (p && !p.price) throw badRequest('Set a price before publishing this product (click Edit).');
  }
  const product = await Product.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  // Old orders keep a snapshot that may point at the cover image. Keep images still used by an order.
  const Order = mongoose.model('Order');
  for (const src of product.images) {
    if (!(await Order.exists({ 'items.image': src }))) await deleteMedia(src);
  }
  await Promise.all((product.videos || []).map(deleteMedia));
  res.json({ ok: true });
});

export default router;

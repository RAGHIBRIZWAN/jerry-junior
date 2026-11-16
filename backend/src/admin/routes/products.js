import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import { saveProductImage, deleteMedia } from '../../utils/images.js';

const router = Router();

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE = 5 * 1024 * 1024;

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE, files: 15 },
  fileFilter(req, file, cb) {
    if (file.fieldname === 'images' && IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(badRequest(`"${file.originalname}" is not a supported photo (use JPG, PNG or WEBP)`));
  },
}).array('images', 15);

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
 * Works out the final photo list.
 * - existingImages: JSON array of current photo addresses to keep (in order)
 * - uploaded files: new photos (sent to Cloudinary)
 * - cover: "existing:<address>" or "new:<index>" -> that photo moves to position 0
 */
async function buildImages(body, files, previous = []) {
  const keep = parseList(body.existingImages).filter((s) => previous.includes(s));

  const added = [];
  try {
    for (const f of files) added.push(await saveProductImage(f.buffer));
  } catch (err) {
    await Promise.all(added.map(deleteMedia));
    throw err.status ? err : badRequest(`Could not read one of the photos: ${err.message}`);
  }

  const images = [...keep, ...added];
  const cover = String(body.cover || '');
  let coverSrc;
  if (cover.startsWith('existing:')) coverSrc = cover.slice(9);
  else if (cover.startsWith('new:')) coverSrc = added[Number(cover.slice(4))];
  if (coverSrc && images.includes(coverSrc)) images.unshift(...images.splice(images.indexOf(coverSrc), 1));

  return { images, added, removed: previous.filter((s) => !keep.includes(s)) };
}

router.get('/', async (req, res) => {
  res.json(await Product.find({}, { videos: 0 }).sort({ createdAt: -1 }).lean());
});

router.post('/', upload, async (req, res) => {
  const fields = parseFields(req.body);
  const media = await buildImages(req.body, req.files || []);
  try {
    const product = await Product.create({ ...fields, images: media.images });
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
  const media = await buildImages(req.body, req.files || [], product.images);
  Object.assign(product, fields, { images: media.images });
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
  // Old orders keep a snapshot that may point at the cover photo. Keep photos still used by an order.
  const Order = mongoose.model('Order');
  for (const src of product.images) {
    if (!(await Order.exists({ 'items.image': src }))) await deleteMedia(src);
  }
  res.json({ ok: true });
});

export default router;

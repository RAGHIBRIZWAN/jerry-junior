import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Banner from '../../models/Banner.js';
import { saveBannerImage, deleteMedia } from '../../utils/images.js';

const router = Router();
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    cb(badRequest('Banner must be a JPG, PNG or WEBP image'));
  },
}).single('image');

// Only allow links inside the shop or to a web address.
function cleanLink(v) {
  const link = String(v || '').trim();
  if (!link) return '';
  if (/^\/(?!\/)/.test(link) || /^https?:\/\//i.test(link)) return link.slice(0, 500);
  throw badRequest('Link must start with / (for a page on your shop, e.g. /shop?new=1) or https://');
}

const bool = (v) => v === 'true' || v === true || v === 'on';

router.get('/', async (req, res) => {
  res.json(await Banner.find().sort({ order: 1, createdAt: 1 }).lean());
});

router.post('/', upload, async (req, res) => {
  if (!req.file) throw badRequest('Please choose a banner image');
  const link = cleanLink(req.body.link);
  let image;
  try {
    image = await saveBannerImage(req.file.buffer);
  } catch (err) {
    throw badRequest(`Could not read that image: ${err.message}`);
  }
  const last = await Banner.findOne().sort({ order: -1 }).lean();
  const banner = await Banner.create({
    image,
    link,
    active: req.body.active === undefined ? true : bool(req.body.active),
    order: (last?.order ?? -1) + 1,
  });
  res.status(201).json(banner);
});

router.put('/:id', upload, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Banner not found' });
  const banner = await Banner.findById(req.params.id);
  if (!banner) return res.status(404).json({ error: 'Banner not found' });
  if (req.body.link !== undefined) banner.link = cleanLink(req.body.link);
  if (req.body.active !== undefined) banner.active = bool(req.body.active);
  let old;
  if (req.file) {
    old = banner.image;
    banner.image = await saveBannerImage(req.file.buffer).catch((err) => {
      throw badRequest(`Could not read that image: ${err.message}`);
    });
  }
  await banner.save();
  if (old) await deleteMedia(old);
  res.json(banner);
});

// Body: { ids: [ ...banner ids in the new order ] }
router.post('/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.every((id) => mongoose.isValidObjectId(id))) throw badRequest('Invalid list');
  await Promise.all(ids.map((id, i) => Banner.updateOne({ _id: id }, { order: i })));
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Banner not found' });
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) return res.status(404).json({ error: 'Banner not found' });
  await deleteMedia(banner.image);
  res.json({ ok: true });
});

export default router;

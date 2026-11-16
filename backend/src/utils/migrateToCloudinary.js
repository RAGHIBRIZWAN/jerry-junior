// One-time move of your existing photos to Cloudinary. Runs automatically when the backend starts,
// and only does something if old-style photo addresses are still in the database.
//   Old addresses:  /media/<name>.webp  (stored in MongoDB by the previous version)
//                   /uploads/products/<name>.webp  (stored on this laptop by the first version)
// Each photo is uploaded to Cloudinary, the database is pointed at the new address, and the
// copies stored inside MongoDB are removed afterwards (to free your Atlas space).
// Videos are no longer supported, so any old videos are removed.
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Banner from '../models/Banner.js';
import Order from '../models/Order.js';
import { cloudinaryReady, uploadImage } from './cloudinary.js';
import { UPLOAD_ROOT } from './images.js';

const ANY = /^\/(?:media|uploads)\//;
const LEGACY = /^\/(?:media\/|uploads\/(?:products|banners)\/)([\w-]+\.webp)$/;

const gridfs = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });

async function readFromDatabase(name) {
  const bucket = gridfs();
  const [file] = await bucket.find({ filename: name }).limit(1).toArray();
  if (!file) return null;
  const chunks = [];
  for await (const c of bucket.openDownloadStream(file._id)) chunks.push(c);
  return Buffer.concat(chunks);
}

function readFromLaptop(name) {
  const parent = path.dirname(UPLOAD_ROOT);
  const base = path.basename(UPLOAD_ROOT);
  const roots = fs.existsSync(parent)
    ? fs.readdirSync(parent).filter((d) => d === base || d.startsWith(`${base}_migrated_backup`)).map((d) => path.join(parent, d))
    : [];
  for (const root of roots) {
    for (const sub of ['products', 'banners']) {
      const file = path.join(root, sub, name);
      if (fs.existsSync(file)) return fs.readFileSync(file);
    }
  }
  return null;
}

export async function migrateToCloudinary(log = console.log) {
  // Videos are no longer part of the shop.
  await Product.collection.updateMany({ videos: { $exists: true } }, { $unset: { videos: '' } });

  const products = await Product.find({ images: ANY });
  const banners = await Banner.find({ image: ANY });
  const orders = await Order.find({ 'items.image': ANY });

  const names = new Set();
  const bannerNames = new Set(); // photos used only as banners go to the "banners" folder
  const collect = (s, set = names) => {
    const m = LEGACY.exec(s || '');
    if (m && !m[1].endsWith('-thumb.webp')) {
      set.add(m[1]);
      if (set !== names) names.add(m[1]);
    }
  };
  products.forEach((p) => p.images.forEach((s) => collect(s)));
  orders.forEach((o) => o.items.forEach((it) => collect(it.image)));
  const productNames = new Set(names);
  banners.forEach((b) => collect(b.image, bannerNames));

  const nothingLeft = !products.length && !banners.length && !orders.length;

  if (names.size && !cloudinaryReady()) {
    log('[cloudinary] Your existing photos still need to be moved to Cloudinary.');
    log('             Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env, then restart.');
    return { moved: 0, skipped: true };
  }

  const urls = new Map(); // name -> Cloudinary address
  let failed = 0;
  for (const name of names) {
    try {
      const buf = (await readFromDatabase(name)) || readFromLaptop(name);
      if (!buf) throw new Error('photo file not found');
      urls.set(name, await uploadImage(buf, bannerNames.has(name) && !productNames.has(name) ? 'banners' : 'products'));
    } catch (err) {
      failed++;
      log(`[cloudinary] could not move ${name}: ${err.message}`);
    }
  }
  const fix = (s) => {
    const m = LEGACY.exec(s || '');
    return m && urls.has(m[1]) ? urls.get(m[1]) : s;
  };

  let docs = 0;
  for (const p of products) {
    p.images = p.images.map(fix);
    await p.save();
    docs++;
  }
  for (const b of banners) {
    b.image = fix(b.image);
    await b.save();
    docs++;
  }
  for (const o of orders) {
    o.items.forEach((it) => {
      it.image = fix(it.image);
    });
    o.markModified('items');
    await o.save();
    docs++;
  }
  if (urls.size) log(`[cloudinary] moved ${urls.size} photo(s) to Cloudinary and updated ${docs} record(s).`);

  // Everything is on Cloudinary: remove the copies stored inside MongoDB (frees Atlas space).
  if (failed === 0 && (nothingLeft || urls.size === names.size)) {
    const has = (await mongoose.connection.db.listCollections({ name: 'media.files' }).toArray()).length > 0;
    if (has) {
      await gridfs().drop().catch(() => {});
      log('[cloudinary] removed the old photo copies from the database.');
    }
  } else if (failed) {
    log(`[cloudinary] ${failed} photo(s) could not be moved. They will be retried on the next start.`);
  }
  return { moved: urls.size, failed };
}

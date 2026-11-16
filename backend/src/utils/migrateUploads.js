// One-time move of photos/videos from the laptop's backend/uploads folder into MongoDB.
// Runs automatically when the backend starts. Safe to run again (it skips what is already moved).
// Afterwards the old folder is renamed to "uploads_migrated_backup" (you can delete it later).
import fs from 'node:fs';
import path from 'node:path';
import Product from '../models/Product.js';
import Banner from '../models/Banner.js';
import Order from '../models/Order.js';
import { MEDIA_NAME, findFile, putFile } from './media.js';
import { UPLOAD_ROOT } from './images.js';

const SUBDIRS = ['products', 'videos', 'banners'];
const OLD = /^\/uploads\/(?:products|videos|banners)\//;
const fix = (s) => (typeof s === 'string' ? s.replace(OLD, '/media/') : s);

export async function migrateUploads(log = console.log) {
  if (!fs.existsSync(UPLOAD_ROOT)) return { files: 0, docs: 0 };

  let files = 0;
  let failed = 0;
  for (const sub of SUBDIRS) {
    const dir = path.join(UPLOAD_ROOT, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!MEDIA_NAME.test(name)) continue;
      try {
        if (!(await findFile(name))) {
          await putFile(name, path.join(dir, name));
          files++;
        }
      } catch (err) {
        failed++;
        log(`[migrate] could not move ${sub}/${name}: ${err.message}`);
      }
    }
  }

  // Point the database at the new /media/... addresses.
  let docs = 0;
  for (const p of await Product.find({ $or: [{ images: OLD }, { videos: OLD }] })) {
    p.images = p.images.map(fix);
    p.videos = (p.videos || []).map(fix);
    await p.save();
    docs++;
  }
  for (const b of await Banner.find({ image: OLD })) {
    b.image = fix(b.image);
    await b.save();
    docs++;
  }
  for (const o of await Order.find({ 'items.image': OLD })) {
    o.items.forEach((it) => {
      it.image = fix(it.image);
    });
    o.markModified('items');
    await o.save();
    docs++;
  }

  if (failed === 0) {
    // Everything is in the database now: keep the old folder only as a backup.
    let target = `${UPLOAD_ROOT}_migrated_backup`;
    if (fs.existsSync(target)) target = `${target}_${Date.now()}`;
    fs.renameSync(UPLOAD_ROOT, target);
    if (files || docs) log(`[migrate] moved ${files} file(s) into the database and updated ${docs} record(s). Old folder kept as ${path.basename(target)}.`);
  } else {
    log(`[migrate] ${failed} file(s) could not be moved. They will be retried on the next start.`);
  }
  return { files, docs };
}

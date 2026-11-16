// Uploads every photo in a folder to Cloudinary and creates ONE PRODUCT per photo in MongoDB.
//
//   npm run upload-photos                      (uses the ../images folder, skips logo/banner)
//   npm run upload-photos -- "C:\my\photos"    (another folder)
//   npm run upload-photos -- --dry-run         (only list what would happen)
//
// Photos go to Cloudinary (folder jerry-junior/products). MongoDB stores each photo's web address.
// New products are HIDDEN DRAFTS with no price: open the admin panel > Products > Drafts, add the
// name, price and sizes, then click Publish. Running it again skips photos that are already uploaded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import Product from './models/Product.js';
import { saveProductImage } from './utils/images.js';
import { cloudinaryReady } from './utils/cloudinary.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(here, '../../images');
const PHOTO = /\.(jpe?g|png|webp)$/i;
const SKIP = /^(logo|banner)/i; // shop artwork, not products

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

export async function uploadPhotos(dir = DEFAULT_DIR, { dryRun = false, log = console.log } = {}) {
  if (!fs.existsSync(dir)) throw new Error(`Folder not found: ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => PHOTO.test(f) && !SKIP.test(f)).sort(natural);
  log(`Found ${files.length} photo(s) in ${dir}`);
  if (dryRun || !files.length) {
    files.forEach((f) => log(`  ${f}`));
    return { created: 0, skipped: 0, failed: 0, files };
  }
  if (!cloudinaryReady()) {
    throw new Error('Cloudinary is not set up. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env');
  }
  await connectDB();

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let n = await Product.countDocuments({ sourceId: /^photo:/ });
  for (const file of files) {
    const sourceId = `photo:${file}`;
    if (await Product.exists({ sourceId })) {
      skipped++;
      continue;
    }
    try {
      const url = await saveProductImage(path.join(dir, file));
      n += 1;
      await Product.create({
        title: `Article ${String(n).padStart(3, '0')}`,
        caption: '',
        price: 0,
        images: [url],
        inStock: true,
        published: false, // hidden until you add a price in the admin panel
        sourceId,
      });
      created++;
      log(`  uploaded ${file}`);
    } catch (err) {
      failed++;
      log(`  FAILED ${file}: ${err.message}`);
    }
  }
  log(`\nDone. Uploaded ${created}, already done ${skipped}, failed ${failed}.`);
  if (created) log('They are hidden drafts. Admin panel > Products > Drafts: add name, price, sizes, then Publish.');
  return { created, skipped, failed, files };
}

// Run from the command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  uploadPhotos(dir ? path.resolve(dir) : DEFAULT_DIR, { dryRun: args.includes('--dry-run') })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

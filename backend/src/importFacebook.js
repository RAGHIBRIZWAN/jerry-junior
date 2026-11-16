// Imports products from a Facebook "Download your information" export (JSON format).
//
//   npm run import-facebook -- "C:\Users\you\Downloads\facebook-jerrysjunior" --dry-run
//   npm run import-facebook -- "C:\Users\you\Downloads\facebook-jerrysjunior"
//
// Options:
//   --dry-run              Only show what would be imported (writes import-report.csv). Nothing is saved.
//   --include-uncaptioned  Also import photos/videos that have no caption (as hidden drafts).
//   --all-drafts           Import everything hidden; publish each product yourself in the admin panel.
//   --logo <file>          Use this image as the website logo instead of the latest profile picture.
//
// Each post becomes one product. All photos and videos of the post are attached.
// Name, price and sizes are read from the caption. Posts without a price are imported
// as hidden drafts. Open the admin panel, add the price and click "Publish".
// Running it again skips posts that were already imported.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import sharp from 'sharp';
import config from './config.js';
import { connectDB } from './db.js';
import Product from './models/Product.js';
import { saveProductImage, saveProductVideo } from './utils/images.js';
import { parseCaption, fixFacebookText } from './utils/captionParser.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PUBLIC = path.resolve(here, '../../frontend/public');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm']);
const isMedia = (uri) => typeof uri === 'string' && (IMAGE_EXT.has(ext(uri)) || VIDEO_EXT.has(ext(uri)));
const ext = (uri) => path.extname(String(uri).split('?')[0]).toLowerCase();
const isProfileOrCover = (s) => /profile[\s_-]*pictures?|cover[\s_-]*photos?|profilepictures|coverphotos/i.test(s || '');

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const exportDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--logo');
const DRY = flag('--dry-run');

if (!exportDir || !fs.existsSync(exportDir)) {
  console.error('Usage: npm run import-facebook -- "<path to unzipped Facebook export folder>" [--dry-run]');
  console.error('See README section "Import products from Facebook".');
  process.exit(1);
}

// ---------- scan the export ----------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(exportDir);
const jsonFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.json'));
if (allFiles.some((f) => f.toLowerCase().endsWith('.html')) && !jsonFiles.length) {
  console.error('This export is in HTML format. Please download it again and choose Format: JSON.');
  process.exit(1);
}

// Media lookup: the "uri" in the JSON is relative to the export root, but the root
// folder name can differ when several zip parts are extracted. Match by path ending.
const byTail = new Map();
for (const f of allFiles) {
  const norm = f.replace(/\\/g, '/');
  const parts = norm.split('/');
  for (let n = 1; n <= Math.min(4, parts.length); n++) {
    const tail = parts.slice(-n).join('/').toLowerCase();
    if (!byTail.has(tail)) byTail.set(tail, f);
  }
}
function resolveMedia(uri) {
  if (!uri || /^https?:/i.test(uri)) return null;
  const parts = uri.replace(/\\/g, '/').split('/');
  for (let n = Math.min(4, parts.length); n >= 1; n--) {
    const hit = byTail.get(parts.slice(-n).join('/').toLowerCase());
    if (hit) return hit;
  }
  return null;
}

const posts = []; // { id, caption, media: [uri], ts }
const standalone = new Map(); // uri -> { caption, ts }
const profilePics = []; // { uri, ts }
const usedUris = new Set();

function mediaIn(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => mediaIn(n, out));
    return out;
  }
  if (isMedia(node.uri)) out.push({ uri: node.uri, description: node.description, ts: node.creation_timestamp });
  for (const v of Object.values(node)) if (v && typeof v === 'object') mediaIn(v, out);
  return out;
}

function captionOf(post, media) {
  const data = Array.isArray(post.data) ? post.data : [];
  const text = data.map((d) => d && d.post).find((t) => typeof t === 'string' && t.trim());
  return fixFacebookText(text || media.map((m) => m.description).find((d) => d && d.trim()) || '');
}

function visit(node, ctx = {}) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => visit(n, ctx));

  // A post with attachments
  if (Array.isArray(node.attachments)) {
    const media = mediaIn(node.attachments).filter((m) => !isProfileOrCover(m.uri));
    if (media.length) {
      const uris = [...new Set(media.map((m) => m.uri))];
      posts.push({ id: `fb:${uris[0]}`, caption: captionOf(node, media), media: uris, ts: node.timestamp || media[0].ts });
      uris.forEach((u) => usedUris.add(u));
    }
    return;
  }

  // An album: { name, photos: [...] }
  if (Array.isArray(node.photos) && typeof node.name === 'string') {
    const name = fixFacebookText(node.name);
    if (/profile\s*pictures?/i.test(name)) {
      node.photos.forEach((p) => isMedia(p.uri) && profilePics.push({ uri: p.uri, ts: p.creation_timestamp || 0 }));
      return;
    }
    if (/cover\s*photos?/i.test(name)) return;
  }

  // A single photo/video with a caption
  if (isMedia(node.uri)) {
    if (isProfileOrCover(node.uri) || isProfileOrCover(ctx.album)) {
      if (/profile/i.test(node.uri) || /profile/i.test(ctx.album || '')) profilePics.push({ uri: node.uri, ts: node.creation_timestamp || 0 });
      return;
    }
    if (!standalone.has(node.uri)) {
      standalone.set(node.uri, { caption: fixFacebookText(node.description || node.title || ''), ts: node.creation_timestamp });
    }
    return;
  }

  const album = typeof node.name === 'string' && Array.isArray(node.photos) ? node.name : ctx.album;
  for (const v of Object.values(node)) if (v && typeof v === 'object') visit(v, { album });
}

for (const file of jsonFiles) {
  try {
    visit(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    console.warn(`[skip] could not read ${path.relative(exportDir, file)}: ${err.message}`);
  }
}

// Photos/videos that were not part of a post
for (const [uri, info] of standalone) {
  if (usedUris.has(uri)) continue;
  if (!info.caption.trim() && !flag('--include-uncaptioned')) continue;
  posts.push({ id: `fb:${uri}`, caption: info.caption, media: [uri], ts: info.ts });
}

// Oldest first, so the newest post ends up as the newest product.
posts.sort((a, b) => (a.ts || 0) - (b.ts || 0));

// ---------- build products ----------
let n = 0;
const rows = posts.map((p) => {
  const parsed = parseCaption(p.caption);
  n += 1;
  const files = p.media.map((uri) => ({ uri, file: resolveMedia(uri) }));
  return {
    ...p,
    ...parsed,
    title: parsed.title || `${config.shopName} Article ${String(n).padStart(3, '0')}`,
    published: !flag('--all-drafts') && Boolean(parsed.price),
    images: files.filter((f) => IMAGE_EXT.has(ext(f.uri))),
    videos: files.filter((f) => VIDEO_EXT.has(ext(f.uri))),
    missing: files.filter((f) => !f.file).length,
  };
});

// ---------- report ----------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const report = [
  ['status', 'name', 'price', 'sizes', 'category', 'photos', 'videos', 'missing files', 'posted', 'caption'].join(','),
  ...rows.map((r) =>
    [
      r.published ? 'live' : 'draft (no price)',
      r.title,
      r.price ?? '',
      r.sizes.join(' / '),
      r.category,
      r.images.length,
      r.videos.length,
      r.missing,
      r.ts ? new Date(r.ts * 1000).toISOString().slice(0, 10) : '',
      r.caption.replace(/\n/g, ' | '),
    ]
      .map(csvCell)
      .join(',')
  ),
].join('\r\n');
fs.writeFileSync('import-report.csv', `\uFEFF${report}`);

console.log(`\nFound ${rows.length} product(s) in ${jsonFiles.length} JSON file(s).`);
console.table(
  rows.map((r) => ({
    name: r.title.slice(0, 40),
    price: r.price ?? '-',
    sizes: r.sizes.join(' ').slice(0, 30),
    cat: r.category,
    pics: r.images.length,
    vids: r.videos.length,
    status: r.published ? 'live' : 'DRAFT',
  }))
);
console.log('Full details saved to import-report.csv (open it in Excel).');

// ---------- logo ----------
async function saveLogo() {
  let source = option('--logo');
  if (!source && profilePics.length) {
    profilePics.sort((a, b) => b.ts - a.ts);
    source = resolveMedia(profilePics[0].uri);
  }
  if (!source || !fs.existsSync(source)) {
    console.log('Logo: no profile picture found in the export. Save it manually as frontend/public/logo.png');
    return;
  }
  if (DRY) return console.log(`Logo: would use ${source}`);
  await fsp.mkdir(FRONTEND_PUBLIC, { recursive: true });
  await sharp(source).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(FRONTEND_PUBLIC, 'logo.png'));
  console.log('Logo: saved to frontend/public/logo.png (redeploy the frontend to show it).');
}

// ---------- import ----------
async function run() {
  await saveLogo();
  if (DRY) {
    console.log('\nDry run: nothing was saved. Remove --dry-run to import.');
    return;
  }
  await connectDB();
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of rows) {
    if (await Product.exists({ sourceId: r.id })) {
      skipped++;
      continue;
    }
    try {
      const images = [];
      for (const f of r.images) {
        if (!f.file) continue;
        try {
          images.push(await saveProductImage(f.file));
        } catch (err) {
          console.warn(`  [photo skipped] ${f.uri}: ${err.message}`);
        }
      }
      const videos = [];
      for (const f of r.videos) if (f.file) videos.push(await saveProductVideo(f.file, ext(f.file)));
      if (!images.length && !videos.length) {
        console.warn(`  [skipped] "${r.title}": media files not found in the export`);
        failed++;
        continue;
      }
      const when = r.ts ? new Date(r.ts * 1000) : new Date();
      await Product.create({
        title: r.title,
        caption: r.caption,
        price: r.price || 0,
        sizes: r.sizes,
        category: r.category,
        images,
        videos,
        inStock: true,
        published: r.published,
        sourceId: r.id,
        createdAt: when,
        updatedAt: when,
      });
      created++;
      process.stdout.write(`\rImported ${created}/${rows.length}`);
    } catch (err) {
      failed++;
      console.warn(`\n  [failed] "${r.title}": ${err.message}`);
    }
  }
  const drafts = rows.filter((r) => !r.published).length;
  console.log(`\n\nDone. Imported ${created}, already there ${skipped}, failed ${failed}.`);
  if (drafts) console.log(`${drafts} product(s) had no price in the caption and are HIDDEN. Add prices in the admin panel and click "Publish".`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

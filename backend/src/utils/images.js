import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MEDIA_NAME, putBuffer, putFile, removeFile } from './media.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Only used by the one-time migration of old photos stored on disk.
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_ROOT || path.join(here, '../../uploads'));

const newId = () => `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;

/**
 * Saves a photo (Buffer or file path) into MongoDB as:
 *   /media/<id>.webp        (max 1200px wide)
 *   /media/<id>-thumb.webp  (max 500px wide)
 * Returns the public path of the main photo.
 */
export async function saveProductImage(input) {
  const id = newId();
  const base = sharp(input, { failOn: 'error' }).rotate(); // respect phone camera orientation
  const main = await base.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await base.clone().resize({ width: 500, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  await putBuffer(`${id}.webp`, main);
  await putBuffer(`${id}-thumb.webp`, thumb);
  return `/media/${id}.webp`;
}

/** Saves a homepage banner (max 1920px wide, aspect ratio kept). Returns its public path. */
export async function saveBannerImage(input) {
  const id = newId();
  const buf = await sharp(input, { failOn: 'error' }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await putBuffer(`${id}.webp`, buf);
  return `/media/${id}.webp`;
}

export const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

/** Saves a video (Buffer, or path of an existing file). Returns its public path. */
export async function saveProductVideo(input, ext = '.mp4') {
  const safeExt = ['.mp4', '.webm', '.mov'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.mp4';
  const name = `${newId()}${safeExt}`;
  if (Buffer.isBuffer(input)) await putBuffer(name, input);
  else await putFile(name, input);
  return `/media/${name}`;
}

/** Deletes a stored photo (and its thumbnail) or video. Ignores external URLs and missing files. */
export async function deleteMedia(src) {
  if (!src || !src.startsWith('/media/')) return;
  const name = path.basename(src); // prevents path traversal
  if (!MEDIA_NAME.test(name)) return;
  await removeFile(name);
  if (name.endsWith('.webp') && !name.endsWith('-thumb.webp')) await removeFile(name.replace(/\.webp$/, '-thumb.webp'));
}

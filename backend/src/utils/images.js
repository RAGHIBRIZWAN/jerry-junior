import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { uploadImage, destroyByUrl } from './cloudinary.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Only used by the one-time move of old photos (from before Cloudinary) into Cloudinary.
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_ROOT || path.join(here, '../../uploads'));

/**
 * Prepares a photo (Buffer or file path) and uploads it to Cloudinary.
 * Photos are shrunk to max 1600px wide first (keeps your free Cloudinary storage small).
 * The website asks Cloudinary for smaller versions (thumbnails) on the fly.
 * Returns the https address to store in the database.
 */
export async function saveProductImage(input) {
  const buf = await sharp(input, { failOn: 'error' }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  return uploadImage(buf, 'products');
}

/** Homepage banner: max 1920px wide, aspect ratio kept. */
export async function saveBannerImage(input) {
  const buf = await sharp(input, { failOn: 'error' }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return uploadImage(buf, 'banners');
}

/** Deletes an uploaded image from Cloudinary. Ignores other addresses and missing images. */
export async function deleteMedia(src) {
  await destroyByUrl(src);
}

// Product photos and banners are stored on Cloudinary (free plan). MongoDB only keeps their web addresses.
// Only the admin panel / importer on your laptop uploads, so the API secret never goes to Vercel.
import { v2 as cloudinary } from 'cloudinary';
import '../config.js'; // makes sure backend/.env is loaded first

export const FOLDER = process.env.CLOUDINARY_FOLDER || 'jerry-junior';

export function cloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

function setup() {
  if (!cloudinaryReady()) {
    throw Object.assign(
      new Error('Cloudinary is not set up. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart.'),
      { status: 400 }
    );
  }
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

/** Uploads an image buffer into <FOLDER>/<subfolder>. Returns the https address of the stored image. */
export function uploadImage(buffer, subfolder) {
  setup();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `${FOLDER}/${subfolder}`, resource_type: 'image', unique_filename: true, overwrite: false },
      (err, result) => {
        if (err) return reject(Object.assign(new Error(`Cloudinary upload failed: ${err.message || err}`), { status: 400 }));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

/** "https://res.cloudinary.com/<cloud>/image/upload/v123/jerry-junior/products/abc.webp" -> "jerry-junior/products/abc" */
export function publicIdFromUrl(url) {
  const m = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/.exec(String(url || ''));
  return m ? m[1] : null;
}

/** Deletes an image we uploaded (only inside our own folder). Never throws. */
export async function destroyByUrl(url) {
  const id = publicIdFromUrl(url);
  if (!id || !id.startsWith(`${FOLDER}/`) || !cloudinaryReady()) return;
  try {
    setup();
    await cloudinary.uploader.destroy(id, { invalidate: true, resource_type: 'image' });
  } catch (err) {
    console.warn(`[cloudinary] could not delete ${id}: ${err.message}`);
  }
}

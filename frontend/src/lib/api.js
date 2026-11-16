import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

export default api;

/**
 * True when the laptop / tunnel is off: no response at all, or the tunnel's
 * "origin unreachable" errors (Cloudflare 502/521/522/523/530, ngrok error pages).
 */
export function isOfflineError(err) {
  if (!err) return false;
  if (!err.response) return true;
  const status = err.response.status;
  if ([502, 503, 504, 521, 522, 523, 524, 530].includes(status)) return true;
  const type = err.response.headers?.['content-type'] || '';
  return status >= 400 && type.includes('text/html');
}

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (isOfflineError(err)) return 'Shop is temporarily offline, please try again shortly.';
  return err?.response?.data?.error || fallback;
}

// Photos are stored on Cloudinary. We ask Cloudinary for a version sized for where it is shown
// (and in a modern format), which keeps pages fast and your free Cloudinary bandwidth low.
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Photo address sized to `width` pixels. Other addresses (like /banner-default.jpg) are used as they are. */
export function mediaUrl(src, width = 1200) {
  if (!src) return '';
  const m = CLOUDINARY.exec(src);
  return m ? `${m[1]}c_limit,w_${width},f_auto,q_auto/${m[2]}` : src;
}

/** Smaller version for product grids and thumbnails. */
export function thumbUrl(src) {
  return mediaUrl(src, 500);
}

/** All photos of a product, as gallery items. */
export function productMedia(p) {
  return (p?.images || []).map((src) => ({ type: 'image', src }));
}

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

export function mediaUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `${API_URL}${src}`;
}

/** Smaller thumbnail for uploaded photos (created by the backend). */
export function thumbUrl(src) {
  if (src?.startsWith('/media/') && src.endsWith('.webp')) return mediaUrl(src.replace(/\.webp$/, '-thumb.webp'));
  return mediaUrl(src);
}

/** All photos and videos of a product, photos first. */
export function productMedia(p) {
  return [
    ...(p?.images || []).map((src) => ({ type: 'image', src })),
    ...(p?.videos || []).map((src) => ({ type: 'video', src })),
  ];
}

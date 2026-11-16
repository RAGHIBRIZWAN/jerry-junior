import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { MEDIA_NAME, bucket, findFile, typeOf } from './media.js';

// GET /media/<name>: serves a photo or video stored in MongoDB.
// Supports Range requests so videos can be played and skipped through.
export const mediaRouter = Router();

mediaRouter.get('/media/:name', async (req, res) => {
  const { name } = req.params;
  if (!MEDIA_NAME.test(name)) return res.status(404).end();
  const file = await findFile(name);
  if (!file) return res.status(404).end();

  const etag = `"${file._id}"`;
  res.set({
    'Content-Type': file.contentType || typeOf(name),
    'Accept-Ranges': 'bytes',
    // File names are unique per upload, so they can be cached "forever".
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
  });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();

  const total = file.length;
  let start = 0;
  let end = total - 1;
  let status = 200;

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    if (m[1] === '') {
      start = Math.max(0, total - Number(m[2])); // last N bytes
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= total) {
      return res.status(416).set('Content-Range', `bytes */${total}`).end();
    }
    status = 206;
    res.set('Content-Range', `bytes ${start}-${end}/${total}`);
  }

  res.status(status).set('Content-Length', String(end - start + 1));
  if (total === 0) return res.end();
  try {
    await pipeline(bucket().openDownloadStream(file._id, { start, end: end + 1 }), res);
  } catch {
    // client closed the connection (normal when skipping through a video)
  }
});

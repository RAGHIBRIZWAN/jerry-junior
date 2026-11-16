// Photos and videos are stored INSIDE MongoDB (GridFS), not on the laptop's disk.
// That way the live website can show them even when the laptop is switched off.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';

const CONTENT_TYPES = { '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
export const MEDIA_NAME = /^[\w-]+\.(webp|mp4|webm|mov)$/;
export const typeOf = (name) => CONTENT_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';

let cached;
export function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');
  if (!cached || cached.db !== db) cached = { db, bucket: new mongoose.mongo.GridFSBucket(db, { bucketName: 'media' }) };
  return cached.bucket;
}

export async function putBuffer(name, buffer) {
  await pipeline(Readable.from(buffer), bucket().openUploadStream(name, { contentType: typeOf(name) }));
}

export async function putFile(name, filePath) {
  await pipeline(fs.createReadStream(filePath), bucket().openUploadStream(name, { contentType: typeOf(name) }));
}

export async function findFile(name) {
  const [file] = await bucket().find({ filename: name }).limit(1).toArray();
  return file || null;
}

export async function removeFile(name) {
  const files = await bucket().find({ filename: name }).toArray();
  for (const f of files) await bucket().delete(f._id).catch(() => {});
}

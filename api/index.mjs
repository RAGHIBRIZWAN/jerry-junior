// Vercel serverless function: the public API of the shop (products, banners, photos/videos, orders).
// It talks straight to MongoDB Atlas, so the website works even when your laptop is off.
// It is the SAME code as the local preview server in backend/src/public/server.js.
import { createPublicApp } from '../backend/src/public/server.js';
import { connectDB } from '../backend/src/db.js';

const app = createPublicApp();

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable' }));
    return;
  }
  return app(req, res);
}

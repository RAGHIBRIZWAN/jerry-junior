// Vercel serverless function: the public API of the shop (products, banners, orders).
// It talks straight to MongoDB Atlas, so the website works even when your laptop is off.
// Photos are on Cloudinary, so this function never touches them.
// It is the SAME code as the local preview server in backend/src/public/server.js.

let ready; // loaded once per warm instance

async function load() {
  const { createPublicApp } = await import('../backend/src/public/server.js');
  const { connectDB } = await import('../backend/src/db.js');
  await connectDB();
  return createPublicApp();
}

function fail(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    ready ||= load();
    const app = await ready;
    return app(req, res);
  } catch (err) {
    ready = undefined; // try again on the next request
    console.error('[api] could not start:', err);
    if (err.code === 'CONFIG') {
      // Only the NAMES of missing settings are shown, never their values.
      return fail(res, 503, { error: 'Shop is not configured', missing: err.missing, hint: err.message });
    }
    return fail(res, 503, { error: 'Database unavailable' });
  }
}

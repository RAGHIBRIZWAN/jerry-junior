import config from './config.js';
import { connectDB } from './db.js';
import { createPublicApp } from './public/server.js';
import { createAdminApp } from './admin/server.js';
import { migrateToCloudinary } from './utils/migrateToCloudinary.js';

// Run this on your laptop when you want to ADD OR EDIT products (admin panel).
//   ADMIN  : http://localhost:5001  -> bound to 127.0.0.1 only
//   PUBLIC : http://127.0.0.1:5000  -> only used to preview the shop locally (npm run dev in /frontend).
//                                      The live website does NOT need this: it runs on Vercel.
//   Photos go to Cloudinary; everything else (products, orders, banners) goes to MongoDB.
async function main() {
  await connectDB();
  await migrateToCloudinary(); // one-time: moves old photos to Cloudinary (does nothing once done)

  createAdminApp().listen(config.adminPort, '127.0.0.1', () => {
    console.log(`[admin]  panel at http://localhost:${config.adminPort} (local only)`);
  });

  createPublicApp().listen(config.publicPort, config.publicHost, () => {
    console.log(`[public] local preview API on http://${config.publicHost}:${config.publicPort}`);
  });
}

main().catch((err) => {
  console.error('[startup] failed:', err.message);
  if (/ECONNREFUSED|querySrv|Server selection|ENOTFOUND/i.test(err.message)) {
    console.error('Cannot reach the database. Check MONGODB_URI in backend/.env and Atlas > Network Access.');
  }
  process.exit(1);
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

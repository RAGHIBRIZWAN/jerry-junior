import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// The live website (Vercel) only needs these two. Admin settings are only needed on your laptop.
const required = ['MONGODB_URI', 'VENDOR_WHATSAPP'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const list = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

const config = {
  mongoUri: process.env.MONGODB_URI,
  publicPort: Number(process.env.PUBLIC_PORT) || 5000,
  // 127.0.0.1 is enough because the tunnel (cloudflared / ngrok) runs on the same laptop.
  publicHost: process.env.PUBLIC_HOST || '127.0.0.1',
  adminPort: Number(process.env.ADMIN_PORT) || 5001,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrls: list(process.env.FRONTEND_URL),
  shopName: process.env.SHOP_NAME || 'Jerrys Junior',
  shopCity: process.env.SHOP_CITY || 'Karachi',
  currency: process.env.CURRENCY || 'PKR',
  vendorWhatsapp: String(process.env.VENDOR_WHATSAPP).replace(/\D/g, ''),
  timezone: process.env.SHOP_TIMEZONE || 'Asia/Karachi',
};

if (config.jwtSecret && config.jwtSecret.length < 32) {
  console.warn('[warn] JWT_SECRET is short. Use at least 32 random characters.');
}

export default config;

const env = import.meta.env;

// Empty = same address as the website (Vercel serves the API at /api and photos at /media).
// While developing, Vite forwards /api and /media to the local backend (see vite.config.js).
export const API_URL = (env.VITE_API_URL || '').replace(/\/$/, '');
export const BRAND_NAME = env.VITE_BRAND_NAME || 'Jerrys Junior';
export const TAGLINE = env.VITE_TAGLINE || 'Stylish, comfortable clothing for little ones';
export const CURRENCY = env.VITE_CURRENCY || 'PKR';
export const SHOP_CITY = env.VITE_SHOP_CITY || 'Karachi, Pakistan';
export const SITE_URL = (env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

// The WhatsApp number normally comes from the backend (.env VENDOR_WHATSAPP) via /api/settings.
// This is only a fallback for when the backend is offline.
export const FALLBACK_WHATSAPP = (env.VITE_VENDOR_WHATSAPP || '').replace(/\D/g, '');

export const FACEBOOK_URL = env.VITE_FACEBOOK_URL || 'https://www.facebook.com/people/Jerrys-Junior/61596077745640/';
export const SOCIAL = [
  { name: 'Facebook', url: FACEBOOK_URL },
  { name: 'Instagram', url: env.VITE_INSTAGRAM_URL },
  { name: 'TikTok', url: env.VITE_TIKTOK_URL },
].filter((s) => s.url);

// Messages in the scrolling bar at the top. Only list things that are true for your shop.
export const ANNOUNCEMENTS = (env.VITE_ANNOUNCEMENTS || 'Order easily on WhatsApp|No account needed|Kids clothing from Karachi')
  .split('|')
  .map((s) => s.trim())
  .filter(Boolean);

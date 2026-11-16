import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Defaults so index.html placeholders (%VITE_...%) are always filled in.
// Real values come from .env files or the Vercel dashboard.
const defaults = {
  VITE_BRAND_NAME: 'Jerrys Junior',
  VITE_TAGLINE: 'Stylish, comfortable clothing for little ones',
  VITE_SITE_URL: '',
};
for (const [k, v] of Object.entries(defaults)) {
  if (!process.env[k]) process.env[k] = v;
}

// While developing (npm run dev), forward API and photo requests to the local backend (npm start).
// On Vercel there is no proxy: /api and /media are served by the serverless function.
const target = process.env.API_PROXY || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': target, '/media': target, '/health': target },
  },
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import config from '../config.js';
import { checkCredentials, issueToken, clearToken, requireAdmin } from './auth.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import bannersRouter from './routes/banners.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createAdminApp() {
  if (!config.adminUsername || !config.adminPassword || !config.jwtSecret) {
    throw new Error('Set ADMIN_USERNAME, ADMIN_PASSWORD and JWT_SECRET in backend/.env to use the admin panel');
  }
  const app = express();
  app.disable('x-powered-by');

  // Only accept requests addressed to localhost (blocks DNS-rebinding tricks).
  const allowedHosts = new Set([`localhost:${config.adminPort}`, `127.0.0.1:${config.adminPort}`]);
  app.use((req, res, next) => {
    if (!allowedHosts.has(String(req.headers.host).toLowerCase())) return res.status(403).send('Forbidden');
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: null,
        },
      },
      hsts: false,
    })
  );
  app.use(morgan('dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: '200kb' }));

  // CSRF protection: every admin API call must come from our own UI (custom header,
  // which other websites can't send without a CORS preflight that we never allow).
  app.use('/admin/api', (req, res, next) => {
    if (req.get('x-admin-ui') !== '1') return res.status(403).json({ error: 'Forbidden' });
    next();
  });

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: 'Too many login attempts. Wait 15 minutes.' } });

  app.post('/admin/api/login', loginLimiter, (req, res) => {
    const { username = '', password = '' } = req.body || {};
    if (!checkCredentials(username, password)) return res.status(401).json({ error: 'Wrong username or password' });
    issueToken(res);
    res.json({ ok: true });
  });

  app.post('/admin/api/logout', (req, res) => {
    clearToken(res);
    res.json({ ok: true });
  });

  app.get('/admin/api/me', requireAdmin, (req, res) => {
    res.json({ username: req.admin.sub, shopName: config.shopName, currency: config.currency });
  });

  app.use('/admin/api/products', requireAdmin, productsRouter);
  app.use('/admin/api/orders', requireAdmin, ordersRouter);
  app.use('/admin/api/banners', requireAdmin, bannersRouter);
  app.use('/admin/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // The admin UI itself (photos are loaded from Cloudinary).
  app.use(express.static(path.join(here, 'ui'), { index: 'index.html' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be 5MB or smaller' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err.status === 400 || err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    console.error('[admin] error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  });

  return app;
}

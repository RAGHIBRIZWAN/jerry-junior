import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import config from '../config.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Banner from '../models/Banner.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { vendorWhatsappUrl } from '../utils/whatsapp.js';

const MAX_ITEMS = 50;
const MAX_QTY = 20;
// Drafts (e.g. Facebook imports without a price) are hidden from the website.
const VISIBLE = { published: { $ne: false } };

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createPublicApp() {
  const app = express();

  // Requests arrive through cloudflared / ngrok on the same machine.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Allows the website (possibly on another address) to use these responses.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());
  app.use(morgan(':date[iso] :method :url :status :response-time ms'));

  const allowedOrigins = new Set(config.frontendUrls);
  // Local development: the website may run on any localhost port (5173, 5174, ...).
  const isLocalDev = (o) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = same-origin, curl, health checks, <img> tags. Allow.
        if (!origin || allowedOrigins.has(origin) || isLocalDev(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
      maxAge: 86400,
    })
  );

  app.use(express.json({ limit: '50kb' }));

  // Let Vercel's CDN keep read-only answers for a few seconds. Faster pages, fewer database reads.
  // (A product you add or change shows up on the website within about a minute.)
  app.get(
    ['/api/settings', '/api/banners', '/api/categories', '/api/products', '/api/products/:id'],
    (req, res, next) => {
      res.set('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
      next();
    }
  );

  app.get('/health', (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', time: new Date().toISOString() });
  });

  // Shop details for the website. The WhatsApp number comes from backend/.env.
  app.get('/api/settings', (req, res) => {
    res.json({ shopName: config.shopName, city: config.shopCity, currency: config.currency, whatsapp: config.vendorWhatsapp });
  });

  // Homepage carousel slides (managed in the admin panel).
  app.get('/api/banners', async (req, res) => {
    const banners = await Banner.find({ active: true }, { image: 1, link: 1 }).sort({ order: 1, createdAt: 1 }).limit(12).lean();
    res.json(banners);
  });

  // ---------- Products ----------
  app.get('/api/products', async (req, res) => {
    const filter = { ...VISIBLE };
    const q = str(req.query.search || req.query.q, 100);
    const category = str(req.query.category, 100);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: re }, { caption: re }, { category: re }];
    }
    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    const products = await Product.find(filter, { sourceId: 0, videos: 0 }).sort({ createdAt: -1 }).limit(500).lean();
    res.json(products);
  });

  app.get('/api/categories', async (req, res) => {
    const cats = await Product.distinct('category', { ...VISIBLE, category: { $ne: '' } });
    res.json(cats.sort((a, b) => a.localeCompare(b)));
  });

  app.get('/api/products/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findOne({ _id: req.params.id, ...VISIBLE }, { sourceId: 0, videos: 0 }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  // ---------- Orders ----------
  const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many orders from this device. Please wait a few minutes or message us on WhatsApp.' },
  });

  app.post('/api/orders', orderLimiter, async (req, res) => {
    const body = req.body || {};
    const c = body.customer || body; // accept { customer: {...}, items } or flat fields
    const customer = {
      name: str(c.name, 100),
      phone: str(c.phone, 30),
      address: str(c.address, 500),
      city: str(c.city, 100),
      notes: str(c.notes, 1000),
    };

    const errors = {};
    if (customer.name.length < 2) errors.name = 'Please enter your name';
    const phoneDigits = customer.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = 'Please enter a valid phone number';
    if (customer.address.length < 5) errors.address = 'Please enter your full address';

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) errors.items = 'Your bag is empty';
    if (rawItems.length > MAX_ITEMS) errors.items = 'Too many items in one order';

    if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check your details', errors });

    // Look up every product in the DATABASE. Prices from the client are ignored.
    const ids = rawItems.map((i) => String(i.productId || i.product || i._id || ''));
    if (!ids.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ error: 'Your bag contains an invalid item. Please refresh and try again.' });
    }
    const products = await Product.find({ _id: { $in: ids }, ...VISIBLE }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const items = [];
    for (let i = 0; i < rawItems.length; i++) {
      const p = byId.get(ids[i]);
      if (!p) return res.status(400).json({ error: 'An item in your bag is no longer available. Please remove it.' });
      if (!p.inStock) return res.status(400).json({ error: `"${p.title}" is sold out. Please remove it from your bag.` });

      const quantity = Math.floor(Number(rawItems[i].quantity));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
        return res.status(400).json({ error: `Please choose a quantity between 1 and ${MAX_QTY} for "${p.title}".` });
      }
      let size = str(rawItems[i].size, 30);
      if (p.sizes?.length) {
        if (!p.sizes.includes(size)) return res.status(400).json({ error: `Please choose a size for "${p.title}".` });
      } else {
        size = '';
      }
      items.push({ product: p._id, title: p.title, price: p.price, size, quantity, image: p.images?.[0] || '' });
    }

    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const order = await Order.create({
      orderNumber: await generateOrderNumber(),
      customer,
      items,
      total,
      status: 'pending',
    });

    res.status(201).json({ orderNumber: order.orderNumber, whatsappUrl: vendorWhatsappUrl(order), total });
  });

  // This server never serves admin routes.
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error('[public] error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import { buyerWhatsappUrl } from '../../utils/whatsapp.js';
import config from '../../config.js';

const router = Router();

const withLinks = (o) => ({
  ...o,
  buyerWhatsappUrl: buyerWhatsappUrl(
    o.customer.phone,
    `Assalam o Alaikum ${o.customer.name}, this is ${config.shopName} about your order ${o.orderNumber}.`
  ),
});

router.get('/', async (req, res) => {
  const filter = {};
  if (['pending', 'confirmed', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
  const [orders, counts] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({
    orders: orders.map(withLinks),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
});

async function loadOrder(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Order not found' });
    return null;
  }
  const order = await Order.findById(req.params.id);
  if (!order) res.status(404).json({ error: 'Order not found' });
  return order;
}

// Mark the order as confirmed (after talking to the buyer on WhatsApp).
router.post('/:id/confirm', async (req, res) => {
  const order = await loadOrder(req, res);
  if (!order) return;
  if (order.status === 'cancelled') return res.status(400).json({ error: 'This order was cancelled. It cannot be confirmed.' });
  if (order.status !== 'confirmed') {
    order.status = 'confirmed';
    order.confirmedAt = new Date();
    await order.save();
  }
  res.json({ ok: true, order: withLinks(order.toObject()) });
});

router.post('/:id/cancel', async (req, res) => {
  const order = await loadOrder(req, res);
  if (!order) return;
  if (order.status !== 'cancelled') {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
  }
  res.json({ ok: true, order: withLinks(order.toObject()) });
});

export default router;

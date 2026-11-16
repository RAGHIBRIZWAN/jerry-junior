import config from '../config.js';
import { money } from './format.js';

/** The message the BUYER sends to the vendor, listing the whole cart. */
export function buildOrderMessage(order) {
  const c = order.customer;
  const lines = [
    `*New Order ${order.orderNumber}*`,
    '',
    `*Name:* ${c.name}`,
    `*Phone:* ${c.phone}`,
    `*Address:* ${c.address}${c.city ? `, ${c.city}` : ''}`,
  ];
  if (c.notes) lines.push(`*Notes:* ${c.notes}`);
  lines.push('', '*Items:*');
  order.items.forEach((it, i) => {
    const size = it.size ? ` (Size: ${it.size})` : '';
    lines.push(`${i + 1}. ${it.title}${size} x ${it.quantity} = ${money(it.price * it.quantity)}`);
  });
  lines.push('', `*Total: ${money(order.total)}*`, '', 'Please confirm my order. Thank you!');
  return lines.join('\n');
}

export const vendorWhatsappUrl = (order) =>
  `https://wa.me/${config.vendorWhatsapp}?text=${encodeURIComponent(buildOrderMessage(order))}`;

/**
 * wa.me link to the BUYER (used in the admin panel).
 * Local Pakistani numbers like 0300-1234567 become 923001234567.
 */
export function buyerWhatsappUrl(phone, text = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Seo from '../components/Seo';
import { WhatsAppIcon } from '../components/Icons';
import { money } from '../lib/format';

const KEY = 'last_order';

// eslint-disable-next-line react-refresh/only-export-components
export function saveLastOrder(order) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...order, redirected: false }));
  } catch {
    /* ignore */
  }
}

function readLastOrder() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export default function OrderPlaced() {
  const location = useLocation();
  const [order] = useState(readLastOrder);
  const [countdown, setCountdown] = useState(null);

  // Open WhatsApp automatically, only once per order (not again when the buyer comes back).
  useEffect(() => {
    if (!order?.whatsappUrl || order.redirected || !location.state?.justPlaced) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...order, redirected: true }));
    } catch {
      /* ignore */
    }
    setCountdown(2);
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    const go = setTimeout(() => {
      window.location.href = order.whatsappUrl;
    }, 2000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [order, location.state]);

  if (!order) {
    return (
      <div className="container-x py-24 text-center">
        <Seo title="Order placed" />
        <h1 className="font-display text-4xl">No recent order found</h1>
        <Link to="/shop" className="btn btn-dark mt-8">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-x py-14 sm:py-20">
      <Seo title="Order placed" />
      <div className="mx-auto max-w-lg bg-white p-8 text-center ring-1 ring-stone-200 sm:p-12">
        <p className="eyebrow">Thank you</p>
        <h1 className="mt-3 font-display text-4xl">Order placed!</h1>
        <p className="mt-5 text-xs uppercase tracking-[0.2em] text-stone-500">Your order number</p>
        <p className="mt-2 inline-block bg-sand px-5 py-2.5 font-mono text-lg tracking-wider">{order.orderNumber}</p>
        {order.total != null && <p className="mt-3 text-sm text-stone-500">Total: {money(order.total)}</p>}

        <p className="mt-8 border-l-2 border-accent bg-cream p-4 text-left text-sm leading-relaxed">
          Please tap <strong>Send</strong> in WhatsApp so we can confirm your order. We'll reply on WhatsApp to confirm delivery.
        </p>

        {countdown !== null && countdown > 0 && <p className="mt-5 text-sm text-stone-500">Opening WhatsApp in {countdown}…</p>}

        <a href={order.whatsappUrl} className="btn btn-whatsapp mt-6 w-full py-4">
          <WhatsAppIcon className="h-5 w-5" /> Open WhatsApp
        </a>
        <p className="mt-2 text-xs text-stone-500">WhatsApp didn't open? Tap the button above.</p>

        <Link to="/shop" className="link-underline mt-8 inline-block text-xs uppercase tracking-[0.2em]">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

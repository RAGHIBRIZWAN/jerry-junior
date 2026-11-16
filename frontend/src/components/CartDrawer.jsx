import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { thumbUrl } from '../lib/api';
import { money } from '../lib/format';
import QuantityInput from './QuantityInput';
import { CloseIcon } from './Icons';
import { useLockScroll } from './Header';

export default function CartDrawer() {
  const { isOpen, closeCart } = useCart();
  const location = useLocation();
  useEffect(() => {
    closeCart();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOpen) return null;
  return <Drawer onClose={closeCart} />;
}

function Drawer({ onClose }) {
  const { items, total, count, updateQuantity, removeItem, MAX_QTY } = useCart();
  const navigate = useNavigate();
  useLockScroll();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="font-display text-2xl">
            Your Bag <span className="font-sans text-sm text-stone-500">({count})</span>
          </h2>
          <button onClick={onClose} className="-mr-2 p-2" aria-label="Close bag">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {!items.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="font-display text-2xl">Your bag is empty</p>
            <p className="text-sm text-stone-500">Discover our latest styles for little ones.</p>
            <Link to="/shop" className="btn btn-dark mt-2" onClick={onClose}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-stone-200 overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.key} className="flex gap-4 py-5">
                  <Link to={`/product/${item.productId}`} onClick={onClose} className="h-28 w-[84px] shrink-0 overflow-hidden bg-sand">
                    {item.image && <img src={thumbUrl(item.image)} alt="" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link to={`/product/${item.productId}`} onClick={onClose} className="line-clamp-2 text-sm font-medium">
                      {item.title}
                    </Link>
                    {item.size && <p className="mt-0.5 text-xs uppercase tracking-wider text-stone-500">Size: {item.size}</p>}
                    <p className="mt-1 text-sm">{money(item.price)}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QuantityInput small value={item.quantity} max={MAX_QTY} onChange={(q) => updateQuantity(item.key, q)} />
                      <button onClick={() => removeItem(item.key)} className="text-xs uppercase tracking-wider text-stone-500 underline underline-offset-4 hover:text-ink">
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-200 bg-white px-5 py-5">
              <div className="flex justify-between text-base">
                <span className="uppercase tracking-[0.15em]">Subtotal</span>
                <span className="font-medium">{money(total)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">Delivery charges are confirmed on WhatsApp.</p>
              <button
                className="btn btn-dark mt-4 w-full"
                onClick={() => {
                  onClose();
                  navigate('/checkout');
                }}
              >
                Checkout
              </button>
              <Link to="/cart" onClick={onClose} className="mt-3 block text-center text-xs uppercase tracking-[0.15em] text-stone-600 underline underline-offset-4">
                View bag
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

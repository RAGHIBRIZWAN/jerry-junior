import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import QuantityInput from '../components/QuantityInput';
import Seo from '../components/Seo';
import { thumbUrl } from '../lib/api';
import { money } from '../lib/format';

export default function Cart() {
  const { items, total, count, updateQuantity, removeItem, MAX_QTY } = useCart();
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="container-x py-24 text-center">
        <Seo title="Your bag" />
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-stone-500">Find something lovely for your little one.</p>
        <Link to="/shop" className="btn btn-dark mt-8">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-x py-10 sm:py-14">
      <Seo title="Your bag" />
      <h1 className="text-center font-display text-4xl">
        Your Bag <span className="font-sans text-base text-stone-500">({count})</span>
      </h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {items.map((item) => (
            <li key={item.key} className="flex gap-4 py-6 sm:gap-6">
              <Link to={`/product/${item.productId}`} className="h-36 w-28 shrink-0 overflow-hidden bg-sand sm:h-40 sm:w-32">
                {item.image && <img src={thumbUrl(item.image)} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <Link to={`/product/${item.productId}`} className="font-medium hover:text-accent">
                    {item.title}
                  </Link>
                  <span className="shrink-0 font-medium">{money(item.price * item.quantity)}</span>
                </div>
                {item.size && <p className="mt-1 text-xs uppercase tracking-wider text-stone-500">Size: {item.size}</p>}
                <p className="mt-1 text-sm text-stone-500">{money(item.price)} each</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityInput small value={item.quantity} max={MAX_QTY} onChange={(q) => updateQuantity(item.key, q)} />
                  <button onClick={() => removeItem(item.key)} className="text-xs uppercase tracking-wider text-stone-500 underline underline-offset-4 hover:text-ink">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="bg-white p-6 ring-1 ring-stone-200">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em]">Order summary</h2>
          <div className="mt-5 flex justify-between text-lg">
            <span>Subtotal</span>
            <span className="font-medium">{money(total)}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">Delivery charges are confirmed on WhatsApp.</p>
          <button className="btn btn-dark mt-6 w-full" onClick={() => navigate('/checkout')}>
            Checkout
          </button>
          <Link to="/shop" className="mt-4 block text-center text-xs uppercase tracking-[0.18em] text-stone-600 underline underline-offset-4">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

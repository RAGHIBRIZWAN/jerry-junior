import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Seo from '../components/Seo';
import { WhatsAppIcon } from '../components/Icons';
import api, { errorMessage, isOfflineError, thumbUrl } from '../lib/api';
import { money } from '../lib/format';
import { saveLastOrder } from './OrderPlaced';

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your full name';
  const digits = f.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) e.phone = 'Please enter a valid phone number, e.g. 0300 1234567';
  if (f.address.trim().length < 5) e.address = 'Please enter your full delivery address';
  if (!f.city.trim()) e.city = 'Please enter your city';
  return e;
}

const FIELDS = [
  { name: 'name', label: 'Full name', autoComplete: 'name', placeholder: 'e.g. Ayesha Khan' },
  { name: 'phone', label: 'Phone (WhatsApp)', autoComplete: 'tel', type: 'tel', inputMode: 'tel', placeholder: '0300 1234567' },
  { name: 'address', label: 'Delivery address', autoComplete: 'street-address', textarea: true, placeholder: 'House, street, area' },
  { name: 'city', label: 'City', autoComplete: 'address-level2', placeholder: 'e.g. Karachi' },
  { name: 'notes', label: 'Notes (optional)', textarea: true, placeholder: "e.g. child's age, preferred delivery time" },
];

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!items.length) {
    return (
      <div className="container-x py-24 text-center">
        <Seo title="Checkout" />
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <Link to="/shop" className="btn btn-dark mt-8">
          Continue shopping
        </Link>
      </div>
    );
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) {
      document.querySelector(`[name="${Object.keys(v)[0]}"]`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setOffline(false);
    try {
      const { data } = await api.post('/orders', {
        customer: form,
        items: items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity })),
      });
      saveLastOrder({ orderNumber: data.orderNumber, whatsappUrl: data.whatsappUrl, total: data.total });
      clearCart();
      // The Order Placed page opens WhatsApp automatically with the whole order.
      navigate('/order-placed', { replace: true, state: { justPlaced: true } });
    } catch (err) {
      setOffline(isOfflineError(err));
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
      setSubmitError(errorMessage(err, 'Could not place your order. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="container-x py-10 sm:py-14">
      <Seo title="Checkout" />
      <h1 className="text-center font-display text-4xl">Checkout</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-stone-500">
        No account needed. After you place your order, WhatsApp opens with all the details. Just tap Send.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px] lg:items-start">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em]">Delivery details</h2>
          {FIELDS.map((f) => {
            const Tag = f.textarea ? 'textarea' : 'input';
            return (
              <div key={f.name}>
                <label htmlFor={f.name} className="label">
                  {f.label}
                </label>
                <Tag
                  id={f.name}
                  name={f.name}
                  type={f.textarea ? undefined : f.type || 'text'}
                  rows={f.textarea ? (f.name === 'notes' ? 2 : 3) : undefined}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={onChange}
                  aria-invalid={Boolean(errors[f.name])}
                  aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
                  className={`input ${errors[f.name] ? 'border-red-400' : ''}`}
                />
                {errors[f.name] && (
                  <p id={`${f.name}-error`} className="mt-1.5 text-sm text-red-600">
                    {errors[f.name]}
                  </p>
                )}
              </div>
            );
          })}

          {submitError && (
            <div className={`p-4 text-sm ${offline ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-700'}`} role="alert">
              {submitError}
              {offline && <span className="block">Your details and bag are kept. Please try again in a moment.</span>}
            </div>
          )}

          <button type="submit" className="btn btn-dark w-full py-4" disabled={submitting}>
            <WhatsAppIcon className="h-5 w-5" />
            {submitting ? 'Placing order…' : `Place order · ${money(total)}`}
          </button>
          <p className="text-center text-xs text-stone-500">We'll confirm your order and delivery details on WhatsApp.</p>
        </form>

        <aside className="bg-white p-6 ring-1 ring-stone-200 lg:sticky lg:top-28">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em]">Your order</h2>
          <ul className="mt-4 divide-y divide-stone-100">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3 py-3">
                <div className="relative h-20 w-16 shrink-0 bg-sand">
                  {i.image && <img src={thumbUrl(i.image)} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">{i.quantity}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-2">{i.title}</p>
                  {i.size && <p className="mt-0.5 text-xs uppercase tracking-wider text-stone-500">Size {i.size}</p>}
                </div>
                <span className="text-sm">{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-stone-200 pt-4 text-lg">
            <span>Total</span>
            <span className="font-medium">{money(total)}</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">Delivery charges confirmed on WhatsApp.</p>
          <Link to="/cart" className="mt-4 block text-center text-xs uppercase tracking-[0.18em] text-stone-600 underline underline-offset-4">
            Edit bag
          </Link>
        </aside>
      </div>
    </div>
  );
}

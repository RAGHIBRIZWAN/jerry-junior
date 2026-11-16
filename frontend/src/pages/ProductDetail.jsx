import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useApi from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import Gallery from '../components/Gallery';
import QuantityInput from '../components/QuantityInput';
import OfflineNotice from '../components/OfflineNotice';
import ProductCard from '../components/ProductCard';
import Seo from '../components/Seo';
import { ChevronDown, WhatsAppIcon } from '../components/Icons';
import { money } from '../lib/format';
import { errorDetail, errorMessage, mediaUrl, productMedia } from '../lib/api';
import { SITE_URL } from '../config';
import NotFound from './NotFound';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, openCart, MAX_QTY } = useCart();
  const { chatUrl } = useShop();
  const { data: product, loading, error, offline, retry } = useApi(`/products/${id}`);
  const related = useApi(product?.category ? '/products' : null, { category: product?.category });
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const media = useMemo(() => productMedia(product), [product]);

  if (offline) return <OfflineNotice onRetry={retry} detail={errorDetail(error)} />;
  if (error?.response?.status === 404) return <NotFound what="product" />;
  if (error)
    return (
      <div className="py-20 text-center">
        <p className="text-stone-500">{errorMessage(error)}</p>
        <button className="btn btn-light mt-6" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (loading || !product) return <DetailSkeleton />;

  const needsSize = product.sizes?.length > 0;
  const add = () => {
    if (needsSize && !size) {
      setSizeError(true);
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    addItem(product, size, quantity);
    return true;
  };
  const onAddToBag = () => add() && openCart();
  const onOrderNow = () => add() && navigate('/checkout');

  const askUrl = chatUrl(
    `Hi! I'm interested in "${product.title}" (${money(product.price)})${size ? `, size ${size}` : ''}.\n${SITE_URL}/product/${product._id}`
  );
  const moreLikeThis = (related.data || []).filter((p) => p._id !== product._id).slice(0, 4);

  return (
    <div className="pb-24 lg:pb-0">
      <Seo
        title={product.title}
        description={product.caption?.slice(0, 160) || `${product.title}, ${money(product.price)}`}
        image={mediaUrl(product.images?.[0])}
        path={`/product/${product._id}`}
        type="product"
      />

      <div className="container-x py-5 sm:py-8">
        <nav className="mb-5 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-ink">Shop</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">
                {product.category}
              </Link>
            </>
          )}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <Gallery media={media} title={product.title} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.category && <p className="eyebrow">{product.category}</p>}
            <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{product.title}</h1>
            <p className="mt-3 text-xl">{money(product.price)}</p>

            {!product.inStock ? (
              <div className="mt-8 border border-stone-300 bg-white p-5">
                <p className="text-sm font-medium uppercase tracking-[0.18em]">Sold out</p>
                <p className="mt-1 text-sm text-stone-500">Message us to ask when it will be back in stock.</p>
                {askUrl && (
                  <a href={askUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp mt-4 w-full">
                    <WhatsAppIcon className="h-5 w-5" /> Ask on WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <>
                {needsSize && (
                  <div id="size-picker" className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-[0.2em]">
                        Size{size && <span className="ml-2 font-normal normal-case tracking-normal text-stone-500">{size}</span>}
                      </p>
                      {sizeError && <p className="text-xs text-red-600">Please select a size</p>}
                    </div>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                      {product.sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={size === s}
                          onClick={() => {
                            setSize(s);
                            setSizeError(false);
                          }}
                          className={`min-w-14 border px-4 py-3 text-sm transition ${
                            size === s ? 'border-ink bg-ink text-white' : `bg-white hover:border-ink ${sizeError ? 'border-red-400' : 'border-stone-300'}`
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]">Quantity</p>
                  <QuantityInput value={quantity} onChange={setQuantity} max={MAX_QTY} />
                </div>

                <div className="mt-8 hidden flex-col gap-3 lg:flex">
                  <button className="btn btn-light w-full" onClick={onAddToBag}>
                    Add to bag
                  </button>
                  <button className="btn btn-dark w-full" onClick={onOrderNow}>
                    Order now
                  </button>
                </div>
                {askUrl && (
                  <a href={askUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-600 hover:text-ink">
                    <WhatsAppIcon className="h-4 w-4 text-whatsapp" /> Questions? Ask us on WhatsApp
                  </a>
                )}
              </>
            )}

            <div className="mt-8 border-t border-stone-200">
              {product.caption && (
                <Accordion title="Description" defaultOpen>
                  <p className="whitespace-pre-line">{product.caption}</p>
                </Accordion>
              )}
              {product.sizes?.length > 0 && (
                <Accordion title="Sizes">
                  <p>Available in: {product.sizes.join(', ')}.</p>
                  <p className="mt-2">Not sure which size? Message us on WhatsApp with your child's age and we'll help.</p>
                </Accordion>
              )}
              <Accordion title="Ordering & delivery">
                <p>Add to your bag and check out. WhatsApp opens with your full order. Just tap Send.</p>
                <p className="mt-2">We'll confirm availability, delivery charges and timing with you on WhatsApp.</p>
              </Accordion>
            </div>
          </div>
        </div>

        {moreLikeThis.length > 0 && (
          <section className="mt-20">
            <h2 className="section-title mb-8 text-center">You may also like</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4">
              {moreLikeThis.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky buttons on phones */}
      {product.inStock && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-stone-200 bg-cream/95 p-3 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button className="btn btn-light flex-1 px-2" onClick={onAddToBag}>
            Add to bag
          </button>
          <button className="btn btn-dark flex-1 px-2" onClick={onOrderNow}>
            Order now
          </button>
        </div>
      )}
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-200">
      <button className="flex w-full items-center justify-between py-4 text-left text-xs font-medium uppercase tracking-[0.2em]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {title}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-5 text-sm leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
      <div className="skeleton aspect-[3/4]" />
      <div className="space-y-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-9 w-3/4" />
        <div className="skeleton h-6 w-32" />
        <div className="skeleton mt-8 h-12 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
    </div>
  );
}

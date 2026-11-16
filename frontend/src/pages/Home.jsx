import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../lib/useApi';
import { mediaUrl, thumbUrl } from '../lib/api';
import { money } from '../lib/format';
import { useShop } from '../context/ShopContext';
import { ProductGrid } from '../components/ProductCard';
import OfflineNotice from '../components/OfflineNotice';
import Seo from '../components/Seo';
import { ChatIcon, FacebookIcon, ShirtIcon, SparkleIcon, TruckIcon } from '../components/Icons';
import BannerCarousel from '../components/BannerCarousel';
import { BRAND_NAME, FACEBOOK_URL } from '../config';

export default function Home() {
  const products = useApi('/products');
  const { categories } = useShop();
  const list = products.data || [];
  const withPhotos = list.filter((p) => p.images?.length);
  const withVideos = list.filter((p) => p.videos?.length);
  // Products you ticked "New arrival" for in the admin panel
  const newArrivals = list.filter((p) => p.newArrival);

  if (products.offline) return <OfflineNotice onRetry={products.retry} />;

  return (
    <>
      <Seo />
      <h1 className="sr-only">{BRAND_NAME}: kids wear in Karachi</h1>
      <BannerCarousel />

      {categories.length > 0 && <Categories categories={categories} products={withPhotos} />}

      {/* New Arrivals: only the products marked "New arrival" in admin */}
      {(products.loading || newArrivals.length > 0) && (
        <section className="container-x mt-16 sm:mt-24">
          <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
            <div>
              <p className="eyebrow">Just in</p>
              <h2 className="section-title mt-2">New Arrivals</h2>
            </div>
            <Link to="/shop?new=1" className="link-underline text-xs uppercase tracking-[0.2em]">
              View all
            </Link>
          </div>
          <ProductGrid products={newArrivals.slice(0, 8)} loading={products.loading} />
        </section>
      )}

      {/* Everything else */}
      <section className="container-x mt-16 sm:mt-24">
        <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
          <div>
            <p className="eyebrow">Our collection</p>
            <h2 className="section-title mt-2">Shop the Range</h2>
          </div>
          <Link to="/shop" className="link-underline text-xs uppercase tracking-[0.2em]">
            View all
          </Link>
        </div>
        {products.error ? (
          <p className="py-10 text-center text-stone-500">Could not load products. Please refresh the page.</p>
        ) : !products.loading && !list.length ? (
          <p className="py-10 text-center text-stone-500">New styles are coming soon. Check back shortly!</p>
        ) : (
          <ProductGrid products={list.slice(0, 8)} loading={products.loading} />
        )}
        {list.length > 8 && (
          <div className="mt-12 text-center">
            <Link to="/shop" className="btn btn-light">
              Shop all {list.length} styles
            </Link>
          </div>
        )}
      </section>

      {withVideos.length > 0 && <VideoReel products={withVideos.slice(0, 10)} />}

      <Features />
      <HowToOrder />
      <FacebookBanner />
    </>
  );
}

function Categories({ categories, products }) {
  return (
    <section className="container-x mt-16 sm:mt-20">
      <div className="mb-8 text-center">
        <p className="eyebrow">Find their style</p>
        <h2 className="section-title mt-2">Shop by Category</h2>
      </div>
      <div className="no-scrollbar -mx-4 flex justify-start gap-5 overflow-x-auto px-4 sm:justify-center sm:gap-10">
        {categories.map((c) => {
          const p = products.find((x) => x.category === c);
          return (
            <Link key={c} to={`/shop?category=${encodeURIComponent(c)}`} className="group flex w-24 shrink-0 flex-col items-center sm:w-32">
              <span className="block aspect-square w-full overflow-hidden rounded-full bg-sand ring-1 ring-stone-200 transition group-hover:ring-2 group-hover:ring-accent">
                {p && <img src={thumbUrl(p.images[0])} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />}
              </span>
              <span className="mt-3 text-center text-xs uppercase tracking-[0.18em]">{c}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ReelVideo({ src }) {
  const ref = useRef(null);
  // Play only while visible, to save data on phones.
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? el.play().catch(() => {}) : el.pause()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={mediaUrl(src)} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />;
}

function VideoReel({ products }) {
  return (
    <section className="mt-20 bg-ink py-16 text-white sm:mt-28">
      <div className="container-x">
        <div className="mb-8 text-center">
          <p className="eyebrow">Watch &amp; shop</p>
          <h2 className="section-title mt-2">See it in motion</h2>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
          {products.map((p) => (
            <Link key={p._id} to={`/product/${p._id}`} className="group w-56 shrink-0 sm:w-64">
              <div className="aspect-[9/16] overflow-hidden bg-stone-800">
                <ReelVideo src={p.videos[0]} />
              </div>
              <p className="mt-3 line-clamp-1 text-sm">{p.title}</p>
              <p className="text-sm text-stone-400">{money(p.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: ChatIcon, title: 'Order on WhatsApp', text: 'Your whole bag is sent to us in one tap.' },
    { icon: SparkleIcon, title: 'No account needed', text: 'Just pick your styles and your size.' },
    { icon: ShirtIcon, title: 'Made for little ones', text: 'Kids clothing chosen with care.' },
    { icon: TruckIcon, title: 'Delivery to your door', text: 'Charges and timing confirmed on WhatsApp.' },
  ];
  return (
    <section className="container-x mt-20 grid grid-cols-2 gap-x-6 gap-y-10 border-y border-stone-200 py-12 sm:mt-24 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="text-center">
          <Icon className="mx-auto h-8 w-8 text-accent" />
          <h3 className="mt-3 text-xs font-medium uppercase tracking-[0.2em]">{title}</h3>
          <p className="mx-auto mt-2 max-w-[220px] text-sm text-stone-500">{text}</p>
        </div>
      ))}
    </section>
  );
}

function HowToOrder() {
  const steps = [
    ['Choose', 'Browse the collection, pick a size and add it to your bag.'],
    ['Checkout', 'Enter your name, phone number and delivery address.'],
    ['Send on WhatsApp', 'WhatsApp opens with your full order. Just tap Send.'],
    ['We confirm', 'We reply on WhatsApp to confirm and arrange delivery.'],
  ];
  return (
    <section id="how-to-order" className="container-x mt-20 scroll-mt-24 sm:mt-24">
      <div className="mb-10 text-center">
        <p className="eyebrow">Simple &amp; quick</p>
        <h2 className="section-title mt-2">How to Order</h2>
      </div>
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, text], i) => (
          <li key={title} className="bg-white p-6 text-center ring-1 ring-stone-200">
            <span className="font-display text-4xl text-accent">0{i + 1}</span>
            <h3 className="mt-3 text-sm font-medium uppercase tracking-[0.18em]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FacebookBanner() {
  return (
    <section className="container-x mt-20 sm:mt-24">
      <div className="flex flex-col items-center gap-5 bg-sand px-6 py-12 text-center sm:py-16">
        <p className="eyebrow">Join the family</p>
        <h2 className="section-title max-w-xl">Follow {BRAND_NAME} on Facebook</h2>
        <p className="max-w-md text-sm text-ink-soft">Be the first to see new arrivals, offers and restocks.</p>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="btn btn-dark mt-2">
          <FacebookIcon className="h-4 w-4" /> Follow us
        </a>
      </div>
    </section>
  );
}

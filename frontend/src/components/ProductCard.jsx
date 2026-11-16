import { Link } from 'react-router-dom';
import { thumbUrl } from '../lib/api';
import { money } from '../lib/format';

export default function ProductCard({ product }) {
  const [cover, second] = product.images || [];

  return (
    <Link to={`/product/${product._id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-sand">
        {cover ? (
          <>
            <img
              src={thumbUrl(cover)}
              alt={product.title}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${second ? 'group-hover:opacity-0' : ''}`}
            />
            {second && (
              <img
                src={thumbUrl(second)}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-stone-400">No photo</div>
        )}

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.newArrival && <span className="bg-accent px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white">New</span>}
          {!product.inStock && <span className="bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-ink">Sold out</span>}
        </div>
        {product.inStock && (
          <span className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 bg-white/95 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.2em] opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
            View product
          </span>
        )}
      </div>
      <div className="pt-3 text-center">
        {product.category && <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{product.category}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug sm:text-[15px]">{product.title}</h3>
        <p className={`mt-1.5 text-sm font-medium ${product.inStock ? 'text-ink' : 'text-stone-400'}`}>{money(product.price)}</p>
        {product.sizes?.length > 0 && (
          <p className="mt-1 hidden truncate text-[11px] tracking-wide text-stone-500 sm:block">{product.sizes.join(' · ')}</p>
        )}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[3/4]" />
      <div className="mx-auto mt-3 h-3 w-3/4 skeleton" />
      <div className="mx-auto mt-2 h-3 w-1/3 skeleton" />
    </div>
  );
}

export function ProductGrid({ products, loading, count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {loading
        ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p) => <ProductCard key={p._id} product={p} />)}
    </div>
  );
}

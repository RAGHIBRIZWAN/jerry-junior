import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useApi from '../lib/useApi';
import { ProductGrid } from '../components/ProductCard';
import OfflineNotice from '../components/OfflineNotice';
import Seo from '../components/Seo';
import { CloseIcon, FilterIcon, SearchIcon } from '../components/Icons';
import { useLockScroll } from '../components/Header';

const SORTS = {
  new: { label: 'Newest', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  low: { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  high: { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
};

// Sort sizes in a natural order: 0-3M, 3-6M, 1-2Y, 2-3Y ... XS, S, M, L, XL
function sizeRank(s) {
  const m = s.match(/^(\d+)/);
  if (m) return (/M$/i.test(s) ? 0 : 100) + Number(m[1]);
  const letters = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const i = letters.indexOf(s.toUpperCase());
  return i >= 0 ? 1000 + i : 2000;
}

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const size = params.get('size') || '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'new';
  const inStockOnly = params.get('instock') === '1';
  const newOnly = params.get('new') === '1';
  const [search, setSearch] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const products = useApi('/products', { search: q || undefined });
  const all = products.data || [];

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const categories = useMemo(() => [...new Set(all.map((p) => p.category).filter(Boolean))].sort(), [all]);
  const sizes = useMemo(() => [...new Set(all.flatMap((p) => p.sizes || []))].sort((a, b) => sizeRank(a) - sizeRank(b)), [all]);

  const shown = useMemo(
    () =>
      all
        .filter((p) => !category || p.category?.toLowerCase() === category.toLowerCase())
        .filter((p) => !size || p.sizes?.includes(size))
        .filter((p) => !inStockOnly || p.inStock)
        .filter((p) => !newOnly || p.newArrival)
        .sort(SORTS[sort].fn),
    [all, category, size, inStockOnly, newOnly, sort]
  );

  const activeCount = [category, size, inStockOnly, newOnly].filter(Boolean).length;
  const heading = newOnly && !category ? 'New Arrivals' : category || (q ? `Results for “${q}”` : 'Shop All');

  const filters = (
    <Filters
      categories={categories}
      sizes={sizes}
      category={category}
      size={size}
      inStockOnly={inStockOnly}
      newOnly={newOnly}
      set={set}
      clear={() => setParams(q ? { q } : {}, { replace: true })}
      activeCount={activeCount}
    />
  );

  return (
    <>
      <Seo title={heading} path={`/shop${params.toString() ? `?${params}` : ''}`} />
      <div className="border-b border-stone-200 bg-sand">
        <div className="container-x py-10 text-center sm:py-14">
          <p className="eyebrow">Collection</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{heading}</h1>
          <form
            className="mx-auto mt-6 flex max-w-md items-center gap-2 border-b border-ink pb-1"
            onSubmit={(e) => {
              e.preventDefault();
              set('q', search.trim());
            }}
          >
            <SearchIcon className="h-5 w-5 text-stone-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </form>
        </div>
      </div>

      <div className="container-x py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <button className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] lg:hidden" onClick={() => setFiltersOpen(true)}>
            <FilterIcon className="h-5 w-5" /> Filter {activeCount > 0 && `(${activeCount})`}
          </button>
          <p className="hidden text-xs uppercase tracking-[0.18em] text-stone-500 lg:block">
            {products.loading ? 'Loading…' : `${shown.length} product${shown.length === 1 ? '' : 's'}`}
          </p>
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
            <span className="hidden sm:inline">Sort by</span>
            <select value={sort} onChange={(e) => set('sort', e.target.value === 'new' ? '' : e.target.value)} className="border border-stone-300 bg-white px-3 py-2 text-xs uppercase tracking-wider outline-none">
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">{filters}</aside>
          <div>
            {products.offline ? (
              <OfflineNotice onRetry={products.retry} />
            ) : products.error ? (
              <p className="py-16 text-center text-stone-500">Could not load products. Please refresh the page.</p>
            ) : !products.loading && !shown.length ? (
              <div className="py-16 text-center">
                <p className="font-display text-2xl">No products found</p>
                <button className="btn btn-light mt-6" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </button>
              </div>
            ) : (
              <ProductGrid products={shown} loading={products.loading} count={12} />
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <FilterDrawer onClose={() => setFiltersOpen(false)} count={shown.length}>
          {filters}
        </FilterDrawer>
      )}
    </>
  );
}

function Filters({ categories, sizes, category, size, inStockOnly, newOnly, set, clear, activeCount }) {
  return (
    <div className="space-y-8">
      {categories.length > 0 && (
        <FilterGroup title="Category">
          <FilterOption active={!category} onClick={() => set('category', '')}>
            All
          </FilterOption>
          {categories.map((c) => (
            <FilterOption key={c} active={category.toLowerCase() === c.toLowerCase()} onClick={() => set('category', c)}>
              {c}
            </FilterOption>
          ))}
        </FilterGroup>
      )}
      {sizes.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => set('size', size === s ? '' : s)}
                className={`min-w-12 border px-3 py-2 text-xs transition ${size === s ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white hover:border-ink'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => set('instock', e.target.checked ? '1' : '')} className="h-4 w-4 accent-ink" />
          In stock only
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={newOnly} onChange={(e) => set('new', e.target.checked ? '1' : '')} className="h-4 w-4 accent-ink" />
          New arrivals only
        </label>
      </FilterGroup>
      {activeCount > 0 && (
        <button onClick={clear} className="link-underline text-xs uppercase tracking-[0.18em]">
          Clear all filters
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.22em]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterOption({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`block text-left text-sm transition hover:text-accent ${active ? 'font-medium text-ink underline underline-offset-4' : 'text-stone-600'}`}>
      {children}
    </button>
  );
}

function FilterDrawer({ onClose, count, children }) {
  useLockScroll();
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-cream">
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <h2 className="font-display text-2xl">Filter</h2>
          <button onClick={onClose} className="p-2" aria-label="Close filters">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="border-t border-stone-200 p-4">
          <button className="btn btn-dark w-full" onClick={onClose}>
            Show {count} product{count === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

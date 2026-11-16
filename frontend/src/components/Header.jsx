import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useShop } from '../context/ShopContext';
import { ANNOUNCEMENTS } from '../config';
import Logo from './Logo';
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from './Icons';

function AnnouncementBar() {
  if (!ANNOUNCEMENTS.length) return null;
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div className="overflow-hidden bg-ink py-2 text-[11px] uppercase tracking-[0.25em] text-white/90">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap motion-reduce:animate-none">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12">
            {t} <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Header() {
  const { count, openCart } = useCart();
  const { categories } = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  const nav = [
    { to: '/', label: 'Home', end: true },
    { to: '/shop', label: 'Shop All', end: true },
    { to: '/shop?new=1', label: 'New Arrivals' },
    ...categories.slice(0, 5).map((c) => ({ to: `/shop?category=${encodeURIComponent(c)}`, label: c })),
  ];

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="container-x grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-20">
          <div className="flex items-center gap-1">
            <button className="-ml-2 p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <MenuIcon className="h-6 w-6" />
            </button>
            <nav className="hidden items-center gap-7 lg:flex">
              {nav.slice(0, 4).map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
            </nav>
          </div>

          <Link to="/" aria-label="Home">
            <Logo />
          </Link>

          <div className="flex items-center justify-end gap-1 sm:gap-3">
            <nav className="mr-4 hidden items-center gap-7 xl:flex">
              {nav.slice(4).map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
            </nav>
            <button className="p-2" onClick={() => setSearchOpen(true)} aria-label="Search">
              <SearchIcon className="h-6 w-6" />
            </button>
            <button className="relative -mr-2 p-2" onClick={openCart} aria-label={`Shopping bag, ${count} items`}>
              <BagIcon className="h-6 w-6" />
              {count > 0 && (
                <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <MobileMenu nav={nav} onClose={() => setMenuOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function NavItem({ to, label, end }) {
  const location = useLocation();
  // Category links use ?category=, so compare the full URL
  const active = to.includes('?') ? `${location.pathname}${location.search}` === to : undefined;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `text-[12px] font-medium uppercase tracking-[0.18em] transition hover:text-accent ${
          (active ?? (isActive && !location.search)) ? 'text-accent' : 'text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function MobileMenu({ nav, onClose }) {
  useLockScroll();
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-cream shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <Logo />
          <button onClick={onClose} className="p-2" aria-label="Close menu">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="block border-b border-stone-100 px-3 py-4 text-sm uppercase tracking-[0.18em]">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const input = useRef(null);
  useLockScroll();
  useEffect(() => {
    input.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        className="relative bg-cream px-4 py-6 shadow-lg sm:py-10"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 border-b-2 border-ink pb-2">
          <SearchIcon className="h-6 w-6 shrink-0" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for shirts, frocks, sets…"
            className="w-full bg-transparent py-2 font-display text-xl outline-none sm:text-2xl"
            type="search"
          />
          <button type="button" onClick={onClose} className="p-1" aria-label="Close search">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
      </form>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLockScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}

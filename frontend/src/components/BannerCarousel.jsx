import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../lib/useApi';
import { mediaUrl } from '../lib/api';
import { ChevronLeft, ChevronRight } from './Icons';

// Shown until you add banners in the admin panel (Banners tab).
const DEFAULT_BANNER = [{ _id: 'default', image: '/banner-default.jpg', link: '' }];

const AUTOPLAY_MS = 5000;

function Slide({ banner, eager }) {
  const src = mediaUrl(banner.image, 1920); // Cloudinary sizes it; /banner-default.jpg is used as it is
  const img = (
    <img
      src={src}
      alt="Jerry Junior banner"
      loading={eager ? 'eager' : 'lazy'}
      draggable="false"
      className="h-full w-full select-none object-cover"
    />
  );
  const cls = 'block h-full w-full';
  if (!banner.link) return <div className={cls}>{img}</div>;
  if (banner.link.startsWith('/')) return <Link to={banner.link} className={cls}>{img}</Link>;
  return (
    <a href={banner.link} target="_blank" rel="noopener noreferrer" className={cls}>
      {img}
    </a>
  );
}

export default function BannerCarousel() {
  const { data, loading } = useApi('/banners');
  // No banners added yet (or still loading failed): show the default one.
  const banners = data?.length ? data : loading ? [] : DEFAULT_BANNER;
  const count = banners.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);

  const go = useCallback((d) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused, go]);

  if (!count) return <div className="skeleton aspect-[2.6/1] w-full" />;

  return (
    <section
      className="relative w-full overflow-hidden bg-sand"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? -1 : 1);
      }}
    >
      <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => (
          <div
            key={b._id}
            className="aspect-[2.6/1] w-full shrink-0"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
          >
            <Slide banner={b} eager={i === 0} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2.5 shadow transition hover:bg-white sm:block" aria-label="Previous banner">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2.5 shadow transition hover:bg-white sm:block" aria-label="Next banner">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2 sm:bottom-3">
            {banners.map((b, i) => (
              <button
                key={b._id}
                onClick={() => setIndex(i)}
                aria-label={`Show banner ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-ink' : 'w-2 bg-ink/35 hover:bg-ink/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

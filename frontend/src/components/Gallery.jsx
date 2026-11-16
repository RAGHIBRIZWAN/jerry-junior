import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl, thumbUrl } from '../lib/api';
import { ChevronLeft, ChevronRight, CloseIcon, PlayIcon } from './Icons';

/** Swipe left/right on touch screens. */
function useSwipe(onPrev, onNext) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => {
      start.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x;
      const dy = e.changedTouches[0].clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx > 0 ? onPrev : onNext)();
    },
  };
}

function Thumb({ item }) {
  if (item.type === 'video') {
    return (
      <span className="relative block h-full w-full bg-stone-800">
        <video src={`${mediaUrl(item.src)}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center text-white">
          <PlayIcon className="h-5 w-5 drop-shadow" />
        </span>
      </span>
    );
  }
  return <img src={thumbUrl(item.src)} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

/** media: [{ type: 'image' | 'video', src }] */
export default function Gallery({ media, title }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const count = media.length;
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const swipe = useSwipe(prev, next);

  useEffect(() => {
    setIndex(0);
  }, [media]);

  if (!count) {
    return <div className="flex aspect-[3/4] items-center justify-center bg-sand text-xs uppercase tracking-widest text-stone-400">No photos</div>;
  }
  const current = media[index];

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {count > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[680px] lg:w-20 lg:flex-col lg:overflow-y-auto">
          {media.map((m, i) => (
            <button
              key={m.src + i}
              type="button"
              onClick={() => setIndex(i)}
              className={`aspect-[3/4] w-16 shrink-0 overflow-hidden border transition lg:w-full ${i === index ? 'border-ink' : 'border-transparent opacity-60 hover:opacity-100'}`}
              aria-label={`Show ${m.type} ${i + 1}`}
            >
              <Thumb item={m} />
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden bg-sand" {...swipe}>
        {current.type === 'video' ? (
          <video
            key={current.src}
            src={mediaUrl(current.src)}
            controls
            playsInline
            autoPlay
            muted
            loop
            className="aspect-[3/4] w-full bg-black object-contain"
          />
        ) : (
          <button type="button" className="block aspect-[3/4] w-full cursor-zoom-in" onClick={() => setFullscreen(true)} aria-label="View full screen">
            <img src={mediaUrl(current.src)} alt={`${title}, picture ${index + 1} of ${count}`} className="h-full w-full object-cover" draggable="false" />
          </button>
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-sm transition hover:bg-white sm:block" aria-label="Previous">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={next} className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-sm transition hover:bg-white sm:block" aria-label="Next">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 bg-white/90 px-2.5 py-1 text-[11px] tracking-wider">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {fullscreen && <Lightbox media={media} index={index} setIndex={setIndex} title={title} onClose={() => setFullscreen(false)} />}
    </div>
  );
}

function Lightbox({ media, index, setIndex, onClose, title }) {
  const [zoom, setZoom] = useState(null);
  const count = media.length;
  const go = useCallback(
    (d) => {
      setZoom(null);
      setIndex((i) => (i + d + count) % count);
    },
    [count, setIndex]
  );
  const swipe = useSwipe(() => go(-1), () => go(1));
  const item = media[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, go]);

  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`${title} pictures`}>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs tracking-widest">
          {index + 1} / {count}
        </span>
        <button type="button" onClick={onClose} className="p-2" aria-label="Close">
          <CloseIcon className="h-7 w-7" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" {...(zoom ? {} : swipe)}>
        {item.type === 'video' ? (
          <video key={item.src} src={mediaUrl(item.src)} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : (
          <img
            src={mediaUrl(item.src)}
            alt={`${title}, picture ${index + 1}`}
            onClick={(e) => setZoom(zoom ? null : point(e))}
            onPointerMove={(e) => zoom && e.pointerType !== 'touch' && setZoom(point(e))}
            draggable="false"
            className={`max-h-full max-w-full select-none object-contain transition-transform duration-200 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        )}
        {count > 1 && !zoom && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 rounded-full bg-stone-100 p-3 hover:bg-stone-200" aria-label="Previous">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 rounded-full bg-stone-100 p-3 hover:bg-stone-200" aria-label="Next">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      <p className="py-3 text-center text-[11px] uppercase tracking-[0.2em] text-stone-500">Tap the picture to zoom</p>
    </div>
  );
}

import { BRAND_NAME } from '../config';

/** The Jerry Junior logo (frontend/public/logo.png). It already contains the shop name. */
export default function Logo({ className = '', light = false }) {
  return (
    <img
      src="/logo.png"
      alt={BRAND_NAME}
      className={`h-12 w-12 rounded-xl object-contain sm:h-16 sm:w-16 ${light ? 'bg-white p-1' : ''} ${className}`}
    />
  );
}

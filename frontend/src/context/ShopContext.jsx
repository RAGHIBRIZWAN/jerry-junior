import { createContext, useContext, useMemo } from 'react';
import useApi from '../lib/useApi';
import { BRAND_NAME, FALLBACK_WHATSAPP, SHOP_CITY } from '../config';

const ShopContext = createContext(null);

/** Shop details from the backend (/api/settings). The WhatsApp number lives in backend/.env. */
export function ShopProvider({ children }) {
  const settings = useApi('/settings');
  const categories = useApi('/categories');

  const value = useMemo(() => {
    const whatsapp = settings.data?.whatsapp || FALLBACK_WHATSAPP;
    return {
      shopName: BRAND_NAME,
      city: settings.data?.city ? `${settings.data.city}, Pakistan` : SHOP_CITY,
      whatsapp,
      categories: categories.data || [],
      chatUrl: (text = `Hi ${BRAND_NAME}, I have a question.`) =>
        whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` : '',
      retry: () => {
        settings.retry();
        categories.retry();
      },
    };
  }, [settings, categories]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}

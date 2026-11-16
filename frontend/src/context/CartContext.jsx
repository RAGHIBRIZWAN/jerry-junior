import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cart_v1';
const MAX_QTY = 20;
const CartContext = createContext(null);

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(items) ? items.filter((i) => i && i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

const keyOf = (productId, size) => `${productId}__${size || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [isOpen, setIsOpen] = useState(false); // slide-out bag

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked; cart still works for this visit */
    }
  }, [items]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setItems(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((product, size, quantity = 1) => {
    const key = keyOf(product._id, size);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i));
      }
      return [
        ...prev,
        {
          key,
          productId: product._id,
          title: product.title,
          price: product.price, // display only; the server uses the real price
          image: product.images?.[0] || '',
          size: size || '',
          quantity: Math.min(MAX_QTY, quantity),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(MAX_QTY, quantity)) } : i)));
  }, []);

  const removeItem = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
    return {
      items,
      count,
      total,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      MAX_QTY,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    };
  }, [items, addItem, updateQuantity, removeItem, clearCart, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

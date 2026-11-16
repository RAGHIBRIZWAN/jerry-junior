import { useShop } from '../context/ShopContext';
import { WhatsAppIcon } from './Icons';

export default function FloatingWhatsApp() {
  const { chatUrl } = useShop();
  const url = chatUrl();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg shadow-black/25 transition hover:scale-105"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <WhatsAppIcon className="h-8 w-8" />
    </a>
  );
}

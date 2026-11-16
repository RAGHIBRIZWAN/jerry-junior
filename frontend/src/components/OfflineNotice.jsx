import { useShop } from '../context/ShopContext';

export default function OfflineNotice({ onRetry, message }) {
  const { chatUrl } = useShop();
  const wa = chatUrl();
  return (
    <div className="mx-auto my-12 max-w-md border border-stone-200 bg-white p-8 text-center sm:p-10">
      <p className="eyebrow">Be right back</p>
      <h2 className="mt-3 font-display text-2xl">{message || 'Shop is temporarily offline, please try again shortly'}</h2>
      <p className="mt-3 text-sm text-stone-500">Your bag is saved on this device. You can also message us on WhatsApp.</p>
      <div className="mt-7 flex flex-col gap-3">
        {onRetry && (
          <button className="btn btn-dark" onClick={onRetry}>
            Try again
          </button>
        )}
        {wa && (
          <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
            Message us on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

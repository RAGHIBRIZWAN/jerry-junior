import { Link } from 'react-router-dom';
import { TAGLINE, SOCIAL } from '../config';
import { useShop } from '../context/ShopContext';
import Logo from './Logo';
import { FacebookIcon, WhatsAppIcon } from './Icons';

export default function Footer() {
  const { whatsapp, chatUrl, city, categories, shopName } = useShop();
  return (
    <footer className="mt-20 bg-ink text-stone-300">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-400">{TAGLINE}.</p>
          <div className="mt-5 flex gap-3">
            {SOCIAL.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-600 transition hover:border-accent hover:text-accent"
              >
                {s.name === 'Facebook' ? <FacebookIcon className="h-5 w-5" /> : <span className="text-xs">{s.name[0]}</span>}
              </a>
            ))}
            {whatsapp && (
              <a
                href={chatUrl()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-600 transition hover:border-whatsapp hover:text-whatsapp"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        <FooterCol title="Shop">
          <FooterLink to="/shop">Shop All</FooterLink>
          {categories.slice(0, 6).map((c) => (
            <FooterLink key={c} to={`/shop?category=${encodeURIComponent(c)}`}>
              {c}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title="How to order">
          <li>1. Add items to your bag</li>
          <li>2. Fill in your delivery details</li>
          <li>3. Send the order on WhatsApp</li>
          <li>4. We confirm and deliver</li>
        </FooterCol>

        <FooterCol title="Contact">
          {whatsapp && (
            <li>
              <a href={chatUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                WhatsApp: +{whatsapp}
              </a>
            </li>
          )}
          <li>{city}</li>
        </FooterCol>
      </div>
      <div className="border-t border-stone-800">
        <p className="container-x py-5 text-center text-xs tracking-wider text-stone-500">
          &copy; {new Date().getFullYear()} {shopName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-white">{title}</h3>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }) {
  return (
    <li>
      <Link to={to} className="transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}

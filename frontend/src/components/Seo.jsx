import { Helmet } from 'react-helmet-async';
import { BRAND_NAME, SITE_URL, TAGLINE } from '../config';

/** Page title + Open Graph tags. */
export default function Seo({ title, description = TAGLINE, image, path = '', type = 'website' }) {
  const fullTitle = title ? `${title} | ${BRAND_NAME}` : `${BRAND_NAME} | Shop Online`;
  const url = `${SITE_URL}${path}`;
  const img = image || `${SITE_URL}/og-image.jpg`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:title" content={title || BRAND_NAME} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
  );
}

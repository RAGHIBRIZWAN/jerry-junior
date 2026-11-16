import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFound({ what = 'page' }) {
  return (
    <div className="container-x py-24 text-center">
      <Seo title="Not found" />
      <p className="font-display text-7xl text-accent">404</p>
      <h1 className="mt-4 font-display text-3xl">Sorry, this {what} doesn't exist</h1>
      <p className="mt-3 text-stone-500">It may have sold out and been removed, or the link is wrong.</p>
      <Link to="/shop" className="btn btn-dark mt-8">
        Back to shop
      </Link>
    </div>
  );
}

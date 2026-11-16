// Adds 6 SAMPLE products so you can try the site before importing from Facebook.
// Run with: npm run seed            (only if there are no products yet)
//           npm run seed -- --force (deletes ALL products and adds the samples)
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import Product from './models/Product.js';

const img = (seed, n) => Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/jj-${seed}-${i + 1}/900/1200`);

const samples = [
  { title: 'Boys Cotton Polo Shirt', price: 1450, images: img('polo', 3), sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], category: 'Boys',
    caption: 'Soft breathable cotton polo with a classic collar. Perfect for summer days and school outings.' },
  { title: 'Girls Floral Frock', price: 2200, images: img('frock', 3), sizes: ['1-2Y', '3-4Y', '5-6Y'], category: 'Girls',
    caption: 'Twirly floral frock with lace trim and a soft cotton lining.' },
  { title: 'Baby Romper Set (3 pcs)', price: 1800, images: img('romper', 2), sizes: ['0-3M', '3-6M', '6-12M'], category: 'Baby',
    caption: 'Three-piece romper set in gentle cotton. Snap buttons for easy changes.' },
  { title: 'Boys Denim Jacket', price: 2999, images: img('denim', 3), sizes: ['4-5Y', '6-7Y', '8-9Y', '10-11Y'], category: 'Boys',
    caption: 'Stonewash denim jacket with metal buttons and two chest pockets.' },
  { title: 'Girls Eid Shalwar Kameez', price: 3499, images: img('eid', 3), sizes: ['3-4Y', '5-6Y', '7-8Y'], category: 'Girls',
    caption: 'Embroidered kameez with shalwar and dupatta. A festive favourite.' },
  { title: 'Unisex Fleece Hoodie', price: 1999, images: img('hoodie', 2), sizes: ['4-5Y', '6-7Y', '8-9Y'], category: 'Unisex',
    caption: 'Warm brushed fleece hoodie with a kangaroo pocket. Back in winter!', inStock: false },
];

async function run() {
  await connectDB();
  const count = await Product.countDocuments();
  if (count > 0 && !process.argv.includes('--force')) {
    console.log(`There are already ${count} products. Nothing added. Use "npm run seed -- --force" to replace them.`);
  } else {
    if (count > 0) await Product.deleteMany({});
    for (const p of samples) await Product.create(p);
    console.log(`Added ${samples.length} sample products.`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

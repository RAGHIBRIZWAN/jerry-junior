import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    caption: { type: String, trim: true, maxlength: 4000, default: '' },
    price: { type: Number, required: true, min: 0 },
    images: { type: [String], default: [] }, // first image is the cover
    sizes: { type: [String], default: [] },
    category: { type: String, trim: true, default: '' },
    inStock: { type: Boolean, default: true },
    // Shown in the "New Arrivals" section and tagged "New" on the website
    newArrival: { type: Boolean, default: false },
    // false = hidden from the website (e.g. imported from Facebook without a price yet)
    published: { type: Boolean, default: true },
    // Where the product came from (used to avoid duplicate Facebook imports)
    sourceId: { type: String, index: { sparse: true } },
  },
  { timestamps: true }
);

productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);

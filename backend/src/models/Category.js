import mongoose from 'mongoose';

// The photo shown for a category on the home page ("Shop by Category").
// The admin sets it by hand, because it changes whenever you get new products.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true }, // lower-case name, so "Boys" and "boys" are the same
    image: { type: String, default: '' }, // Cloudinary address
  },
  { timestamps: true }
);

export default mongoose.models.Category || mongoose.model('Category', categorySchema);

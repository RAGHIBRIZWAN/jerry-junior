import mongoose from 'mongoose';

// Homepage carousel slides. Managed separately from products in the admin panel.
const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true }, // /media/<id>.webp (stored in MongoDB)
    link: { type: String, trim: true, default: '' }, // optional: /shop?new=1, /product/<id> or https://...
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bannerSchema.index({ order: 1, createdAt: 1 });

export default mongoose.models.Banner || mongoose.model('Banner', bannerSchema);

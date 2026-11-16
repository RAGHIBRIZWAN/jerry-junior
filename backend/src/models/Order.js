import mongoose from 'mongoose';

// Snapshot of the product at order time, so later edits don't change old orders.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: String,
    price: Number, // unit price, taken from the database
    size: String,
    quantity: Number,
    image: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' },
    },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
    confirmedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);

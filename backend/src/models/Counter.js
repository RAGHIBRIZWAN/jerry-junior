import mongoose from 'mongoose';

// One document per day. Used to generate ORD-YYYYMMDD-XXX atomically.
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

export default mongoose.models.Counter || mongoose.model('Counter', counterSchema);

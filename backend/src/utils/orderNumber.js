import config from '../config.js';
import Counter from '../models/Counter.js';

/** YYYYMMDD in the shop's timezone (Asia/Karachi by default). */
function datePart(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}${p.month}${p.day}`;
}

/** Returns e.g. ORD-20260101-001. Atomic, so two orders at the same moment never share a number. */
export async function generateOrderNumber() {
  const day = datePart();
  const counter = await Counter.findOneAndUpdate(
    { _id: `order-${day}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `ORD-${day}-${String(counter.seq).padStart(3, '0')}`;
}

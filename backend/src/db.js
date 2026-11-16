import mongoose from 'mongoose';
import config from './config.js';

let connecting;

/** One shared connection. Both servers run in the same process and use it. */
export function connectDB() {
  if (!connecting) {
    connecting = mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 }).then((m) => {
      console.log(`[db] connected to ${m.connection.host}/${m.connection.name}`);
      return m;
    });
  }
  return connecting;
}

export default mongoose;

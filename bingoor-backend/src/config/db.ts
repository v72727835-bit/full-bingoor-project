import mongoose from 'mongoose';
import { env } from './env';

mongoose.set('strictQuery', true);

export async function connectDB(): Promise<void> {
  // A bigger pool lets one instance serve many concurrent requests instead of queueing on 5 sockets.
  await mongoose.connect(env.MONGO_URI, { maxPoolSize: 50, minPoolSize: 5 });
  // Phone / email used to be unique across all accounts; they are now unique per role (see models/User.ts).
  for (const name of ['phone_1', 'email_1']) {
    try {
      await mongoose.connection.collection('users').dropIndex(name);
      console.log(`Dropped old users index ${name}`);
    } catch {
      /* already gone */
    }
  }
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

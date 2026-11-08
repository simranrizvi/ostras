import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';

await connectDatabase();
startScheduler();
console.info('Social Flow worker started.');
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 150_000);
  deadline.unref();
  await stopScheduler();
  await mongoose.disconnect();
  clearTimeout(deadline);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

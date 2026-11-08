import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';

await connectDatabase();
const server = app.listen(env.PORT, () =>
  console.info(`Social Flow API listening on port ${env.PORT}`),
);
server.requestTimeout = 180_000;
let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.info(`${signal} received; draining Social Flow API.`);
  const deadline = setTimeout(() => process.exit(1), 150_000);
  deadline.unref();
  server.close(async () => {
    await mongoose.disconnect();
    clearTimeout(deadline);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

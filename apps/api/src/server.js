import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';
import { startScheduler } from './services/scheduler.js';

await connectDatabase();
const server = app.listen(env.PORT, () => console.info(`Ostras API listening on port ${env.PORT}`));
startScheduler();

async function shutdown(signal) {
  console.info(`${signal} received; closing Ostras API.`);
  server.close(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

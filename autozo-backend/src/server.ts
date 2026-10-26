import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDB();
  // Note: the legacy sortCode backfill is a one-off migration, not a per-boot
  // job (it scanned every product on each restart and delayed health checks).
  // Run it with `npm run migrate:sort-code` when needed (ISSUE-09).
  const server = app.listen(env.PORT, () => {
    console.log(`Autozo API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

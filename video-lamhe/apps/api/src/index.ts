import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { connectMongo, disconnectMongo, ensureIndexes, pingMongo } from './lib/db.js';
import './models/index.js';
import { createLogger } from './lib/logger.js';
import { createMailer } from './lib/mailer.js';
import { createMediaService } from './lib/media.js';

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const logger = createLogger(env);

  try {
    await connectMongo(env, logger);
  } catch (err) {
    logger.fatal({ err }, 'Could not connect to MongoDB — is it running? (npm run db:up)');
    process.exit(1);
  }

  try {
    await ensureIndexes(logger);
  } catch (err) {
    // e.g. a unique index can't be built because duplicates already exist — fix data first.
    logger.fatal({ err }, 'Could not create MongoDB indexes');
    process.exit(1);
  }

  const app = createApp({
    env,
    logger,
    mailer: createMailer(env, logger),
    media: createMediaService(env, logger),
    checkReadiness: async () => ({
      mongo: (await pingMongo()) ? 'up' : 'down',
      redis: 'skipped', // wired in Phase 8
    }),
  });

  const server = createServer(app);
  server.requestTimeout = 20_000;
  server.headersTimeout = 21_000;
  server.keepAliveTimeout = 65_000; // > typical load balancer idle timeout

  server.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api/v1`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    const force = setTimeout(() => {
      logger.error('Forced shutdown after 10s');
      process.exit(1);
    }, 10_000);
    force.unref();

    server.close(async (err) => {
      if (err) logger.error({ err }, 'Error closing HTTP server');
      try {
        await disconnectMongo();
      } catch (e) {
        logger.error({ err: e }, 'Error closing MongoDB');
      }
      logger.info('Shutdown complete');
      process.exit(err ? 1 : 0);
    });
    server.closeIdleConnections();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) =>
    logger.error({ err: reason }, 'Unhandled rejection'),
  );
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

void main();

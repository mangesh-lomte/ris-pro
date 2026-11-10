import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    // 1. Connect to PostgreSQL via Prisma
    await connectDatabase();

    // 2. Initialize Express application
    const app = createApp();

    // 3. Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 RIS Backend API server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
      logger.info(`🔗 Base API prefix: http://localhost:${env.PORT}/api/v1`);
      logger.info(`🏥 Health check:   http://localhost:${env.PORT}/api/v1/health`);
    });

    // 4. Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown of RIS Server...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection caught:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception caught:', err);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start RIS server:', error);
    process.exit(1);
  }
}

bootstrap();


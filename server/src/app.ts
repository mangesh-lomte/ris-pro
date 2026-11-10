import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';

export function createApp(): Application {
  const app = express();

  // 1. Security Middleware
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  }));

  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // 2. Request Parsers & Logging
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // 3. Health check alias at root level as well
  app.get('/health', (_req, res) => res.redirect('/api/v1/health'));

  // 4. API v1 Router
  app.use('/api/v1', apiRoutes);

  // 5. 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}


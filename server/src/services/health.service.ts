import { prisma } from '../config/db';
import { env } from '../config/env';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  timestamp: string;
  environment: string;
  version: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    responseTimeMs?: number;
    error?: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsageMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

export async function checkSystemHealth(): Promise<HealthCheckResult> {
  const startDbCheck = Date.now();
  let dbConnected: boolean;
  let dbResponseTimeMs: number | undefined;
  let dbError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    dbResponseTimeMs = Date.now() - startDbCheck;
  } catch (err) {
    dbConnected = false;
    dbError = err instanceof Error ? err.message : 'Database ping failed';
  }

  const memory = process.memoryUsage();

  return {
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbConnected,
      ...(dbResponseTimeMs !== undefined ? { responseTimeMs: dbResponseTimeMs } : {}),
      ...(dbError ? { error: dbError } : {}),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMb: {
        rss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      },
    },
  };
}


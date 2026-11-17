import { execSync } from 'child_process';
import { prisma } from '../config/db';
import { env } from '../config/env';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  timestamp: string;
  environment: string;
  appEnv: string;
  commit: string;
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

let cachedCommit: string | null = null;

function getCommitHash(): string {
  if (cachedCommit) return cachedCommit;
  if (process.env.GIT_COMMIT) {
    cachedCommit = process.env.GIT_COMMIT;
    return cachedCommit;
  }
  try {
    cachedCommit = execSync('git rev-parse --short HEAD', { timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return cachedCommit;
  } catch {
    cachedCommit = 'b1daffe';
    return cachedCommit;
  }
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
    appEnv: process.env.APP_ENV || 'demo',
    commit: getCommitHash(),
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


import { prisma } from '../config/db';
import { logger } from '../utils/logger';

export interface AuditEventParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ? (params.details as object) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Non-blocking: audit log failure should not crash primary clinical operations
    logger.error('Failed to write audit log entry:', error);
  }
}


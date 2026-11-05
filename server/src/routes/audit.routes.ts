import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/db';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Audit log view requires ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// GET /api/v1/audit-logs - List audit trail logs
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return sendSuccess(res, logs, 'System audit logs retrieved');
  })
);

export default router;

import { Router } from 'express';
import { prisma } from '../config/db';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { getTatDashboardMetricsHandler } from '../controllers/reportDelivery.controller';

const router = Router();

router.use(authenticate);

// ==========================================
// Phase 4.11 — TAT Dashboard
// ==========================================

// GET /api/v1/reports/tat - Turnaround Time metrics from order to final delivery
router.get(
  '/tat',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  asyncHandler(getTatDashboardMetricsHandler)
);

// GET /api/v1/reports - List diagnostic reports
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        order: {
          select: {
            accessionNumber: true,
            modality: true,
            bodyPart: true,
            patient: {
              select: {
                patientId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return sendSuccess(res, reports, 'Diagnostic reports retrieved');
  })
);

export default router;

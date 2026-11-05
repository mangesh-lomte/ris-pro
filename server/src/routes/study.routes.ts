import { Router } from 'express';
import { prisma } from '../config/db';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// GET /api/v1/studies - List studies
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const studies = await prisma.study.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            accessionNumber: true,
            bodyPart: true,
            clinicalIndication: true,
          },
        },
      },
    });

    return sendSuccess(res, studies, 'Studies retrieved');
  })
);

export default router;

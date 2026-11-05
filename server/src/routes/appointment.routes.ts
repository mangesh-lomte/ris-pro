import { Router } from 'express';
import { prisma } from '../config/db';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// GET /api/v1/appointments - List appointments
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const appointments = await prisma.appointment.findMany({
      take: 20,
      orderBy: { scheduledStartTime: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
        imagingOrder: {
          select: {
            id: true,
            accessionNumber: true,
            orderStatus: true,
          },
        },
      },
    });

    return sendSuccess(res, appointments, 'Appointments retrieved');
  })
);

export default router;

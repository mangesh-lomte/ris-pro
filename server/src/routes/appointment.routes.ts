import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getAppointments,
  getAppointment,
  create,
  reschedule,
  cancel,
  noShow,
  checkIn,
  allocateStaff,
  getPrepCheck,
  getSchedulingStaff,
  appointmentQuerySchema,
  createAppointmentSchema,
  rescheduleSchema,
  cancelSchema,
  noShowSchema,
  checkInSchema,
  allocateStaffMachineSchema,
} from '../controllers/appointment.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// GET /api/v1/appointments - List appointments with filters
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  validateRequest({ query: appointmentQuerySchema }),
  asyncHandler(getAppointments)
);

// POST /api/v1/appointments - Book new appointment with conflict detection
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: createAppointmentSchema }),
  asyncHandler(create)
);

// GET /api/v1/appointments/prep-check - Patient preparation check & reminders at booking time
router.get(
  '/prep-check',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getPrepCheck)
);

// GET /api/v1/appointments/scheduling-staff - Available staff for scheduling/allocation
router.get(
  '/scheduling-staff',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getSchedulingStaff)
);

// GET /api/v1/appointments/:id - View appointment details
router.get(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getAppointment)
);

// POST /api/v1/appointments/:id/reschedule - Reschedule appointment with conflict re-check
router.post(
  '/:id/reschedule',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: rescheduleSchema }),
  asyncHandler(reschedule)
);

// POST /api/v1/appointments/:id/cancel - Cancel appointment and release machine slot
router.post(
  '/:id/cancel',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: cancelSchema }),
  asyncHandler(cancel)
);

// POST /api/v1/appointments/:id/no-show - Mark appointment as no-show
router.post(
  '/:id/no-show',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: noShowSchema }),
  asyncHandler(noShow)
);

// POST /api/v1/appointments/:id/check-in - Perform reception check-in with identity verification
router.post(
  '/:id/check-in',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: checkInSchema }),
  asyncHandler(checkIn)
);

// PATCH /api/v1/appointments/:id/allocation - Allocate staff (radiographer, nurse) and machine
router.patch(
  '/:id/allocation',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  validateRequest({ body: allocateStaffMachineSchema }),
  asyncHandler(allocateStaff)
);

export default router;

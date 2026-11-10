import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listEquipmentHandler,
  getEquipmentByIdHandler,
  createEquipmentHandler,
  updateEquipmentHandler,
  listPmSchedulesHandler,
  createPmScheduleHandler,
  completePmScheduleHandler,
  recordQcCheckHandler,
  listQcChecksHandler,
  listPmTemplatesHandler,
  createServiceTicketHandler,
  updateServiceTicketStatusHandler,
  listServiceTicketsHandler,
  recordDowntimeStartHandler,
  recordDowntimeEndHandler,
  listDowntimeLogsHandler,
  consumeMaintenancePartHandler,
  listMaintenancePartUsagesHandler,
  getServiceHistoryHandler,
  createServiceRecordHandler,
  recordCalibrationCertificateHandler,
  listCalibrationCertificatesHandler,
  recordMaintenanceContractHandler,
  listMaintenanceContractsHandler,
  createServiceContactHandler,
  listServiceContactsHandler,
  setEquipmentAvailabilityHandler,
  getEquipmentAvailabilitySummaryHandler,
  getMaintenanceRemindersHandler,
  getEquipmentPerformanceAnalyticsHandler,
} from '../controllers/maintenance.controller';

const router = Router();

router.use(authenticate);

// 1. Equipment Asset Register
router.get(
  '/equipment',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  asyncHandler(listEquipmentHandler)
);

router.get(
  '/equipment/:id',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  asyncHandler(getEquipmentByIdHandler)
);

router.post(
  '/equipment',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(createEquipmentHandler)
);

router.put(
  '/equipment/:id',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(updateEquipmentHandler)
);

// 2. PM Schedule Calendar
router.get(
  '/pm-schedules',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(listPmSchedulesHandler)
);

router.post(
  '/pm-schedules',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(createPmScheduleHandler)
);

router.post(
  '/pm-schedules/:id/complete',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(completePmScheduleHandler)
);

// 3. Daily / Weekly QC Checklist
router.get(
  '/qc-checks',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(listQcChecksHandler)
);

router.post(
  '/qc-checks',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(recordQcCheckHandler)
);

// 4. PM Checklist by Modality (Templates)
router.get(
  '/pm-templates',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(listPmTemplatesHandler)
);

// 5. Service Ticket / Breakdown
router.get(
  '/service-tickets',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(listServiceTicketsHandler)
);

router.post(
  '/service-tickets',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(createServiceTicketHandler)
);

router.patch(
  '/service-tickets/:id/status',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(updateServiceTicketStatusHandler)
);

// 6. Machine Downtime Log
router.get(
  '/downtimes',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(listDowntimeLogsHandler)
);

router.post(
  '/downtimes/start',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(recordDowntimeStartHandler)
);

router.post(
  '/downtimes/:id/end',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(recordDowntimeEndHandler)
);

// 7. Parts and Spare Stock
router.get(
  '/parts/usage',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(listMaintenancePartUsagesHandler)
);

router.post(
  '/parts/consume',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(consumeMaintenancePartHandler)
);

// 8. Service History
router.get(
  '/equipment/:id/service-history',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(getServiceHistoryHandler)
);

router.post(
  '/service-records',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(createServiceRecordHandler)
);

// 9. Calibration / Test Certificates
router.get(
  '/calibration-certificates',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(listCalibrationCertificatesHandler)
);

router.post(
  '/calibration-certificates',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(recordCalibrationCertificateHandler)
);

// 10. AMC / Warranty Tracker
router.get(
  '/contracts',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(listMaintenanceContractsHandler)
);

router.post(
  '/contracts',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(recordMaintenanceContractHandler)
);

// 11. Engineer / Supplier Contacts
router.get(
  '/contacts',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(listServiceContactsHandler)
);

router.post(
  '/contacts',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(createServiceContactHandler)
);

// 12. Machine Availability Status
router.get(
  '/availability/summary',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  asyncHandler(getEquipmentAvailabilitySummaryHandler)
);

router.patch(
  '/equipment/:id/availability',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(setEquipmentAvailabilityHandler)
);

// 13. Maintenance Reminders
router.get(
  '/reminders',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER, UserRole.TECHNOLOGIST),
  asyncHandler(getMaintenanceRemindersHandler)
);

// 14. Equipment Performance Analytics
router.get(
  '/analytics',
  requireRole(UserRole.ADMIN, UserRole.ENGINEER),
  asyncHandler(getEquipmentPerformanceAnalyticsHandler)
);

export default router;


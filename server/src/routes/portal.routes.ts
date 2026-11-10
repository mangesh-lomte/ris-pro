import { Router } from 'express';
import {
  patientLoginHandler,
  getPatientReportsHandler,
  getPatientReportPdfHandler,
  referringDoctorLoginHandler,
  getReferringDoctorReportsHandler,
  getReferringDoctorReportPdfHandler,
} from '../controllers/reportDelivery.controller';
import {
  requestPatientOtpHandler,
  verifyPatientOtpHandler,
  getPortalExaminationsHandler,
  getPortalSlotsHandler,
  bookPortalAppointmentHandler,
  uploadPortalReferralHandler,
  getPortalReferralFileHandler,
  getPortalInstructionsHandler,
  submitPortalQuestionnaireHandler,
  payPortalAdvanceDepositHandler,
  reschedulePortalAppointmentHandler,
  cancelPortalAppointmentHandler,
  sendPortalReminderHandler,
  getPatientPortalAppointmentsHandler,
  getPatientReportViewerHandler,
} from '../controllers/patientPortalBooking.controller';
import {
  authenticatePatient,
  authenticateReferringDoctor,
} from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// ==========================================
// Module 02 — Online Patient Appointment Portal Routes
// ==========================================

// 1. Mobile OTP Authentication
router.post('/patient/request-otp', asyncHandler(requestPatientOtpHandler));
router.post('/patient/verify-otp', asyncHandler(verifyPatientOtpHandler));

// 2. Select Examination & Slots
router.get('/patient/examinations', asyncHandler(getPortalExaminationsHandler));
router.get('/patient/slots', asyncHandler(getPortalSlotsHandler));

// 3. Appointments Management
router.get('/patient/appointments', authenticatePatient, asyncHandler(getPatientPortalAppointmentsHandler));
router.post('/patient/book', authenticatePatient, asyncHandler(bookPortalAppointmentHandler));

// 4. Appointment Actions
router.post('/patient/appointments/:id/referral', authenticatePatient, asyncHandler(uploadPortalReferralHandler));
router.get('/patient/appointments/:id/referral-file', authenticatePatient, asyncHandler(getPortalReferralFileHandler));
router.get('/patient/appointments/:id/instructions', authenticatePatient, asyncHandler(getPortalInstructionsHandler));
router.post('/patient/appointments/:id/questionnaire', authenticatePatient, asyncHandler(submitPortalQuestionnaireHandler));
router.post('/patient/appointments/:id/deposit', authenticatePatient, asyncHandler(payPortalAdvanceDepositHandler));
router.post('/patient/appointments/:id/reschedule', authenticatePatient, asyncHandler(reschedulePortalAppointmentHandler));
router.post('/patient/appointments/:id/cancel', authenticatePatient, asyncHandler(cancelPortalAppointmentHandler));
router.post('/patient/appointments/:id/remind', authenticatePatient, asyncHandler(sendPortalReminderHandler));

// ==========================================
// Phase 4.11 — Patient Portal Routes (Reports & PDF & Viewer)
// ==========================================

// POST /api/v1/portal/patient/login
router.post('/patient/login', asyncHandler(patientLoginHandler));

// GET /api/v1/portal/patient/reports
router.get('/patient/reports', authenticatePatient, asyncHandler(getPatientReportsHandler));

// GET /api/v1/portal/patient/reports/:accessionNumber/pdf
router.get(
  '/patient/reports/:accessionNumber/pdf',
  authenticatePatient,
  asyncHandler(getPatientReportPdfHandler)
);

// GET /api/v1/portal/patient/reports/:accessionNumber/viewer
router.get(
  '/patient/reports/:accessionNumber/viewer',
  authenticatePatient,
  asyncHandler(getPatientReportViewerHandler)
);

// ==========================================
// Phase 4.11 — Referring Doctor Portal Routes
// ==========================================

// POST /api/v1/portal/referring-doctor/login and /portal/doctor/login
router.post('/referring-doctor/login', asyncHandler(referringDoctorLoginHandler));
router.post('/doctor/login', asyncHandler(referringDoctorLoginHandler));

// GET /api/v1/portal/referring-doctor/reports and /portal/doctor/reports
router.get(
  '/referring-doctor/reports',
  authenticateReferringDoctor,
  asyncHandler(getReferringDoctorReportsHandler)
);
router.get(
  '/doctor/reports',
  authenticateReferringDoctor,
  asyncHandler(getReferringDoctorReportsHandler)
);

// GET /api/v1/portal/referring-doctor/reports/:accessionNumber/pdf and /portal/doctor/reports/:accessionNumber/pdf
router.get(
  '/referring-doctor/reports/:accessionNumber/pdf',
  authenticateReferringDoctor,
  asyncHandler(getReferringDoctorReportPdfHandler)
);
router.get(
  '/doctor/reports/:accessionNumber/pdf',
  authenticateReferringDoctor,
  asyncHandler(getReferringDoctorReportPdfHandler)
);

export default router;

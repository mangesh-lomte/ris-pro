import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import orderRoutes from './order.routes';
import appointmentRoutes from './appointment.routes';
import studyRoutes from './study.routes';
import reportRoutes from './report.routes';
import auditRoutes from './audit.routes';

const router = Router();

// /api/v1 routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/orders', orderRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/studies', studyRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);

export default router;

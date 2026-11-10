import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import orderRoutes from './order.routes';
import appointmentRoutes from './appointment.routes';
import schedulingRoutes from './scheduling.routes';
import receptionRoutes from './reception.routes';
import technologistRoutes from './technologist.routes';
import radiologistRoutes from './radiologist.routes';
import clinicalMasterRoutes from './clinicalMaster.routes';
import studyRoutes from './study.routes';
import reportRoutes from './report.routes';
import auditRoutes from './audit.routes';
import integrationRoutes from './integration.routes';
import pacsManagementRoutes from './pacsManagement.routes';
import billingRoutes from './billing.routes';
import inventoryRoutes from './inventory.routes';
import maintenanceRoutes from './maintenance.routes';
import externalShareRoutes from './externalShare.routes';
import portalRoutes from './portal.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';

const router = Router();

// /api/v1 routes
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/portal', portalRoutes);
router.use('/patients', patientRoutes);
router.use('/orders', orderRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/scheduling', schedulingRoutes);
router.use('/reception', receptionRoutes);
router.use('/technologist', technologistRoutes);
router.use('/radiologist', radiologistRoutes);
router.use('/integrations', integrationRoutes);
router.use('/pacs', pacsManagementRoutes);
router.use('/billing', billingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/external-shares', externalShareRoutes);
router.use('/masters', clinicalMasterRoutes);
router.use('/', clinicalMasterRoutes); // Mounts /referring-doctors, /exam-definitions, /equipment directly under /api/v1
router.use('/studies', studyRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);

export default router;

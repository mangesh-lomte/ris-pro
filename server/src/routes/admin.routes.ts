import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminController from '../controllers/admin.controller';

const router = Router();

// Module 14 Administration routes strictly require authenticated ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

// 1. User & Role Management (PDF Req 1)
router.get('/users', asyncHandler(adminController.listUsersHandler));
router.post('/users', asyncHandler(adminController.createUserHandler));
router.patch('/users/:id', asyncHandler(adminController.updateUserHandler));

// 2. Audit Trail (PDF Req 2)
router.get('/audit-logs', asyncHandler(adminController.getAuditLogsHandler));

// 3. Patient Merge & Correction Control (PDF Req 3)
router.post('/patients/merge', asyncHandler(adminController.mergePatientsHandler));
router.get('/patients/merge-history', asyncHandler(adminController.getMergeHistoryHandler));

// 4. Data Privacy & Security (PDF Req 4)
router.get('/security/overview', asyncHandler(adminController.getSecurityOverviewHandler));

// 5. Consent & Retention Rules (PDF Req 5)
router.get('/retention/rules', asyncHandler(adminController.getRetentionRulesHandler));
router.post('/retention/rules', asyncHandler(adminController.createRetentionRuleHandler));
router.patch('/retention/rules/:id', asyncHandler(adminController.updateRetentionRuleHandler));
router.get('/retention/audit-summary', asyncHandler(adminController.getRetentionAuditSummaryHandler));
router.get('/consent/summary', asyncHandler(adminController.getConsentSummaryHandler));

// 6. Service / Report Master (PDF Req 6)
router.get('/exam-catalog', asyncHandler(adminController.listExamCatalogHandler));
router.post('/exam-catalog', asyncHandler(adminController.createExamCatalogEntryHandler));
router.patch('/exam-catalog/:id', asyncHandler(adminController.updateExamCatalogEntryHandler));
router.get('/reporting-templates', asyncHandler(adminController.listReportingTemplatesHandler));
router.post('/reporting-templates', asyncHandler(adminController.createReportingTemplateHandler));
router.patch('/reporting-templates/:id', asyncHandler(adminController.updateReportingTemplateHandler));

// 7. Operational KPI Reports (PDF Req 7)
router.get('/reports/operational-kpi', asyncHandler(adminController.getOperationalKpiReportHandler));

// 8. Quality / Incident Reports (PDF Req 8)
router.get('/reports/quality-incidents', asyncHandler(adminController.getQualityIncidentReportHandler));

// 9. Integration Health Dashboard (PDF Req 9)
router.get('/integration-health', asyncHandler(adminController.getIntegrationHealthHandler));

// 10. Backup & Disaster Recovery Checks (PDF Req 10)
router.get('/backups', asyncHandler(adminController.listBackupsHandler));
router.post('/backups/trigger', asyncHandler(adminController.triggerDatabaseBackupHandler));
router.get('/dr-drills', asyncHandler(adminController.listDrillsHandler));
router.post('/dr-drills', asyncHandler(adminController.recordDrillHandler));

export default router;


import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import * as adminService from '../services/admin.service';
import { UserRole, ModalityType } from '@prisma/client';

function getActor(req: Request) {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }
  return {
    id: req.user.id,
    name: `${req.user.firstName} ${req.user.lastName}`,
    role: req.user.role,
  };
}

// ----------------------------------------------------------------------------
// 1. USER MANAGEMENT CONTROLLERS
// ----------------------------------------------------------------------------

export async function listUsersHandler(req: Request, res: Response) {
  const role = req.query.role as UserRole | undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const result = await adminService.listUsers({ role, search, isActive, page, limit });
  return sendSuccess(res, result, 'Staff users retrieved successfully');
}

export async function createUserHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const user = await adminService.createUser(req.body, actor.id);
  return sendSuccess(res, user, 'Staff user created successfully', 201);
}

export async function updateUserHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const user = await adminService.updateUser(req.params.id, req.body, actor.id);
  return sendSuccess(res, user, 'Staff user updated successfully');
}

// ----------------------------------------------------------------------------
// 2. AUDIT TRAIL CONTROLLERS
// ----------------------------------------------------------------------------

export async function getAuditLogsHandler(req: Request, res: Response) {
  const actorId = req.query.actorId as string | undefined;
  const action = req.query.action as string | undefined;
  const entityType = req.query.entityType as string | undefined;
  const entityId = req.query.entityId as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const search = req.query.search as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const result = await adminService.getAuditLogs({
    actorId,
    action,
    entityType,
    entityId,
    startDate,
    endDate,
    search,
    page,
    limit,
  });

  return sendSuccess(res, result, 'System audit trail retrieved successfully');
}

// ----------------------------------------------------------------------------
// 3. PATIENT MERGE CONTROLLERS
// ----------------------------------------------------------------------------

export async function mergePatientsHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const { sourceMrn, targetMrn, reason } = req.body;

  if (!sourceMrn || !targetMrn || !reason) {
    throw AppError.badRequest('sourceMrn, targetMrn, and reason are required.');
  }

  const result = await adminService.mergePatients(
    { sourceMrn, targetMrn, reason },
    actor.id,
    actor.name
  );

  return sendSuccess(res, result, 'Patients merged successfully with complete relational history preservation', 200);
}

export async function getMergeHistoryHandler(_req: Request, res: Response) {
  const history = await adminService.getMergeHistory();
  return sendSuccess(res, history, 'Patient merge history retrieved');
}

// ----------------------------------------------------------------------------
// 4. DATA PRIVACY & SECURITY CONTROLLERS
// ----------------------------------------------------------------------------

export async function getSecurityOverviewHandler(_req: Request, res: Response) {
  const overview = await adminService.getSecurityOverview();
  return sendSuccess(res, overview, 'Security overview and posture retrieved');
}

// ----------------------------------------------------------------------------
// 5. CONSENT & RETENTION RULES CONTROLLERS
// ----------------------------------------------------------------------------

export async function getRetentionRulesHandler(_req: Request, res: Response) {
  const rules = await adminService.getRetentionRules();
  return sendSuccess(res, rules, 'Data retention rules retrieved');
}

export async function createRetentionRuleHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const rule = await adminService.createRetentionRule(req.body, actor.id);
  return sendSuccess(res, rule, 'Retention rule created', 201);
}

export async function updateRetentionRuleHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const rule = await adminService.updateRetentionRule(req.params.id, req.body, actor.id);
  return sendSuccess(res, rule, 'Retention rule updated');
}

export async function getRetentionAuditSummaryHandler(_req: Request, res: Response) {
  const summary = await adminService.getRetentionAuditSummary();
  return sendSuccess(res, summary, 'Retention audit summary evaluated');
}

export async function getConsentSummaryHandler(_req: Request, res: Response) {
  const summary = await adminService.getConsentSummary();
  return sendSuccess(res, summary, 'Consent summary retrieved');
}

// ----------------------------------------------------------------------------
// 6. SERVICE / REPORT MASTER CONTROLLERS
// ----------------------------------------------------------------------------

export async function listExamCatalogHandler(_req: Request, res: Response) {
  const catalog = await adminService.listExamCatalog();
  return sendSuccess(res, catalog, 'Exam catalog retrieved');
}

export async function createExamCatalogEntryHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const entry = await adminService.createExamCatalogEntry(req.body, actor.id);
  return sendSuccess(res, entry, 'Exam catalog entry created', 201);
}

export async function updateExamCatalogEntryHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const entry = await adminService.updateExamCatalogEntry(req.params.id, req.body, actor.id);
  return sendSuccess(res, entry, 'Exam catalog entry updated');
}

export async function listReportingTemplatesHandler(_req: Request, res: Response) {
  const templates = await adminService.listReportingTemplates();
  return sendSuccess(res, templates, 'Reporting templates retrieved');
}

export async function createReportingTemplateHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const template = await adminService.createReportingTemplate(req.body, actor.id);
  return sendSuccess(res, template, 'Reporting template created', 201);
}

export async function updateReportingTemplateHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const template = await adminService.updateReportingTemplate(req.params.id, req.body, actor.id);
  return sendSuccess(res, template, 'Reporting template updated');
}

// ----------------------------------------------------------------------------
// 7. OPERATIONAL KPI CONTROLLER
// ----------------------------------------------------------------------------

export async function getOperationalKpiReportHandler(req: Request, res: Response) {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const modality = req.query.modality as ModalityType | undefined;

  const report = await adminService.getOperationalKpiReport({ startDate, endDate, modality });
  return sendSuccess(res, report, 'Operational KPI report generated');
}

// ----------------------------------------------------------------------------
// 8. QUALITY / INCIDENT CONTROLLER
// ----------------------------------------------------------------------------

export async function getQualityIncidentReportHandler(req: Request, res: Response) {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const report = await adminService.getQualityIncidentReport({ startDate, endDate });
  return sendSuccess(res, report, 'Quality and incident report generated');
}

// ----------------------------------------------------------------------------
// 9. INTEGRATION HEALTH CONTROLLER
// ----------------------------------------------------------------------------

export async function getIntegrationHealthHandler(_req: Request, res: Response) {
  const health = await adminService.getIntegrationHealth();
  return sendSuccess(res, health, 'Integration health status retrieved');
}

// ----------------------------------------------------------------------------
// 10. BACKUP & DISASTER RECOVERY CONTROLLER
// ----------------------------------------------------------------------------

export async function listBackupsHandler(_req: Request, res: Response) {
  const backups = await adminService.listBackups();
  // Transform BigInt sizeBytes for JSON serialization
  const transformed = backups.map(b => ({
    ...b,
    sizeBytes: b.sizeBytes !== null ? Number(b.sizeBytes) : null,
  }));
  return sendSuccess(res, transformed, 'Backup records retrieved');
}

export async function triggerDatabaseBackupHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const backup = await adminService.triggerDatabaseBackup(actor.id, actor.name);
  return sendSuccess(res, {
    ...backup,
    sizeBytes: backup && 'sizeBytes' in backup && backup.sizeBytes !== null ? Number(backup.sizeBytes) : null,
  }, 'Database backup executed and verified', 201);
}

export async function listDrillsHandler(_req: Request, res: Response) {
  const drills = await adminService.listDrills();
  return sendSuccess(res, drills, 'Disaster recovery simulation drills retrieved');
}

export async function recordDrillHandler(req: Request, res: Response) {
  const actor = getActor(req);
  const drill = await adminService.recordDrill(req.body, actor.id, actor.name);
  return sendSuccess(res, drill, 'Disaster recovery drill recorded', 201);
}


import { Request, Response } from 'express';
import {
  listEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  listPmSchedules,
  createPmSchedule,
  completePmSchedule,
  recordQcCheck,
  listQcChecks,
  listPmTemplates,
  createServiceTicket,
  updateServiceTicketStatus,
  listServiceTickets,
  recordDowntimeStart,
  recordDowntimeEnd,
  listDowntimeLogs,
  consumeMaintenancePart,
  listMaintenancePartUsages,
  getEquipmentServiceHistory,
  createServiceRecord,
  recordCalibrationCertificate,
  listCalibrationCertificates,
  recordMaintenanceContract,
  listMaintenanceContracts,
  createServiceContact,
  listServiceContacts,
  setEquipmentAvailabilityStatus,
  getEquipmentAvailabilitySummary,
  getMaintenanceReminders,
  getEquipmentPerformanceAnalytics,
} from '../services/maintenance.service';
import { sendSuccess } from '../utils/apiResponse';

function getContext(req: Request) {
  return {
    userId: req.user?.id,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// 1. Equipment Asset Register
export async function listEquipmentHandler(req: Request, res: Response) {
  const { modality, assetCategory, status, search, activeOnly } = req.query;
  const equipment = await listEquipment({
    modality: modality ? String(modality) : undefined,
    assetCategory: assetCategory ? String(assetCategory) : undefined,
    status: status ? String(status) : undefined,
    search: search ? String(search) : undefined,
    activeOnly: activeOnly !== 'false',
  });
  return sendSuccess(res, equipment, 'Equipment assets retrieved');
}

export async function getEquipmentByIdHandler(req: Request, res: Response) {
  const equipment = await getEquipmentById(req.params.id);
  return sendSuccess(res, equipment, 'Equipment asset details retrieved');
}

export async function createEquipmentHandler(req: Request, res: Response) {
  const created = await createEquipment(req.body, getContext(req));
  return sendSuccess(res, created, 'Equipment asset created successfully', 201);
}

export async function updateEquipmentHandler(req: Request, res: Response) {
  const updated = await updateEquipment(req.params.id, req.body, getContext(req));
  return sendSuccess(res, updated, 'Equipment asset updated successfully');
}

// 2. PM Schedule Calendar
export async function listPmSchedulesHandler(req: Request, res: Response) {
  const { equipmentId, status, startDate, endDate } = req.query;
  const schedules = await listPmSchedules({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    status: status ? String(status) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });
  return sendSuccess(res, schedules, 'PM schedules retrieved');
}

export async function createPmScheduleHandler(req: Request, res: Response) {
  const schedule = await createPmSchedule(req.body, getContext(req));
  return sendSuccess(res, schedule, 'PM schedule created successfully', 201);
}

export async function completePmScheduleHandler(req: Request, res: Response) {
  const completed = await completePmSchedule(
    req.params.id,
    {
      ...req.body,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, completed, 'PM schedule marked completed');
}

// 3. Daily / Weekly QC Checklist
export async function recordQcCheckHandler(req: Request, res: Response) {
  const check = await recordQcCheck(
    {
      ...req.body,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
      performedByRole: req.user?.role,
    },
    getContext(req)
  );
  return sendSuccess(res, check, 'QC check recorded successfully', 201);
}

export async function listQcChecksHandler(req: Request, res: Response) {
  const { equipmentId, frequency } = req.query;
  const checks = await listQcChecks(
    equipmentId ? String(equipmentId) : undefined,
    frequency ? String(frequency) : undefined
  );
  return sendSuccess(res, checks, 'QC checks retrieved');
}

// 4. PM Checklist by Modality
export async function listPmTemplatesHandler(req: Request, res: Response) {
  const { modality } = req.query;
  const templates = await listPmTemplates(modality ? String(modality) : undefined);
  return sendSuccess(res, templates, 'PM checklist templates retrieved');
}

// 5. Service Ticket / Breakdown
export async function createServiceTicketHandler(req: Request, res: Response) {
  const ticket = await createServiceTicket(
    {
      ...req.body,
      reportedById: req.user!.id,
      reportedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, ticket, 'Service ticket registered successfully', 201);
}

export async function updateServiceTicketStatusHandler(req: Request, res: Response) {
  const updated = await updateServiceTicketStatus(
    req.params.id,
    {
      ...req.body,
      resolvedById: req.user?.id,
      resolvedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, updated, 'Service ticket status updated');
}

export async function listServiceTicketsHandler(req: Request, res: Response) {
  const { equipmentId, status, priority } = req.query;
  const tickets = await listServiceTickets({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    status: status ? String(status) : undefined,
    priority: priority ? String(priority) : undefined,
  });
  return sendSuccess(res, tickets, 'Service tickets retrieved');
}

// 6. Machine Downtime Log
export async function recordDowntimeStartHandler(req: Request, res: Response) {
  const downtime = await recordDowntimeStart(
    {
      equipmentId: req.body.equipmentId,
      serviceTicketId: req.body.serviceTicketId,
      causeCategory: req.body.causeCategory || req.body.reason,
      cause: req.body.cause || req.body.notes || req.body.reason || 'Equipment breakdown',
      impactLevel: req.body.impactLevel,
      recordedById: req.user!.id,
      recordedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, downtime, 'Machine downtime recorded and status updated', 201);
}

export async function recordDowntimeEndHandler(req: Request, res: Response) {
  const ended = await recordDowntimeEnd(
    req.params.id,
    {
      resolutionSummary: req.body.resolutionSummary || req.body.resolutionNotes,
      recordedById: req.user?.id,
      recordedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, ended, 'Downtime ended and machine restored to service');
}

export async function listDowntimeLogsHandler(req: Request, res: Response) {
  const { equipmentId, startDate, endDate } = req.query;
  const logs = await listDowntimeLogs({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });
  return sendSuccess(res, logs, 'Downtime logs retrieved');
}

// 7. Parts and Spare Stock
export async function consumeMaintenancePartHandler(req: Request, res: Response) {
  const usage = await consumeMaintenancePart(
    {
      equipmentId: req.body.equipmentId,
      serviceTicketId: req.body.serviceTicketId,
      pmScheduleId: req.body.pmScheduleId,
      inventoryItemId: req.body.inventoryItemId || req.body.itemId,
      batchId: req.body.batchId,
      location: req.body.location,
      quantityUsed: Number(req.body.quantityUsed ?? req.body.quantity ?? 1),
      reason: req.body.reason || req.body.notes || 'Maintenance part replacement',
      installedById: req.user!.id,
      installedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, usage, 'Maintenance spare part consumed and stock deducted', 201);
}

export async function listMaintenancePartUsagesHandler(req: Request, res: Response) {
  const { equipmentId, serviceTicketId } = req.query;
  const parts = await listMaintenancePartUsages(
    equipmentId ? String(equipmentId) : undefined,
    serviceTicketId ? String(serviceTicketId) : undefined
  );
  return sendSuccess(res, parts, 'Maintenance parts consumption records retrieved');
}

// 8. Service History
export async function getServiceHistoryHandler(req: Request, res: Response) {
  const history = await getEquipmentServiceHistory(req.params.id);
  return sendSuccess(res, history, 'Equipment service history retrieved');
}

export async function createServiceRecordHandler(req: Request, res: Response) {
  const record = await createServiceRecord(req.body, getContext(req));
  return sendSuccess(res, record, 'Service report recorded successfully', 201);
}

// 9. Calibration / Test Certificates
export async function recordCalibrationCertificateHandler(req: Request, res: Response) {
  const cert = await recordCalibrationCertificate(
    {
      equipmentId: req.body.equipmentId,
      certificateNumber: req.body.certificateNumber,
      certificationType: req.body.certificationType || req.body.certificateType || 'RADIATION_SAFETY_AERB',
      issuingAuthority: req.body.issuingAuthority || 'Atomic Energy Regulatory Board (AERB)',
      issueDate: req.body.issueDate || req.body.issuedDate || new Date().toISOString(),
      expiryDate: req.body.expiryDate || req.body.validUntil || new Date(Date.now() + 365 * 86400000).toISOString(),
      documentReference: req.body.documentReference,
      measuredValues: req.body.measuredValues || {
        kvAccuracyPercent: req.body.kvAccuracyPercent,
        timerAccuracyPercent: req.body.timerAccuracyPercent,
        outputConsistencyCv: req.body.outputConsistencyCv,
      },
      passed: req.body.passed ?? req.body.radiationSafetyPassed ?? true,
      certifiedByName: req.body.certifiedByName || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Biomedical Physicist'),
      remarks: req.body.remarks || req.body.notes,
    },
    getContext(req)
  );
  return sendSuccess(res, cert, 'Calibration certificate recorded successfully', 201);
}

export async function listCalibrationCertificatesHandler(req: Request, res: Response) {
  const { equipmentId, status } = req.query;
  const certs = await listCalibrationCertificates({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    status: status ? String(status) : undefined,
  });
  return sendSuccess(res, certs, 'Calibration certificates retrieved');
}

// 10. AMC / Warranty Tracker
export async function recordMaintenanceContractHandler(req: Request, res: Response) {
  const contract = await recordMaintenanceContract(
    {
      equipmentId: req.body.equipmentId,
      contractNumber: req.body.contractNumber,
      contractType: req.body.contractType,
      vendorName: req.body.vendorName,
      vendorContact: req.body.vendorContact,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      coverageDetails: req.body.coverageDetails || 'Standard Comprehensive Maintenance Contract',
      annualCost: req.body.annualCost !== undefined ? Number(req.body.annualCost) : req.body.cost !== undefined ? Number(req.body.cost) : undefined,
      responseSlaHours: req.body.responseSlaHours ?? req.body.responseTimeHours,
      contactPerson: req.body.contactPerson,
      escalationContact: req.body.escalationContact,
    },
    getContext(req)
  );
  return sendSuccess(res, contract, 'Maintenance contract recorded successfully', 201);
}

export async function listMaintenanceContractsHandler(req: Request, res: Response) {
  const { equipmentId, status } = req.query;
  const contracts = await listMaintenanceContracts({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    status: status ? String(status) : undefined,
  });
  return sendSuccess(res, contracts, 'Maintenance contracts retrieved');
}

// 11. Engineer / Supplier Contacts
export async function createServiceContactHandler(req: Request, res: Response) {
  const contact = await createServiceContact(req.body, getContext(req));
  return sendSuccess(res, contact, 'Service contact created successfully', 201);
}

export async function listServiceContactsHandler(req: Request, res: Response) {
  const { vendorName, role } = req.query;
  const contacts = await listServiceContacts({
    vendorName: vendorName ? String(vendorName) : undefined,
    role: role ? String(role) : undefined,
  });
  return sendSuccess(res, contacts, 'Service contacts retrieved');
}

// 12. Machine Availability Status
export async function setEquipmentAvailabilityHandler(req: Request, res: Response) {
  const result = await setEquipmentAvailabilityStatus(
    req.params.id,
    {
      status: req.body.status,
      reason: req.body.reason,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, result, 'Equipment availability status updated');
}

export async function getEquipmentAvailabilitySummaryHandler(_req: Request, res: Response) {
  const summary = await getEquipmentAvailabilitySummary();
  return sendSuccess(res, summary, 'Equipment availability summary retrieved');
}

// 13. Maintenance Reminders
export async function getMaintenanceRemindersHandler(req: Request, res: Response) {
  const days = req.query.days ? parseInt(String(req.query.days), 10) : 14;
  const reminders = await getMaintenanceReminders(days);
  return sendSuccess(res, reminders, 'Maintenance reminders retrieved');
}

// 14. Equipment Performance Analytics
export async function getEquipmentPerformanceAnalyticsHandler(req: Request, res: Response) {
  const { equipmentId, periodDays } = req.query;
  const analytics = await getEquipmentPerformanceAnalytics({
    equipmentId: equipmentId ? String(equipmentId) : undefined,
    periodDays: periodDays ? parseInt(String(periodDays), 10) : 30,
  });
  return sendSuccess(res, analytics, 'Equipment performance analytics retrieved');
}

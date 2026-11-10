import { Request, Response } from 'express';
import {
  getItemMasterList,
  getItemMasterById,
  createInventoryItem,
  updateInventoryItem,
  recordStockReceipt,
  resolveByBarcodeOrSku,
  listBatches,
  updateBatchStatus,
  getExpiryAlerts,
  getFefoRecommendation,
  getLocationStockSummary,
  transferStock,
  adjustStock,
  getContrastCatalog,
  issueContrastToPatient,
  recordWastage,
  listWastageLogs,
  getEmergencyKitRegister,
  recordEmergencyChecklist,
  listEmergencyChecklists,
  getFilmStockSummary,
  recordFilmUsage,
  recordScanConsumables,
  getReorderAlerts,
  recordStockAudit,
  listStockAudits,
  traceBatch,
  getInventoryReports,
} from '../services/inventory.service';
import { sendSuccess } from '../utils/apiResponse';

function getContext(req: Request) {
  return {
    userId: req.user?.id,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// 1. Item Master
export async function getItemMasterHandler(req: Request, res: Response) {
  const { category, subCategory, contrastType, search, activeOnly } = req.query;
  const items = await getItemMasterList({
    category: category ? String(category) : undefined,
    subCategory: subCategory ? String(subCategory) : undefined,
    contrastType: contrastType ? String(contrastType) : undefined,
    search: search ? String(search) : undefined,
    activeOnly: activeOnly === 'false' ? false : true,
  });
  return sendSuccess(res, items, 'Inventory items retrieved');
}

export async function getItemMasterByIdHandler(req: Request, res: Response) {
  const item = await getItemMasterById(req.params.idOrCode);
  return sendSuccess(res, item, 'Inventory item retrieved');
}

export async function createItemMasterHandler(req: Request, res: Response) {
  const item = await createInventoryItem(req.body, getContext(req));
  return sendSuccess(res, item, 'Inventory item created successfully', 201);
}

export async function updateItemMasterHandler(req: Request, res: Response) {
  const item = await updateInventoryItem(req.params.idOrCode, req.body, getContext(req));
  return sendSuccess(res, item, 'Inventory item updated successfully');
}

// 2 & 4. Stock Receipt / Purchase Entry & Batches
export async function recordStockReceiptHandler(req: Request, res: Response) {
  const result = await recordStockReceipt(
    {
      ...req.body,
      receivedById: req.user!.id,
      receivedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, result, 'Stock receipt recorded successfully', 201);
}

export async function listBatchesHandler(req: Request, res: Response) {
  const { itemId, supplierName, nearExpiryDays, includeBlocked } = req.query;
  const batches = await listBatches({
    itemId: itemId ? String(itemId) : undefined,
    supplierName: supplierName ? String(supplierName) : undefined,
    nearExpiryDays: nearExpiryDays ? Number(nearExpiryDays) : undefined,
    includeBlocked: includeBlocked === 'true',
  });
  return sendSuccess(res, batches, 'Inventory batches retrieved');
}

export async function updateBatchStatusHandler(req: Request, res: Response) {
  const updated = await updateBatchStatus(req.params.batchId, req.body, getContext(req));
  return sendSuccess(res, updated, 'Batch status updated successfully');
}

// 3. Barcode / QR Scanner
export async function resolveBarcodeHandler(req: Request, res: Response) {
  const result = await resolveByBarcodeOrSku(req.params.code);
  return sendSuccess(res, result, 'Scanned code resolved');
}

// 5. Expiry Date Alerts
export async function getExpiryAlertsHandler(req: Request, res: Response) {
  const { nearExpiryDays, location } = req.query;
  const alerts = await getExpiryAlerts({
    nearExpiryDays: nearExpiryDays ? Number(nearExpiryDays) : undefined,
    location: location ? String(location) : undefined,
  });
  return sendSuccess(res, alerts, 'Expiry alerts retrieved');
}

// 6. FEFO Recommendation
export async function getFefoRecommendationHandler(req: Request, res: Response) {
  const { itemId, location, quantity } = req.query;
  const result = await getFefoRecommendation(
    String(itemId),
    String(location),
    Number(quantity || 1)
  );
  return sendSuccess(res, result, 'FEFO recommendation computed');
}

// 7. Store / Cabinet Locations
export async function getLocationStockHandler(req: Request, res: Response) {
  const summary = await getLocationStockSummary(req.query.location ? String(req.query.location) : undefined);
  return sendSuccess(res, summary, 'Location stock summary retrieved');
}

export async function transferStockHandler(req: Request, res: Response) {
  const txn = await transferStock(
    {
      ...req.body,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, txn, 'Stock transfer completed successfully');
}

export async function adjustStockHandler(req: Request, res: Response) {
  const result = await adjustStock(
    {
      ...req.body,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, result, 'Stock adjustment completed successfully');
}

// 8. Contrast Agent Catalog
export async function getContrastCatalogHandler(req: Request, res: Response) {
  const catalog = await getContrastCatalog(
    req.query.type as 'IODINATED' | 'GADOLINIUM' | undefined
  );
  return sendSuccess(res, catalog, 'Contrast catalog retrieved');
}

// 9. Contrast Issue / Administration
export async function issueContrastHandler(req: Request, res: Response) {
  const result = await issueContrastToPatient(
    {
      ...req.body,
      administeredById: req.user!.id,
      administeredByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, result, 'Contrast dispensed and recorded successfully', 201);
}

// 10. Opened-Vial / Wastage Log
export async function listWastageLogsHandler(req: Request, res: Response) {
  const location = req.query.location ? String(req.query.location) : undefined;
  const logs = await listWastageLogs(location);
  return sendSuccess(res, logs, 'Wastage logs retrieved');
}

export async function recordWastageHandler(req: Request, res: Response) {
  const wastage = await recordWastage(
    {
      ...req.body,
      recordedById: req.user!.id,
      recordedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, wastage, 'Wastage logged and stock adjusted', 201);
}

// 11 & 12. Medicine / Emergency Kit Register & Checklists
export async function getEmergencyRegisterHandler(req: Request, res: Response) {
  const register = await getEmergencyKitRegister(req.query.location ? String(req.query.location) : undefined);
  return sendSuccess(res, register, 'Emergency kit register retrieved');
}

export async function recordEmergencyChecklistHandler(req: Request, res: Response) {
  const checklist = await recordEmergencyChecklist(
    {
      ...req.body,
      checkedById: req.user!.id,
      checkedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Staff',
    },
    getContext(req)
  );
  return sendSuccess(res, checklist, 'Emergency checklist recorded', 201);
}

export async function listEmergencyChecklistsHandler(req: Request, res: Response) {
  const checklists = await listEmergencyChecklists(
    req.query.location ? String(req.query.location) : undefined
  );
  return sendSuccess(res, checklists, 'Emergency checklists retrieved');
}

// 13. Film Stock & Film Counting
export async function getFilmStockHandler(_req: Request, res: Response) {
  const summary = await getFilmStockSummary();
  return sendSuccess(res, summary, 'Film stock summary retrieved');
}

export async function recordFilmUsageHandler(req: Request, res: Response) {
  const result = await recordFilmUsage(
    {
      ...req.body,
      performedById: req.user!.id,
      performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, result, 'Film usage recorded');
}

// 14. Consumable Usage by Scan
export async function recordScanConsumablesHandler(req: Request, res: Response) {
  const usages = await recordScanConsumables(
    {
      ...req.body,
      recordedById: req.user!.id,
      recordedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : undefined,
    },
    getContext(req)
  );
  return sendSuccess(res, usages, 'Scan consumables deducted and recorded', 201);
}

// 15. Minimum Stock / Reorder Alerts
export async function getReorderAlertsHandler(_req: Request, res: Response) {
  const alerts = await getReorderAlerts();
  return sendSuccess(res, alerts, 'Reorder alerts retrieved');
}

// 17. Physical Stock Audit
export async function recordStockAuditHandler(req: Request, res: Response) {
  const audit = await recordStockAudit(
    {
      ...req.body,
      auditedById: req.user!.id,
      auditedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Auditor',
    },
    getContext(req)
  );
  return sendSuccess(res, audit, 'Physical stock audit recorded', 201);
}

export async function listStockAuditsHandler(req: Request, res: Response) {
  const audits = await listStockAudits(req.query.location ? String(req.query.location) : undefined);
  return sendSuccess(res, audits, 'Stock audits retrieved');
}

// 18. Recall / Batch Traceability
export async function traceBatchHandler(req: Request, res: Response) {
  const trace = await traceBatch(req.params.batchNumberOrId);
  return sendSuccess(res, trace, 'Batch traceability report generated');
}

// 19. Purchase / Supplier Reports
export async function getInventoryReportsHandler(req: Request, res: Response) {
  const { startDate, endDate, supplierName } = req.query;
  const reports = await getInventoryReports({
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
    supplierName: supplierName ? String(supplierName) : undefined,
  });
  return sendSuccess(res, reports, 'Inventory reports generated');
}

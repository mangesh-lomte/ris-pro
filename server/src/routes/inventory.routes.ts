import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getItemMasterHandler,
  getItemMasterByIdHandler,
  createItemMasterHandler,
  updateItemMasterHandler,
  recordStockReceiptHandler,
  listBatchesHandler,
  updateBatchStatusHandler,
  resolveBarcodeHandler,
  getExpiryAlertsHandler,
  getFefoRecommendationHandler,
  getLocationStockHandler,
  transferStockHandler,
  adjustStockHandler,
  getContrastCatalogHandler,
  issueContrastHandler,
  recordWastageHandler,
  listWastageLogsHandler,
  getEmergencyRegisterHandler,
  recordEmergencyChecklistHandler,
  listEmergencyChecklistsHandler,
  getFilmStockHandler,
  recordFilmUsageHandler,
  recordScanConsumablesHandler,
  getReorderAlertsHandler,
  recordStockAuditHandler,
  listStockAuditsHandler,
  traceBatchHandler,
  getInventoryReportsHandler,
} from '../controllers/inventory.controller';

const router = Router();

router.use(authenticate);

// ==========================================
// 1. Item Master
// ==========================================
router.get(
  '/items',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getItemMasterHandler)
);

router.get(
  '/items/:idOrCode',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getItemMasterByIdHandler)
);

router.post(
  '/items',
  requireRole(UserRole.ADMIN),
  asyncHandler(createItemMasterHandler)
);

router.put(
  '/items/:idOrCode',
  requireRole(UserRole.ADMIN),
  asyncHandler(updateItemMasterHandler)
);

// ==========================================
// 2 & 4. Stock Receipt / Purchase Entry & Batches
// ==========================================
router.post(
  '/receipts',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(recordStockReceiptHandler)
);

router.get(
  '/batches',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(listBatchesHandler)
);

router.patch(
  '/batches/:batchId/status',
  requireRole(UserRole.ADMIN),
  asyncHandler(updateBatchStatusHandler)
);

// ==========================================
// 3. Barcode / QR Scanner
// ==========================================
router.get(
  '/scan/:code',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(resolveBarcodeHandler)
);

// ==========================================
// 5 & 15. Alerts (Expiry & Reorder)
// ==========================================
router.get(
  '/alerts/expiry',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(getExpiryAlertsHandler)
);

router.get(
  '/alerts/reorder',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getReorderAlertsHandler)
);

// ==========================================
// 6. FEFO Recommendation
// ==========================================
router.get(
  '/fefo',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(getFefoRecommendationHandler)
);

// ==========================================
// 7 & 16. Location Stock, Transfers & Adjustments
// ==========================================
router.get(
  '/locations',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(getLocationStockHandler)
);

router.post(
  '/transfers',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(transferStockHandler)
);

router.post(
  '/adjustments',
  requireRole(UserRole.ADMIN),
  asyncHandler(adjustStockHandler)
);

// ==========================================
// 8 & 9. Contrast Catalog & Clinical Issue
// ==========================================
router.get(
  '/contrast',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST, UserRole.RECEPTION),
  asyncHandler(getContrastCatalogHandler)
);

router.post(
  '/contrast/issue',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(issueContrastHandler)
);

// ==========================================
// 10. Opened-Vial / Wastage Log
// ==========================================
router.get(
  '/wastage',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(listWastageLogsHandler)
);

router.post(
  '/wastage',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(recordWastageHandler)
);

// ==========================================
// 11 & 12. Medicine / Emergency Kit Register & Checklists
// ==========================================
router.get(
  '/emergency-kit',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(getEmergencyRegisterHandler)
);

router.post(
  '/emergency-checklists',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(recordEmergencyChecklistHandler)
);

router.get(
  '/emergency-checklists',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(listEmergencyChecklistsHandler)
);

// ==========================================
// 13. Film Stock & Counting
// ==========================================
router.get(
  '/film',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(getFilmStockHandler)
);

router.post(
  '/film/usage',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(recordFilmUsageHandler)
);

// ==========================================
// 14. Consumable Usage by Scan
// ==========================================
router.post(
  '/consumables/scan-usage',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(recordScanConsumablesHandler)
);

// ==========================================
// 17. Physical Stock Audit
// ==========================================
router.post(
  '/audits',
  requireRole(UserRole.ADMIN),
  asyncHandler(recordStockAuditHandler)
);

router.get(
  '/audits',
  requireRole(UserRole.ADMIN),
  asyncHandler(listStockAuditsHandler)
);

// ==========================================
// 18. Recall / Batch Traceability
// ==========================================
router.get(
  '/batches/:batchNumberOrId/trace',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  asyncHandler(traceBatchHandler)
);

// ==========================================
// 19. Purchase / Supplier Reports
// ==========================================
router.get(
  '/reports',
  requireRole(UserRole.ADMIN),
  asyncHandler(getInventoryReportsHandler)
);

export default router;


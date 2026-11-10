import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getPriceMasterHandler,
  getPriceMasterItemHandler,
  createPriceMasterItemHandler,
  updatePriceMasterItemHandler,
  createQuotationHandler,
  getQuotationHandler,
  listQuotationsHandler,
  createInvoiceHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  getReceiptHandler,
  listReceiptsHandler,
  recordPaymentHandler,
  getOutstandingBalancesHandler,
  applyDiscountHandler,
  processRefundHandler,
  createInsuranceClaimHandler,
  updateClaimStatusHandler,
  listClaimsHandler,
  attachClinicalChargesHandler,
  getCashierSummaryHandler,
  closeCashierDrawerHandler,
  listCashierClosingsHandler,
  getRevenueReportHandler,
  getDebtorReportHandler,
  generateAccountingExportHandler,
} from '../controllers/billing.controller';

const router = Router();

router.use(authenticate);

// ==========================================
// 1. Service Price Master
// ==========================================
router.get(
  '/prices',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getPriceMasterHandler)
);

router.get(
  '/prices/:codeOrId',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getPriceMasterItemHandler)
);

router.post(
  '/prices',
  requireRole(UserRole.ADMIN),
  asyncHandler(createPriceMasterItemHandler)
);

router.put(
  '/prices/:codeOrId',
  requireRole(UserRole.ADMIN),
  asyncHandler(updatePriceMasterItemHandler)
);

// ==========================================
// 2. Quotation / Estimate
// ==========================================
router.post(
  '/quotations',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(createQuotationHandler)
);

router.get(
  '/quotations',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(listQuotationsHandler)
);

router.get(
  '/quotations/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getQuotationHandler)
);

// ==========================================
// 3. Invoice & Receipt
// ==========================================
router.post(
  '/invoices',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(createInvoiceHandler)
);

router.get(
  '/invoices',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(listInvoicesHandler)
);

router.get(
  '/invoices/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getInvoiceHandler)
);

router.get(
  '/receipts',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(listReceiptsHandler)
);

router.get(
  '/receipts/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getReceiptHandler)
);

// ==========================================
// 4. Payments (Cash / Card / UPI / Online)
// ==========================================
router.post(
  '/invoices/:invoiceId/payments',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(recordPaymentHandler)
);

// ==========================================
// 5. Part Payment / Outstanding Balances
// ==========================================
router.get(
  '/outstanding',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getOutstandingBalancesHandler)
);

// ==========================================
// 6. Discount Approval (Admin Only)
// ==========================================
router.post(
  '/invoices/:invoiceId/discounts',
  requireRole(UserRole.ADMIN),
  asyncHandler(applyDiscountHandler)
);

// ==========================================
// 7. Refund / Cancellation Billing (Admin Only)
// ==========================================
router.post(
  '/invoices/:invoiceId/refunds',
  requireRole(UserRole.ADMIN),
  asyncHandler(processRefundHandler)
);

// ==========================================
// 8. Insurance / TPA Claims
// ==========================================
router.post(
  '/claims',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(createInsuranceClaimHandler)
);

router.get(
  '/claims',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(listClaimsHandler)
);

router.patch(
  '/claims/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(updateClaimStatusHandler)
);

// ==========================================
// 9. Contrast / Film Charges
// ==========================================
router.post(
  '/orders/:orderIdOrAccession/clinical-charges',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(attachClinicalChargesHandler)
);

// ==========================================
// 10. Daily Cashier Closing
// ==========================================
router.get(
  '/cashier/summary',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getCashierSummaryHandler)
);

router.post(
  '/cashier/close',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(closeCashierDrawerHandler)
);

router.get(
  '/cashier/closings',
  requireRole(UserRole.ADMIN),
  asyncHandler(listCashierClosingsHandler)
);

// ==========================================
// 11. Revenue & Debtor Reports (Admin Only)
// ==========================================
router.get(
  '/reports/revenue',
  requireRole(UserRole.ADMIN),
  asyncHandler(getRevenueReportHandler)
);

router.get(
  '/reports/debtors',
  requireRole(UserRole.ADMIN),
  asyncHandler(getDebtorReportHandler)
);

// ==========================================
// 12. Accounting Export (Admin Only)
// ==========================================
router.get(
  '/export/accounting',
  requireRole(UserRole.ADMIN),
  asyncHandler(generateAccountingExportHandler)
);

export default router;


import { Request, Response } from 'express';
import {
  getPriceMasterList,
  getPriceMasterItem,
  createPriceMasterItem,
  updatePriceMasterItem,
  createQuotation,
  getQuotation,
  listQuotations,
  createInvoice,
  getInvoice,
  listInvoices,
  recordPayment,
  getReceipt,
  listReceipts,
  getOutstandingBalances,
  applyDiscount,
  processRefund,
  createInsuranceClaim,
  updateClaimStatus,
  listClaims,
  attachClinicalCharges,
  getCashierDailySummary,
  closeCashierDrawer,
  listCashierClosings,
  getRevenueReport,
  getDebtorReport,
  generateAccountingExport,
} from '../services/billing.service';
import { sendSuccess } from '../utils/apiResponse';

function getContext(req: Request) {
  return {
    userId: req.user?.id,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// 1. Price Master
export async function getPriceMasterHandler(req: Request, res: Response) {
  const result = await getPriceMasterList({
    modality: req.query.modality as any,
    category: req.query.category as string,
    search: req.query.search as string,
  });
  return sendSuccess(res, result, 'Price master catalog retrieved successfully.');
}

export async function getPriceMasterItemHandler(req: Request, res: Response) {
  const result = await getPriceMasterItem(req.params.codeOrId);
  return sendSuccess(res, result, 'Price master item retrieved successfully.');
}

export async function createPriceMasterItemHandler(req: Request, res: Response) {
  const result = await createPriceMasterItem(req.body, getContext(req));
  return sendSuccess(res, result, 'Price master item created successfully.', 201);
}

export async function updatePriceMasterItemHandler(req: Request, res: Response) {
  const result = await updatePriceMasterItem(req.params.codeOrId, req.body, getContext(req));
  return sendSuccess(res, result, 'Price master item updated successfully.');
}

// 2. Quotation / Estimate
export async function createQuotationHandler(req: Request, res: Response) {
  const result = await createQuotation(req.body, getContext(req));
  return sendSuccess(res, result, 'Official quotation generated successfully.', 201);
}

export async function getQuotationHandler(req: Request, res: Response) {
  const result = await getQuotation(req.params.id);
  return sendSuccess(res, result, 'Quotation retrieved successfully.');
}

export async function listQuotationsHandler(req: Request, res: Response) {
  const result = await listQuotations(req.query.patientId as string);
  return sendSuccess(res, result, 'Quotations retrieved successfully.');
}

// 3. Invoice & Receipt
export async function createInvoiceHandler(req: Request, res: Response) {
  const result = await createInvoice(req.body, getContext(req));
  return sendSuccess(res, result, 'Invoice generated successfully.', 201);
}

export async function getInvoiceHandler(req: Request, res: Response) {
  const result = await getInvoice(req.params.id);
  return sendSuccess(res, result, 'Invoice retrieved successfully.');
}

export async function listInvoicesHandler(req: Request, res: Response) {
  const result = await listInvoices({
    patientId: req.query.patientId as string,
    status: req.query.status as any,
    orderId: req.query.orderId as string,
  });
  return sendSuccess(res, result, 'Invoices retrieved successfully.');
}

export async function getReceiptHandler(req: Request, res: Response) {
  const result = await getReceipt(req.params.id);
  return sendSuccess(res, result, 'Payment receipt retrieved successfully.');
}

export async function listReceiptsHandler(req: Request, res: Response) {
  const result = await listReceipts({
    patientId: req.query.patientId as string,
    invoiceId: req.query.invoiceId as string,
  });
  return sendSuccess(res, result, 'Receipts retrieved successfully.');
}

// 4. Payments
export async function recordPaymentHandler(req: Request, res: Response) {
  const result = await recordPayment(req.params.invoiceId, req.body, getContext(req));
  return sendSuccess(res, result, 'Payment recorded and receipt issued successfully.', 201);
}

// 5. Part payment / Outstanding
export async function getOutstandingBalancesHandler(req: Request, res: Response) {
  const result = await getOutstandingBalances(req.query.search as string);
  return sendSuccess(res, result, 'Outstanding balances and aging list retrieved successfully.');
}

// 6. Discount Approval
export async function applyDiscountHandler(req: Request, res: Response) {
  const result = await applyDiscount(req.params.invoiceId, req.body, getContext(req));
  return sendSuccess(res, result, 'Discount approved and invoice recalculated successfully.');
}

// 7. Refund / Cancellation
export async function processRefundHandler(req: Request, res: Response) {
  const result = await processRefund(req.params.invoiceId, req.body, getContext(req));
  return sendSuccess(res, result, 'Refund processed and financial history preserved.', 201);
}

// 8. Insurance Claims
export async function createInsuranceClaimHandler(req: Request, res: Response) {
  const result = await createInsuranceClaim(req.body, getContext(req));
  return sendSuccess(res, result, 'Insurance claim registered successfully.', 201);
}

export async function updateClaimStatusHandler(req: Request, res: Response) {
  const result = await updateClaimStatus(req.params.id, req.body, getContext(req));
  return sendSuccess(res, result, 'Insurance claim status updated successfully.');
}

export async function listClaimsHandler(req: Request, res: Response) {
  const result = await listClaims({
    status: req.query.status as string,
    patientId: req.query.patientId as string,
  });
  return sendSuccess(res, result, 'Insurance claims retrieved successfully.');
}

// 9. Contrast / Film Charges
export async function attachClinicalChargesHandler(req: Request, res: Response) {
  const result = await attachClinicalCharges(req.params.orderIdOrAccession, req.body, getContext(req));
  return sendSuccess(res, result, result.message);
}

// 10. Cashier Closing
export async function getCashierSummaryHandler(req: Request, res: Response) {
  const cashierId = (req.query.cashierId as string) || req.user?.id || 'SYSTEM_CASHIER';
  const result = await getCashierDailySummary(cashierId);
  return sendSuccess(res, result, 'Cashier daily collection summary calculated.');
}

export async function closeCashierDrawerHandler(req: Request, res: Response) {
  const result = await closeCashierDrawer(req.body, getContext(req));
  return sendSuccess(res, result, 'Cashier drawer successfully closed and reconciled.', 201);
}

export async function listCashierClosingsHandler(req: Request, res: Response) {
  const result = await listCashierClosings(req.query.date ? new Date(req.query.date as string) : undefined);
  return sendSuccess(res, result, 'Cashier closing audit records retrieved.');
}

// 11. Revenue & Debtor Reports
export async function getRevenueReportHandler(req: Request, res: Response) {
  const result = await getRevenueReport({
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    modality: req.query.modality as any,
  });
  return sendSuccess(res, result, 'Revenue breakdown and collection analytics retrieved.');
}

export async function getDebtorReportHandler(req: Request, res: Response) {
  const min = req.query.minOutstanding ? Number(req.query.minOutstanding) : 0;
  const result = await getDebtorReport({ minOutstanding: min });
  return sendSuccess(res, result, 'Accounts receivable debtor aging report retrieved.');
}

// 12. Accounting Export
export async function generateAccountingExportHandler(req: Request, res: Response) {
  const result = await generateAccountingExport(
    {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      format: (req.query.format as any) || 'json',
    },
    getContext(req)
  );
  if (req.query.format === 'csv' && result.csvContent) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accounting_export.csv"');
    return res.send(result.csvContent);
  }
  return sendSuccess(res, result, 'General Ledger journal vouchers exported successfully.');
}


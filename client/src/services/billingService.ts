import { apiClient } from '../lib/api';
import { ApiResponse } from '../types';

export interface PriceMasterItem {
  id: string;
  code: string;
  name: string;
  modality: string;
  category: string;
  basePrice: number | string;
  taxRate: number | string;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  priceItemId?: string | null;
  code: string;
  description: string;
  unitPrice: number | string;
  quantity: number;
  discount: number | string;
  taxRate: number | string;
  total: number | string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  patientId: string;
  grossAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  status: 'ESTIMATE' | 'CONVERTED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  patient?: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  items: QuotationItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  priceItemId?: string | null;
  code: string;
  description: string;
  unitPrice: number | string;
  quantity: number;
  taxRate: number | string;
  total: number | string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number | string;
  method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'ONLINE' | 'INSURANCE';
  referenceNumber?: string | null;
  recordedById?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  createdAt: string;
  receipt?: ReceiptRecord | null;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  paymentId: string;
  amount: number | string;
  paymentMethod: string;
  issuedAt: string;
  issuedById: string;
  receiptSnapshot?: any;
  invoice?: InvoiceRecord;
  payment?: PaymentRecord;
}

export interface RefundRecord {
  id: string;
  invoiceId: string;
  paymentId?: string | null;
  amount: number | string;
  reason: string;
  processedById: string;
  createdAt: string;
}

export interface InsuranceClaimRecord {
  id: string;
  claimNumber: string;
  invoiceId: string;
  invoiceNumber?: string;
  patientId: string;
  patientName?: string;
  tpaProvider: string;
  payerName?: string;
  policyNumber: string;
  approvalCode?: string | null;
  preAuthCode?: string | null;
  claimedAmount: number | string;
  claimAmount?: number | string;
  approvedAmount?: number | string | null;
  settledAmount?: number | string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SETTLED';
  notes?: string | null;
  submittedAt: string;
  settledAt?: string | null;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  patientId: string;
  accessionNumber: string;
  orderId?: string | null;
  grossAmount: number | string;
  discount: number | string;
  taxAmount: number | string;
  total: number | string;
  balance: number | string;
  outstandingAmount?: number | string;
  paidAmount?: number | string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  paymentMethod?: string | null;
  paymentReference?: string | null;
  discountReason?: string | null;
  discountApprovedById?: string | null;
  discountApprovedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  order?: {
    id: string;
    accessionNumber: string;
    modality: string;
    bodyPart: string;
    examinationName: string;
  } | null;
  items: InvoiceItem[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  refunds: RefundRecord[];
  claims: InsuranceClaimRecord[];
}

export interface CashierSummary {
  businessDate: string;
  cashierName: string;
  cashierId: string;
  openingFloat: number;
  cashCollected: number;
  cardCollected: number;
  upiCollected: number;
  onlineCollected: number;
  insuranceCollected: number;
  totalCollected: number;
  expectedCash?: number;
  expectedCashInDrawer: number;
  isClosed: boolean;
  closingRecord?: CashierClosingRecord | null;
}

export interface CashierClosingRecord {
  id: string;
  closingNumber: string;
  userId: string;
  businessDate: string;
  closingDate?: string;
  openingFloat: number | string;
  expectedCash: number | string;
  actualCash: number | string;
  variance: number | string;
  notes?: string | null;
  closedAt: string;
}

export interface RevenueReportData {
  period?: { startDate?: string; endDate?: string };
  summary: {
    totalInvoices: number;
    grossBilled: number;
    discountsGiven: number;
    netBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    totalRefunds: number;
    netRealizedRevenue: number;
  };
  byPaymentMethod: Array<{ method: string; count: number; total: number }>;
  byModality: Array<{ modality: string; invoiceCount: number; totalBilled: number; totalPaid: number }>;
}

export interface DebtorReportData {
  debtorCount: number;
  totalReceivable: number;
  agingSummary: {
    currentUnder30Days: number;
    thirtyToSixtyDays: number;
    sixtyToNinetyDays: number;
    overNinetyDays: number;
  };
  debtors: Array<{
    invoiceId?: string;
    invoiceNumber: string;
    patientId: string;
    patientName: string;
    phone?: string;
    accessionNumber: string;
    totalBilled: number;
    paidAmount: number;
    outstandingAmount: number;
    invoiceDate: string;
    daysOutstanding: number;
    agingBucket: string;
  }>;
}

export interface AccountingExportData {
  exportDate: string;
  journalVouchers: Array<{
    voucherNumber: string;
    date: string;
    type: 'SALES' | 'RECEIPT' | 'REFUND';
    referenceNumber: string;
    description: string;
    entries: Array<{
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
    }>;
  }>;
  summary: {
    totalSalesVouchers: number;
    totalReceiptVouchers: number;
    totalRefundVouchers: number;
    totalDebit: number;
    totalCredit: number;
  };
}

export const billingService = {
  // 1. Price Master
  async getPrices(): Promise<ApiResponse<PriceMasterItem[]>> {
    return apiClient<PriceMasterItem[]>('/billing/prices');
  },

  async createPrice(data: Partial<PriceMasterItem>): Promise<ApiResponse<PriceMasterItem>> {
    return apiClient<PriceMasterItem>('/billing/prices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePrice(codeOrId: string, data: Partial<PriceMasterItem>): Promise<ApiResponse<PriceMasterItem>> {
    return apiClient<PriceMasterItem>(`/billing/prices/${codeOrId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 2. Quotation
  async createQuotation(data: {
    patientId: string;
    items: Array<{
      priceItemId?: string;
      code: string;
      description: string;
      unitPrice: number;
      quantity: number;
      discount?: number;
      taxRate?: number;
    }>;
    validityDays?: number;
  }): Promise<ApiResponse<Quotation>> {
    return apiClient<Quotation>('/billing/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listQuotations(patientId?: string): Promise<ApiResponse<Quotation[]>> {
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return apiClient<Quotation[]>(`/billing/quotations${query}`);
  },

  async getQuotation(id: string): Promise<ApiResponse<Quotation>> {
    return apiClient<Quotation>(`/billing/quotations/${id}`);
  },

  // 3. Invoices & Receipts
  async createInvoice(data: {
    patientId: string;
    accessionNumber: string;
    orderId?: string;
    items?: Array<{
      priceItemId?: string;
      code: string;
      description: string;
      unitPrice: number;
      quantity: number;
      taxRate?: number;
    }>;
    discount?: number;
  }): Promise<ApiResponse<InvoiceRecord>> {
    return apiClient<InvoiceRecord>('/billing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listInvoices(params?: {
    patientId?: string;
    accessionNumber?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<InvoiceRecord[]>> {
    const searchParams = new URLSearchParams();
    if (params?.patientId) searchParams.append('patientId', params.patientId);
    if (params?.accessionNumber) searchParams.append('accessionNumber', params.accessionNumber);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return apiClient<InvoiceRecord[]>(`/billing/invoices${qs ? `?${qs}` : ''}`);
  },

  async getInvoice(id: string): Promise<ApiResponse<InvoiceRecord>> {
    return apiClient<InvoiceRecord>(`/billing/invoices/${id}`);
  },

  async listReceipts(invoiceId?: string): Promise<ApiResponse<ReceiptRecord[]>> {
    const query = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : '';
    return apiClient<ReceiptRecord[]>(`/billing/receipts${query}`);
  },

  async getReceipt(id: string): Promise<ApiResponse<ReceiptRecord>> {
    return apiClient<ReceiptRecord>(`/billing/receipts/${id}`);
  },

  // 4. Payments
  async recordPayment(
    invoiceId: string,
    data: {
      amount: number;
      method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'ONLINE' | 'INSURANCE';
      referenceNumber?: string;
      notes?: string;
      idempotencyKey?: string;
    }
  ): Promise<ApiResponse<PaymentRecord>> {
    return apiClient<PaymentRecord>(`/billing/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: data.amount,
        paymentMethod: data.method,
        reference: data.referenceNumber,
        notes: data.notes,
        idempotencyKey: data.idempotencyKey,
      }),
    });
  },

  // 5. Outstanding
  async getOutstanding(params?: { patientId?: string; search?: string }): Promise<ApiResponse<InvoiceRecord[]>> {
    const searchParams = new URLSearchParams();
    if (params?.patientId) searchParams.append('patientId', params.patientId);
    if (params?.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return apiClient<InvoiceRecord[]>(`/billing/outstanding${qs ? `?${qs}` : ''}`);
  },

  // 6. Discount Approval (Admin)
  async applyDiscount(
    invoiceId: string,
    data: { discount: number; reason: string }
  ): Promise<ApiResponse<InvoiceRecord>> {
    return apiClient<InvoiceRecord>(`/billing/invoices/${invoiceId}/discounts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 7. Refund / Cancellation (Admin)
  async processRefund(
    invoiceId: string,
    data: { amount: number; reason: string; paymentId?: string }
  ): Promise<ApiResponse<RefundRecord>> {
    return apiClient<RefundRecord>(`/billing/invoices/${invoiceId}/refunds`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 8. Insurance / TPA Claims
  async createClaim(data: {
    invoiceId?: string;
    patientId?: string;
    tpaProvider?: string;
    payerName?: string;
    policyNumber: string;
    approvalCode?: string;
    preAuthCode?: string;
    claimedAmount?: number;
    claimAmount?: number;
    notes?: string;
  }): Promise<ApiResponse<InsuranceClaimRecord>> {
    return apiClient<InsuranceClaimRecord>('/billing/claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listClaims(status?: string): Promise<ApiResponse<InsuranceClaimRecord[]>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient<InsuranceClaimRecord[]>(`/billing/claims${query}`);
  },

  async updateClaimStatus(
    id: string,
    data: {
      status: 'APPROVED' | 'REJECTED' | 'SETTLED';
      approvedAmount?: number;
      settledAmount?: number;
      approvalCode?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<InsuranceClaimRecord>> {
    return apiClient<InsuranceClaimRecord>(`/billing/claims/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // 9. Contrast / Film Charges
  async attachClinicalCharges(
    orderIdOrAccession: string,
    data: {
      contrastUsed?: boolean;
      contrastVolumeMl?: number;
      contrastRate?: number;
      filmCount?: number;
      filmRate?: number;
    }
  ): Promise<ApiResponse<InvoiceRecord>> {
    return apiClient<InvoiceRecord>(`/billing/orders/${orderIdOrAccession}/clinical-charges`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 10. Cashier Closing
  async getCashierSummary(): Promise<ApiResponse<CashierSummary>> {
    return apiClient<CashierSummary>('/billing/cashier/summary');
  },

  async closeCashierDrawer(data: {
    openingFloat?: number;
    actualCash: number;
    notes?: string;
  }): Promise<ApiResponse<CashierClosingRecord>> {
    return apiClient<CashierClosingRecord>('/billing/cashier/close', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listCashierClosings(): Promise<ApiResponse<CashierClosingRecord[]>> {
    return apiClient<CashierClosingRecord[]>('/billing/cashier/closings');
  },

  // 11. Revenue & Debtor Reports
  async getRevenueReport(startDate?: string, endDate?: string): Promise<ApiResponse<RevenueReportData>> {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.append('startDate', startDate);
    if (endDate) searchParams.append('endDate', endDate);
    const qs = searchParams.toString();
    return apiClient<RevenueReportData>(`/billing/reports/revenue${qs ? `?${qs}` : ''}`);
  },

  async getDebtorReport(): Promise<ApiResponse<DebtorReportData>> {
    return apiClient<DebtorReportData>('/billing/reports/debtors');
  },

  // 12. Accounting Export
  async getAccountingExport(format: 'json' | 'csv' = 'json'): Promise<any> {
    if (format === 'csv') {
      const token = localStorage.getItem('ris_auth_token');
      const response = await fetch(`/api/v1/billing/export/accounting?format=csv`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Export failed with HTTP ${response.status}`);
      }
      return await response.text();
    }
    return apiClient<AccountingExportData>('/billing/export/accounting?format=json');
  },
};

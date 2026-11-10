import { apiClient } from '../lib/api';
import { ApiResponse } from '../types';

export interface InventoryItemRecord {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  subCategory?: string | null;
  unit: string;
  barcode?: string | null;
  sku?: string | null;
  quantity: number;
  reorderLevel: number;
  unitPrice: number | string;
  contrastType?: string | null;
  concentration?: string | null;
  packSize?: string | null;
  filmSize?: string | null;
  isEmergencyKit: boolean;
  active: boolean;
  totalPhysicalStock?: number;
  reorderAlert?: boolean;
  createdAt: string;
  updatedAt: string;
  batches?: InventoryBatchRecord[];
  locationStocks?: LocationStockRecord[];
}

export interface InventoryBatchRecord {
  id: string;
  batchNumber: string;
  itemId: string;
  supplierName?: string | null;
  purchaseInvoice?: string | null;
  expiryDate: string;
  receivedDate: string;
  initialQuantity: number;
  currentQuantity: number;
  unitCost: number | string;
  isBlocked: boolean;
  blockReason?: string | null;
  isExpired?: boolean;
  isNearExpiry?: boolean;
  daysUntilExpiry?: number;
  status?: string;
  item?: InventoryItemRecord;
  locationStocks?: LocationStockRecord[];
}

export interface LocationStockRecord {
  id: string;
  location: string;
  itemId: string;
  batchId: string;
  quantity: number;
  updatedAt: string;
  item?: InventoryItemRecord;
  batch?: InventoryBatchRecord;
}

export interface StockTransactionRecord {
  id: string;
  transactionNumber: string;
  type: string;
  itemId: string;
  batchId?: string | null;
  sourceLocation?: string | null;
  targetLocation?: string | null;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string | null;
  patientId?: string | null;
  unitCost?: number | string | null;
  totalValue?: number | string | null;
  reference?: string | null;
  reason?: string | null;
  performedById: string;
  performedByName?: string | null;
  createdAt: string;
}

export interface WastageLogRecord {
  id: string;
  wastageNumber: string;
  itemId: string;
  batchId?: string | null;
  location: string;
  quantity: number;
  volumeUsedMl?: number | string | null;
  volumeWastedMl?: number | string | null;
  reason: string;
  orderId?: string | null;
  patientId?: string | null;
  recordedById: string;
  recordedByName?: string | null;
  recordedAt: string;
  item?: InventoryItemRecord;
}

export interface EmergencyChecklistRecord {
  id: string;
  checklistNumber: string;
  location: string;
  status: string;
  checkedById: string;
  checkedByName: string;
  checkedAt: string;
  notes?: string | null;
  items: Array<{
    id: string;
    itemId: string;
    batchId?: string | null;
    status: string;
    currentStock: number;
    expiryDate?: string | null;
    replacementDone: boolean;
    replacementBatch?: string | null;
    remarks?: string | null;
    item: InventoryItemRecord;
  }>;
}

export interface StockAuditRecord {
  id: string;
  auditNumber: string;
  location: string;
  status: string;
  auditedById: string;
  auditedByName: string;
  auditedAt: string;
  totalVariance: number;
  notes?: string | null;
  items: Array<{
    id: string;
    itemId: string;
    batchId?: string | null;
    expectedQty: number;
    countedQty: number;
    variance: number;
    discrepancyReason?: string | null;
    reconciled: boolean;
    item: InventoryItemRecord;
    batch?: InventoryBatchRecord | null;
  }>;
}

export interface BatchTraceResult {
  batch: {
    id: string;
    batchNumber: string;
    itemCode: string;
    itemName: string;
    supplierName?: string | null;
    purchaseInvoice?: string | null;
    receivedDate: string;
    expiryDate: string;
    initialQuantity: number;
    currentQuantity: number;
    isBlocked: boolean;
    blockReason?: string | null;
  };
  currentStockLocations: Array<{ location: string; quantity: number }>;
  affectedPatientCount: number;
  affectedPatients: Array<{
    patientId: string;
    patientName: string;
    phone?: string | null;
    orderId: string;
    accessionNumber: string;
    examinationName: string;
    modality: string;
    status: string;
    hasFinalReport: boolean;
  }>;
  transactionCount: number;
  transactions: StockTransactionRecord[];
  wastageCount: number;
  wastageRecords: WastageLogRecord[];
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const inventoryService = {
  // 1. Item Master
  async getItems(filters?: {
    category?: string;
    subCategory?: string;
    contrastType?: string;
    search?: string;
    activeOnly?: boolean;
  }): Promise<ApiResponse<InventoryItemRecord[]>> {
    return apiClient<InventoryItemRecord[]>(`/inventory/items${buildQuery(filters)}`);
  },

  async getItemById(idOrCode: string): Promise<ApiResponse<InventoryItemRecord>> {
    return apiClient<InventoryItemRecord>(`/inventory/items/${encodeURIComponent(idOrCode)}`);
  },

  async createItem(data: any): Promise<ApiResponse<InventoryItemRecord>> {
    return apiClient<InventoryItemRecord>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateItem(idOrCode: string, data: any): Promise<ApiResponse<InventoryItemRecord>> {
    return apiClient<InventoryItemRecord>(`/inventory/items/${encodeURIComponent(idOrCode)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 2 & 4. Stock Receipt & Batches
  async recordReceipt(data: any): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listBatches(filters?: any): Promise<ApiResponse<InventoryBatchRecord[]>> {
    return apiClient<InventoryBatchRecord[]>(`/inventory/batches${buildQuery(filters)}`);
  },

  async updateBatchStatus(batchId: string, data: { isBlocked: boolean; blockReason?: string }): Promise<ApiResponse<InventoryBatchRecord>> {
    return apiClient<InventoryBatchRecord>(`/inventory/batches/${encodeURIComponent(batchId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // 3. Barcode Scanner
  async scanCode(code: string): Promise<ApiResponse<any>> {
    return apiClient<any>(`/inventory/scan/${encodeURIComponent(code)}`);
  },

  // 5 & 15. Alerts
  async getExpiryAlerts(filters?: { nearExpiryDays?: number; location?: string }): Promise<ApiResponse<any>> {
    return apiClient<any>(`/inventory/alerts/expiry${buildQuery(filters)}`);
  },

  async getReorderAlerts(): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/alerts/reorder');
  },

  // 6. FEFO
  async getFefo(itemId: string, location: string, quantity: number): Promise<ApiResponse<any>> {
    return apiClient<any>(`/inventory/fefo${buildQuery({ itemId, location, quantity })}`);
  },

  // 7 & 16. Location Stock, Transfers & Adjustments
  async getLocationStocks(location?: string): Promise<ApiResponse<any>> {
    return apiClient<any>(`/inventory/locations${buildQuery({ location })}`);
  },

  async transferStock(data: any): Promise<ApiResponse<StockTransactionRecord>> {
    return apiClient<StockTransactionRecord>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adjustStock(data: any): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 8 & 9. Contrast Catalog & Dispensing
  async getContrastCatalog(type?: 'IODINATED' | 'GADOLINIUM'): Promise<ApiResponse<any[]>> {
    return apiClient<any[]>(`/inventory/contrast${buildQuery({ type })}`);
  },

  async issueContrast(data: any): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/contrast/issue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 10. Opened-Vial / Wastage
  async listWastageLogs(location?: string): Promise<ApiResponse<WastageLogRecord[]>> {
    return apiClient<WastageLogRecord[]>(`/inventory/wastage${buildQuery({ location })}`);
  },

  async recordWastage(data: any): Promise<ApiResponse<WastageLogRecord>> {
    return apiClient<WastageLogRecord>('/inventory/wastage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 11 & 12. Emergency Kit & Checklists
  async getEmergencyRegister(location?: string): Promise<ApiResponse<any[]>> {
    return apiClient<any[]>(`/inventory/emergency-kit${buildQuery({ location })}`);
  },

  async recordEmergencyChecklist(data: any): Promise<ApiResponse<EmergencyChecklistRecord>> {
    return apiClient<EmergencyChecklistRecord>('/inventory/emergency-checklists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listEmergencyChecklists(location?: string): Promise<ApiResponse<EmergencyChecklistRecord[]>> {
    return apiClient<EmergencyChecklistRecord[]>(`/inventory/emergency-checklists${buildQuery({ location })}`);
  },

  // 13. Film Stock
  async getFilmStock(): Promise<ApiResponse<any[]>> {
    return apiClient<any[]>('/inventory/film');
  },

  async recordFilmUsage(data: any): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/film/usage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 14. Consumable Usage
  async recordScanConsumables(data: any): Promise<ApiResponse<any>> {
    return apiClient<any>('/inventory/consumables/scan-usage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 17. Stock Audit
  async recordAudit(data: any): Promise<ApiResponse<StockAuditRecord>> {
    return apiClient<StockAuditRecord>('/inventory/audits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listAudits(location?: string): Promise<ApiResponse<StockAuditRecord[]>> {
    return apiClient<StockAuditRecord[]>(`/inventory/audits${buildQuery({ location })}`);
  },

  // 18. Recall & Traceability
  async traceBatch(batchNumberOrId: string): Promise<ApiResponse<BatchTraceResult>> {
    return apiClient<BatchTraceResult>(`/inventory/batches/${encodeURIComponent(batchNumberOrId)}/trace`);
  },

  // 19. Reports
  async getReports(filters?: { startDate?: string; endDate?: string; supplierName?: string }): Promise<ApiResponse<any>> {
    return apiClient<any>(`/inventory/reports${buildQuery(filters)}`);
  },
};

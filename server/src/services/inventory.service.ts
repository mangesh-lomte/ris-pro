import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import crypto from 'crypto';

export interface AuditContext {
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const VALID_LOCATIONS = [
  'CT_SCANNER',
  'MRI_SCANNER',
  'XRAY_ROOM',
  'PHARMACY',
  'GENERAL_STORE',
] as const;

export type InventoryLocation = (typeof VALID_LOCATIONS)[number];

// Sequential / unique number helpers
function generateTxnNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${year}-${rand}`;
}

function generateWastageNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `WST-${year}-${rand}`;
}

function generateChecklistNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CHK-${year}-${rand}`;
}

function generateAuditNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `AUD-${year}-${rand}`;
}

function generatePoNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PO-${year}-${rand}`;
}

// -------------------------------------------------------------
// DEFAULT INVENTORY SEED CATALOG
// -------------------------------------------------------------
export const DEFAULT_INVENTORY_ITEMS = [
  // 1. Contrast - Iodinated
  {
    itemCode: 'INV-CON-OMNI350',
    name: 'Omnipaque 350 mg I/mL (100 mL)',
    category: 'CONTRAST',
    subCategory: 'IODINATED',
    unit: 'VIAL',
    barcode: '890123400101',
    sku: 'INV-CONTRAST-OMNI350',
    reorderLevel: 15,
    unitPrice: 42.5,
    contrastType: 'IODINATED',
    concentration: '350 mg/mL',
    packSize: '100 mL',
    isEmergencyKit: false,
  },
  {
    itemCode: 'INV-CON-ULTRA370',
    name: 'Ultravist 370 mg/mL (100 mL)',
    category: 'CONTRAST',
    subCategory: 'IODINATED',
    unit: 'VIAL',
    barcode: '890123400102',
    sku: 'INV-CONTRAST-ULTRA370',
    reorderLevel: 10,
    unitPrice: 48.0,
    contrastType: 'IODINATED',
    concentration: '370 mg/mL',
    packSize: '100 mL',
    isEmergencyKit: false,
  },
  // 2. Contrast - Gadolinium
  {
    itemCode: 'INV-CON-GADO15',
    name: 'Gadovist 1.0 mmol/mL (15 mL prefilled syringe)',
    category: 'CONTRAST',
    subCategory: 'GADOLINIUM',
    unit: 'VIAL',
    barcode: '890123400201',
    sku: 'INV-CONTRAST-GADO15',
    reorderLevel: 10,
    unitPrice: 65.0,
    contrastType: 'GADOLINIUM',
    concentration: '1.0 mmol/mL',
    packSize: '15 mL',
    isEmergencyKit: false,
  },
  {
    itemCode: 'INV-CON-DOT20',
    name: 'Dotarem 0.5 mmol/mL (20 mL)',
    category: 'CONTRAST',
    subCategory: 'GADOLINIUM',
    unit: 'VIAL',
    barcode: '890123400202',
    sku: 'INV-CONTRAST-DOT20',
    reorderLevel: 10,
    unitPrice: 70.0,
    contrastType: 'GADOLINIUM',
    concentration: '0.5 mmol/mL',
    packSize: '20 mL',
    isEmergencyKit: false,
  },
  // 3. Film Stock
  {
    itemCode: 'INV-FLM-14X17',
    name: 'Carestream DryView Laser Imaging Film 14x17 in',
    category: 'FILM',
    subCategory: 'XRAY_FILM',
    unit: 'SHEET',
    barcode: '890123400301',
    sku: 'INV-FILM-14X17',
    reorderLevel: 100,
    unitPrice: 4.5,
    filmSize: '14x17',
    packSize: '125 sheets/box',
    isEmergencyKit: false,
  },
  {
    itemCode: 'INV-FLM-8X10',
    name: 'Carestream DryView Laser Imaging Film 8x10 in',
    category: 'FILM',
    subCategory: 'XRAY_FILM',
    unit: 'SHEET',
    barcode: '890123400302',
    sku: 'INV-FILM-8X10',
    reorderLevel: 100,
    unitPrice: 2.2,
    filmSize: '8x10',
    packSize: '125 sheets/box',
    isEmergencyKit: false,
  },
  // 4. Consumables
  {
    itemCode: 'INV-CSM-IV20G',
    name: 'BD Nexiva Closed IV Catheter System 20G',
    category: 'CONSUMABLE',
    subCategory: 'IV_CANNULA',
    unit: 'PIECE',
    barcode: '890123400401',
    sku: 'INV-CATH-20G',
    reorderLevel: 50,
    unitPrice: 3.2,
    packSize: '50/box',
    isEmergencyKit: false,
  },
  {
    itemCode: 'INV-CSM-SYR10ML',
    name: 'BD 10 mL Luer-Lok Sterile Syringes',
    category: 'CONSUMABLE',
    subCategory: 'SYRINGE',
    unit: 'PIECE',
    barcode: '890123400402',
    sku: 'INV-SYR-10ML',
    reorderLevel: 100,
    unitPrice: 0.85,
    packSize: '100/box',
    isEmergencyKit: false,
  },
  {
    itemCode: 'INV-CSM-INJTUBE',
    name: 'Medrad Stellant CT Dual Syringe Tubing Kit with Fast Fill',
    category: 'CONSUMABLE',
    subCategory: 'TUBING',
    unit: 'KIT',
    barcode: '890123400403',
    sku: 'INV-TUBE-DUAL',
    reorderLevel: 25,
    unitPrice: 18.5,
    packSize: 'Single sterile kit',
    isEmergencyKit: false,
  },
  // 5. Emergency Kit & Routine Medicines
  {
    itemCode: 'INV-MED-EPI1MG',
    name: 'Epinephrine Injection 1 mg/mL (1:1000) Ampoules',
    category: 'EMERGENCY_KIT',
    subCategory: 'MEDICINE',
    unit: 'AMPOULE',
    barcode: '890123400501',
    sku: 'INV-MED-EPI',
    reorderLevel: 5,
    unitPrice: 12.0,
    packSize: '1 mL ampoule',
    isEmergencyKit: true,
  },
  {
    itemCode: 'INV-MED-ATR06',
    name: 'Atropine Sulfate Injection 0.6 mg/mL',
    category: 'EMERGENCY_KIT',
    subCategory: 'MEDICINE',
    unit: 'VIAL',
    barcode: '890123400502',
    sku: 'INV-MED-ATR',
    reorderLevel: 5,
    unitPrice: 8.5,
    packSize: '1 mL vial',
    isEmergencyKit: true,
  },
  {
    itemCode: 'INV-MED-DIPH50',
    name: 'Diphenhydramine (Benadryl) 50 mg/mL Injection',
    category: 'EMERGENCY_KIT',
    subCategory: 'MEDICINE',
    unit: 'VIAL',
    barcode: '890123400503',
    sku: 'INV-MED-DIPH',
    reorderLevel: 5,
    unitPrice: 9.0,
    packSize: '1 mL vial',
    isEmergencyKit: true,
  },
  {
    itemCode: 'INV-MED-SAL500',
    name: 'Normal Saline 0.9% 500 mL IV Infusion Bag',
    category: 'MEDICINE',
    subCategory: 'CONSUMABLE',
    unit: 'BAG',
    barcode: '890123400504',
    sku: 'INV-SAL-500ML',
    reorderLevel: 30,
    unitPrice: 2.5,
    packSize: '500 mL bag',
    isEmergencyKit: false,
  },
];

export async function ensureDefaultInventoryCatalog() {
  for (const item of DEFAULT_INVENTORY_ITEMS) {
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        OR: [{ itemCode: item.itemCode }, { barcode: item.barcode }],
      },
    });

    if (!existing) {
      await prisma.inventoryItem.create({
        data: {
          itemCode: item.itemCode,
          name: item.name,
          category: item.category,
          subCategory: item.subCategory,
          unit: item.unit,
          barcode: item.barcode,
          sku: item.sku,
          reorderLevel: item.reorderLevel,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          contrastType: item.contrastType,
          concentration: item.concentration,
          packSize: item.packSize,
          filmSize: (item as any).filmSize,
          isEmergencyKit: item.isEmergencyKit,
          active: true,
        },
      });
    }
  }
}

// =============================================================
// 1. ITEM MASTER
// =============================================================
export async function getItemMasterList(filters?: {
  category?: string;
  subCategory?: string;
  contrastType?: string;
  search?: string;
  activeOnly?: boolean;
}) {
  await ensureDefaultInventoryCatalog();

  const where: Prisma.InventoryItemWhereInput = {};

  if (filters?.activeOnly !== false) {
    where.active = true;
  }
  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.subCategory) {
    where.subCategory = filters.subCategory;
  }
  if (filters?.contrastType) {
    where.contrastType = filters.contrastType;
  }
  if (filters?.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { itemCode: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      locationStocks: true,
      batches: {
        where: { currentQuantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return items.map((it) => {
    const totalPhysicalStock = it.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
    return {
      ...it,
      totalPhysicalStock,
      reorderAlert: totalPhysicalStock <= it.reorderLevel,
    };
  });
}

export async function getItemMasterById(idOrCode: string) {
  await ensureDefaultInventoryCatalog();

  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: [
        { id: idOrCode },
        { itemCode: idOrCode },
        { barcode: idOrCode },
        { sku: idOrCode },
      ],
    },
    include: {
      locationStocks: true,
      batches: {
        orderBy: { expiryDate: 'asc' },
      },
    },
  });

  if (!item) {
    throw new AppError(`Inventory item '${idOrCode}' not found`, 404);
  }

  const totalPhysicalStock = item.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
  return {
    ...item,
    totalPhysicalStock,
    reorderAlert: totalPhysicalStock <= item.reorderLevel,
  };
}

export async function createInventoryItem(
  input: {
    itemCode: string;
    name: string;
    category: string;
    subCategory?: string;
    unit?: string;
    barcode?: string;
    reorderLevel?: number;
    unitPrice?: number;
    contrastType?: string;
    concentration?: string;
    packSize?: string;
    filmSize?: string;
    isEmergencyKit?: boolean;
  },
  context?: AuditContext
) {
  const existingCode = await prisma.inventoryItem.findUnique({
    where: { itemCode: input.itemCode },
  });
  if (existingCode) {
    throw new AppError(`Inventory item code '${input.itemCode}' already exists`, 400);
  }

  if (input.barcode) {
    const existingBarcode = await prisma.inventoryItem.findUnique({
      where: { barcode: input.barcode },
    });
    if (existingBarcode) {
      throw new AppError(`Barcode '${input.barcode}' is already in use by item ${existingBarcode.itemCode}`, 400);
    }
  }

  const item = await prisma.inventoryItem.create({
    data: {
      itemCode: input.itemCode.trim(),
      name: input.name.trim(),
      category: input.category,
      subCategory: input.subCategory,
      unit: input.unit || 'PIECE',
      barcode: input.barcode ? input.barcode.trim() : null,
      sku: input.itemCode.trim(),
      reorderLevel: input.reorderLevel !== undefined ? input.reorderLevel : 10,
      unitPrice: new Prisma.Decimal(input.unitPrice || 0),
      contrastType: input.contrastType,
      concentration: input.concentration,
      packSize: input.packSize,
      filmSize: input.filmSize,
      isEmergencyKit: input.isEmergencyKit || false,
      active: true,
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'INVENTORY_ITEM_CREATED',
    entityType: 'InventoryItem',
    entityId: item.id,
    details: { itemCode: item.itemCode, name: item.name, category: item.category },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return item;
}

export async function updateInventoryItem(
  idOrCode: string,
  input: Partial<{
    name: string;
    category: string;
    subCategory: string;
    unit: string;
    barcode: string;
    reorderLevel: number;
    unitPrice: number;
    contrastType: string;
    concentration: string;
    packSize: string;
    filmSize: string;
    isEmergencyKit: boolean;
    active: boolean;
  }>,
  context?: AuditContext
) {
  const item = await getItemMasterById(idOrCode);

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      ...(input.name && { name: input.name.trim() }),
      ...(input.category && { category: input.category }),
      ...(input.subCategory !== undefined && { subCategory: input.subCategory }),
      ...(input.unit && { unit: input.unit }),
      ...(input.barcode !== undefined && { barcode: input.barcode }),
      ...(input.reorderLevel !== undefined && { reorderLevel: input.reorderLevel }),
      ...(input.unitPrice !== undefined && { unitPrice: new Prisma.Decimal(input.unitPrice) }),
      ...(input.contrastType !== undefined && { contrastType: input.contrastType }),
      ...(input.concentration !== undefined && { concentration: input.concentration }),
      ...(input.packSize !== undefined && { packSize: input.packSize }),
      ...(input.filmSize !== undefined && { filmSize: input.filmSize }),
      ...(input.isEmergencyKit !== undefined && { isEmergencyKit: input.isEmergencyKit }),
      ...(input.active !== undefined && { active: input.active }),
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'INVENTORY_ITEM_UPDATED',
    entityType: 'InventoryItem',
    entityId: updated.id,
    details: { itemCode: updated.itemCode, changes: input },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

// =============================================================
// 2 & 4. STOCK RECEIPT / PURCHASE ENTRY & BATCH/LOT TRACKING
// =============================================================
export async function recordStockReceipt(
  input: {
    poNumber?: string;
    supplierName: string;
    invoiceNumber?: string;
    itemId: string;
    batchNumber: string;
    expiryDate: Date | string;
    quantity: number;
    unitCost: number;
    location: string;
    receivedById: string;
    receivedByName?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  if (input.quantity <= 0) {
    throw new AppError('Received quantity must be greater than zero', 400);
  }

  const expDate = new Date(input.expiryDate);
  if (isNaN(expDate.getTime())) {
    throw new AppError('Invalid expiry date', 400);
  }

  const item = await getItemMasterById(input.itemId);

  const po = input.poNumber || generatePoNumber();
  const unitCostDecimal = new Prisma.Decimal(input.unitCost || 0);
  const totalValue = unitCostDecimal.mul(input.quantity);

  // Execute atomic receipt
  return await prisma.$transaction(async (tx) => {
    // 1. Record Supplier Purchase entry if PO doesn't exist
    await tx.supplierPurchase.upsert({
      where: { poNumber: po },
      create: {
        poNumber: po,
        supplierName: input.supplierName,
        invoiceNumber: input.invoiceNumber,
        totalAmount: totalValue,
        status: 'RECEIVED',
        receivedById: input.receivedById,
      },
      update: {
        totalAmount: { increment: totalValue },
      },
    });

    // 2. Find or create batch
    let batch = await tx.inventoryBatch.findUnique({
      where: {
        itemId_batchNumber: {
          itemId: item.id,
          batchNumber: input.batchNumber.trim(),
        },
      },
    });

    if (batch) {
      batch = await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          currentQuantity: { increment: input.quantity },
          initialQuantity: { increment: input.quantity },
          expiryDate: expDate,
          unitCost: unitCostDecimal,
          supplierName: input.supplierName,
          purchaseInvoice: input.invoiceNumber,
        },
      });
    } else {
      batch = await tx.inventoryBatch.create({
        data: {
          itemId: item.id,
          batchNumber: input.batchNumber.trim(),
          supplierName: input.supplierName,
          purchaseInvoice: input.invoiceNumber,
          expiryDate: expDate,
          initialQuantity: input.quantity,
          currentQuantity: input.quantity,
          unitCost: unitCostDecimal,
          isBlocked: false,
        },
      });
    }

    // 3. Update Location Stock
    const locStock = await tx.locationStock.upsert({
      where: {
        location_itemId_batchId: {
          location: input.location,
          itemId: item.id,
          batchId: batch.id,
        },
      },
      create: {
        location: input.location,
        itemId: item.id,
        batchId: batch.id,
        quantity: input.quantity,
      },
      update: {
        quantity: { increment: input.quantity },
      },
    });

    // 4. Update cached quantity on Item
    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity: { increment: input.quantity },
      },
    });

    // 5. Create immutable StockTransaction ledger entry
    const balanceBefore = item.quantity;
    const balanceAfter = updatedItem.quantity;
    const txn = await tx.stockTransaction.create({
      data: {
        transactionNumber: generateTxnNumber(),
        type: 'PURCHASE_RECEIPT',
        itemId: item.id,
        batchId: batch.id,
        sourceLocation: null,
        targetLocation: input.location,
        quantity: input.quantity,
        balanceBefore,
        balanceAfter,
        unitCost: unitCostDecimal,
        totalValue,
        reference: `PO: ${po} / INV: ${input.invoiceNumber || 'N/A'}`,
        reason: input.notes || 'Purchase receipt from supplier',
        performedById: input.receivedById,
        performedByName: input.receivedByName || 'Inventory Clerk',
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.receivedById,
      action: 'STOCK_PURCHASE_RECEIPT',
      entityType: 'StockTransaction',
      entityId: txn.id,
      details: {
        poNumber: po,
        itemCode: item.itemCode,
        batchNumber: batch.batchNumber,
        quantity: input.quantity,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      transaction: txn,
      batch,
      locationStock: locStock,
      item: updatedItem,
    };
  });
}

// =============================================================
// 3. BARCODE / QR SCANNER RESOLUTION
// =============================================================
export async function resolveByBarcodeOrSku(scanCode: string) {
  await ensureDefaultInventoryCatalog();

  const code = scanCode.trim();

  // Try direct barcode / code / sku match
  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: [
        { barcode: code },
        { itemCode: code },
        { sku: code },
      ],
    },
    include: {
      batches: {
        where: { currentQuantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      },
      locationStocks: {
        where: { quantity: { gt: 0 } },
      },
    },
  });

  if (item) {
    const now = new Date();
    return {
      matchType: 'ITEM',
      item,
      availableBatches: item.batches.map((b) => ({
        ...b,
        isExpired: b.expiryDate <= now,
      })),
      locations: item.locationStocks,
    };
  }

  // Try batch number match
  const batch = await prisma.inventoryBatch.findFirst({
    where: { batchNumber: code },
    include: {
      item: true,
      locationStocks: {
        where: { quantity: { gt: 0 } },
      },
    },
  });

  if (batch) {
    const now = new Date();
    return {
      matchType: 'BATCH',
      batch: {
        ...batch,
        isExpired: batch.expiryDate <= now,
      },
      item: batch.item,
      locations: batch.locationStocks,
    };
  }

  throw new AppError(`No inventory item or batch resolved for scan code '${code}'`, 404);
}

// =============================================================
// 4 & 5. BATCH MANAGEMENT, EXPIRY ALERTS & EXPIRY BLOCKING
// =============================================================
export async function listBatches(filters?: {
  itemId?: string;
  supplierName?: string;
  nearExpiryDays?: number;
  includeBlocked?: boolean;
}) {
  const where: Prisma.InventoryBatchWhereInput = {};

  if (filters?.itemId) {
    where.itemId = filters.itemId;
  }
  if (filters?.supplierName) {
    where.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
  }
  if (!filters?.includeBlocked) {
    where.isBlocked = false;
  }

  const now = new Date();
  const nearDays = filters?.nearExpiryDays || 60;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + nearDays);

  const batches = await prisma.inventoryBatch.findMany({
    where,
    include: {
      item: true,
      locationStocks: true,
    },
    orderBy: { expiryDate: 'asc' },
  });

  return batches.map((b) => {
    const isExpired = b.expiryDate <= now;
    const isNearExpiry = !isExpired && b.expiryDate <= thresholdDate;
    const daysUntilExpiry = Math.ceil((b.expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    return {
      ...b,
      isExpired,
      isNearExpiry,
      daysUntilExpiry,
      status: b.isBlocked ? 'BLOCKED' : isExpired ? 'EXPIRED' : isNearExpiry ? 'NEAR_EXPIRY' : 'ACTIVE',
    };
  });
}

export async function updateBatchStatus(
  batchId: string,
  input: { isBlocked: boolean; blockReason?: string },
  context?: AuditContext
) {
  const batch = await prisma.inventoryBatch.findUnique({
    where: { id: batchId },
    include: { item: true },
  });

  if (!batch) {
    throw new AppError(`Batch '${batchId}' not found`, 404);
  }

  const updated = await prisma.inventoryBatch.update({
    where: { id: batchId },
    data: {
      isBlocked: input.isBlocked,
      blockReason: input.blockReason || (input.isBlocked ? 'Quarantined by staff' : null),
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: input.isBlocked ? 'BATCH_BLOCKED_QUARANTINE' : 'BATCH_UNBLOCKED',
    entityType: 'InventoryBatch',
    entityId: batch.id,
    details: { batchNumber: batch.batchNumber, itemCode: batch.item.itemCode, reason: input.blockReason },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

export async function getExpiryAlerts(options?: { nearExpiryDays?: number; location?: string }) {
  const now = new Date();
  const nearDays = options?.nearExpiryDays || 60;
  const nearThreshold = new Date();
  nearThreshold.setDate(nearThreshold.getDate() + nearDays);

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      currentQuantity: { gt: 0 },
      expiryDate: { lte: nearThreshold },
    },
    include: {
      item: true,
      locationStocks: {
        where: options?.location ? { location: options.location } : undefined,
      },
    },
    orderBy: { expiryDate: 'asc' },
  });

  const expired: any[] = [];
  const nearExpiry: any[] = [];

  for (const b of batches) {
    const isExpired = b.expiryDate <= now;
    const daysRemaining = Math.ceil((b.expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const payload = {
      batchId: b.id,
      batchNumber: b.batchNumber,
      itemCode: b.item.itemCode,
      itemName: b.item.name,
      category: b.item.category,
      unit: b.item.unit,
      expiryDate: b.expiryDate,
      daysRemaining,
      currentQuantity: b.currentQuantity,
      isBlocked: b.isBlocked,
      locations: b.locationStocks.map((ls) => ({ location: ls.location, quantity: ls.quantity })),
    };

    if (isExpired) {
      expired.push(payload);
    } else {
      nearExpiry.push(payload);
    }
  }

  return {
    asOf: now,
    nearExpiryDaysThreshold: nearDays,
    expiredCount: expired.length,
    nearExpiryCount: nearExpiry.length,
    expired,
    nearExpiry,
  };
}

// =============================================================
// 6. FIRST-EXPIRY-FIRST-OUT (FEFO) RECOMMENDATION
// =============================================================
export async function getFefoRecommendation(
  itemId: string,
  location: string,
  requiredQuantity: number
) {
  if (requiredQuantity <= 0) {
    throw new AppError('Required quantity must be positive', 400);
  }

  const now = new Date();

  // Find location stocks for non-blocked, unexpired batches sorted strictly by earliest expiry
  const eligibleStocks = await prisma.locationStock.findMany({
    where: {
      itemId,
      location,
      quantity: { gt: 0 },
      batch: {
        isBlocked: false,
        expiryDate: { gt: now },
      },
    },
    include: {
      batch: true,
      item: true,
    },
    orderBy: {
      batch: { expiryDate: 'asc' }, // FEFO: Earliest Expiry First Out
    },
  });

  const totalEligible = eligibleStocks.reduce((sum, s) => sum + s.quantity, 0);
  if (totalEligible < requiredQuantity) {
    throw new AppError(
      `FEFO: Insufficient eligible unexpired stock in ${location}. Available: ${totalEligible}, Required: ${requiredQuantity}`,
      400
    );
  }

  let remainingToAllocate = requiredQuantity;
  const allocations: Array<{
    batchId: string;
    batchNumber: string;
    expiryDate: Date;
    availableInLocation: number;
    allocatedQuantity: number;
  }> = [];

  for (const stock of eligibleStocks) {
    if (remainingToAllocate <= 0) break;

    const alloc = Math.min(stock.quantity, remainingToAllocate);
    allocations.push({
      batchId: stock.batchId,
      batchNumber: stock.batch.batchNumber,
      expiryDate: stock.batch.expiryDate,
      availableInLocation: stock.quantity,
      allocatedQuantity: alloc,
    });

    remainingToAllocate -= alloc;
  }

  return {
    itemId,
    location,
    requiredQuantity,
    totalEligibleAvailable: totalEligible,
    allocations,
  };
}

// =============================================================
// 7 & 16. STORE / CABINET LOCATIONS & TRANSFERS / ADJUSTMENTS
// =============================================================
export async function getLocationStockSummary(location?: string) {
  await ensureDefaultInventoryCatalog();

  const where: Prisma.LocationStockWhereInput = {
    quantity: { gt: 0 },
  };
  if (location) {
    where.location = location;
  }

  const stocks = await prisma.locationStock.findMany({
    where,
    include: {
      item: true,
      batch: true,
    },
    orderBy: [{ location: 'asc' }, { item: { name: 'asc' } }],
  });

  // Group by location
  const byLocation: Record<string, any[]> = {};
  for (const s of stocks) {
    if (!byLocation[s.location]) {
      byLocation[s.location] = [];
    }
    byLocation[s.location].push(s);
  }

  return {
    locations: VALID_LOCATIONS,
    stocks,
    grouped: byLocation,
  };
}

export async function transferStock(
  input: {
    itemId: string;
    batchId: string;
    sourceLocation: string;
    targetLocation: string;
    quantity: number;
    reason?: string;
    performedById: string;
    performedByName?: string;
  },
  context?: AuditContext
) {
  if (input.quantity <= 0) {
    throw new AppError('Transfer quantity must be greater than zero', 400);
  }
  if (input.sourceLocation === input.targetLocation) {
    throw new AppError('Source and target location cannot be the same', 400);
  }

  return await prisma.$transaction(async (tx) => {
    const sourceStock = await tx.locationStock.findUnique({
      where: {
        location_itemId_batchId: {
          location: input.sourceLocation,
          itemId: input.itemId,
          batchId: input.batchId,
        },
      },
      include: { item: true, batch: true },
    });

    if (!sourceStock || sourceStock.quantity < input.quantity) {
      throw new AppError(
        `Insufficient stock in ${input.sourceLocation} to transfer ${input.quantity}. Available: ${sourceStock?.quantity || 0}`,
        400
      );
    }

    // Decrement source
    await tx.locationStock.update({
      where: { id: sourceStock.id },
      data: { quantity: { decrement: input.quantity } },
    });

    // Increment target
    await tx.locationStock.upsert({
      where: {
        location_itemId_batchId: {
          location: input.targetLocation,
          itemId: input.itemId,
          batchId: input.batchId,
        },
      },
      create: {
        location: input.targetLocation,
        itemId: input.itemId,
        batchId: input.batchId,
        quantity: input.quantity,
      },
      update: {
        quantity: { increment: input.quantity },
      },
    });

    // Record StockTransaction
    const txn = await tx.stockTransaction.create({
      data: {
        transactionNumber: generateTxnNumber(),
        type: 'TRANSFER',
        itemId: input.itemId,
        batchId: input.batchId,
        sourceLocation: input.sourceLocation,
        targetLocation: input.targetLocation,
        quantity: input.quantity,
        balanceBefore: sourceStock.item.quantity,
        balanceAfter: sourceStock.item.quantity, // overall item total doesn't change on internal transfer
        reason: input.reason || `Transfer from ${input.sourceLocation} to ${input.targetLocation}`,
        performedById: input.performedById,
        performedByName: input.performedByName || 'Inventory Staff',
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.performedById,
      action: 'STOCK_TRANSFERRED',
      entityType: 'StockTransaction',
      entityId: txn.id,
      details: {
        itemId: input.itemId,
        batchId: input.batchId,
        from: input.sourceLocation,
        to: input.targetLocation,
        quantity: input.quantity,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return txn;
  });
}

export async function adjustStock(
  input: {
    itemId: string;
    batchId: string;
    location: string;
    adjustmentType: 'DAMAGE' | 'RETURN' | 'CORRECTION';
    quantityChange: number; // positive to add stock, negative to reduce
    reason: string;
    performedById: string;
    performedByName?: string;
  },
  context?: AuditContext
) {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new AppError('A non-empty reason is strictly required for stock adjustment', 400);
  }
  if (input.quantityChange === 0) {
    throw new AppError('Adjustment quantity cannot be zero', 400);
  }

  return await prisma.$transaction(async (tx) => {
    const locStock = await tx.locationStock.findUnique({
      where: {
        location_itemId_batchId: {
          location: input.location,
          itemId: input.itemId,
          batchId: input.batchId,
        },
      },
      include: { item: true, batch: true },
    });

    if (input.quantityChange < 0 && (!locStock || locStock.quantity < Math.abs(input.quantityChange))) {
      throw new AppError(
        `Cannot reduce stock by ${Math.abs(input.quantityChange)}. Available in ${input.location}: ${locStock?.quantity || 0}`,
        400
      );
    }

    // Update location stock
    const updatedLocStock = await tx.locationStock.upsert({
      where: {
        location_itemId_batchId: {
          location: input.location,
          itemId: input.itemId,
          batchId: input.batchId,
        },
      },
      create: {
        location: input.location,
        itemId: input.itemId,
        batchId: input.batchId,
        quantity: Math.max(0, input.quantityChange),
      },
      update: {
        quantity: { increment: input.quantityChange },
      },
    });

    // Update batch quantity
    await tx.inventoryBatch.update({
      where: { id: input.batchId },
      data: { currentQuantity: { increment: input.quantityChange } },
    });

    // Update item total
    const item = await tx.inventoryItem.update({
      where: { id: input.itemId },
      data: { quantity: { increment: input.quantityChange } },
    });

    const txnType =
      input.adjustmentType === 'DAMAGE'
        ? 'ADJUSTMENT_DAMAGE'
        : input.adjustmentType === 'RETURN'
        ? 'ADJUSTMENT_RETURN'
        : 'ADJUSTMENT_CORRECTION';

    const txn = await tx.stockTransaction.create({
      data: {
        transactionNumber: generateTxnNumber(),
        type: txnType,
        itemId: input.itemId,
        batchId: input.batchId,
        sourceLocation: input.quantityChange < 0 ? input.location : null,
        targetLocation: input.quantityChange > 0 ? input.location : null,
        quantity: Math.abs(input.quantityChange),
        balanceBefore: item.quantity - input.quantityChange,
        balanceAfter: item.quantity,
        reason: input.reason,
        performedById: input.performedById,
        performedByName: input.performedByName || 'Inventory Supervisor',
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.performedById,
      action: `STOCK_ADJUSTMENT_${input.adjustmentType}`,
      entityType: 'StockTransaction',
      entityId: txn.id,
      details: {
        itemId: input.itemId,
        batchId: input.batchId,
        location: input.location,
        quantityChange: input.quantityChange,
        reason: input.reason,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { transaction: txn, locationStock: updatedLocStock, item };
  });
}

// =============================================================
// 8. CONTRAST AGENT CATALOG
// =============================================================
export async function getContrastCatalog(type?: 'IODINATED' | 'GADOLINIUM') {
  await ensureDefaultInventoryCatalog();

  const where: Prisma.InventoryItemWhereInput = {
    category: 'CONTRAST',
    active: true,
  };
  if (type) {
    where.contrastType = type;
  }

  const contrasts = await prisma.inventoryItem.findMany({
    where,
    include: {
      batches: {
        where: {
          currentQuantity: { gt: 0 },
          isBlocked: false,
          expiryDate: { gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
      },
      locationStocks: {
        where: { quantity: { gt: 0 } },
      },
    },
    orderBy: { name: 'asc' },
  });

  return contrasts.map((c) => ({
    ...c,
    availableEligibleStock: c.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0),
    earliestExpiry: c.batches[0]?.expiryDate || null,
  }));
}

// =============================================================
// 9. CONTRAST ISSUE / ADMINISTRATION (LINKED TO PATIENT & ORDER)
// =============================================================
export async function issueContrastToPatient(
  input: {
    orderId: string;
    patientId: string;
    itemId: string;
    batchId?: string;
    location: string;
    quantity: number; // vials
    volumeMl?: number;
    administeredById: string;
    administeredByName?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  if (input.quantity <= 0) {
    throw new AppError('Issue quantity must be at least 1 vial', 400);
  }

  // Validate patient and order exist
  const order = await prisma.imagingOrder.findUnique({
    where: { id: input.orderId },
    include: { patient: true },
  });
  if (!order) {
    throw new AppError(`Imaging order '${input.orderId}' not found`, 404);
  }

  const item = await getItemMasterById(input.itemId);
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    let chosenBatchId = input.batchId;

    // If batch not explicitly chosen, select via FEFO
    if (!chosenBatchId) {
      const eligible = await tx.locationStock.findFirst({
        where: {
          itemId: item.id,
          location: input.location,
          quantity: { gte: input.quantity },
          batch: {
            isBlocked: false,
            expiryDate: { gt: now },
          },
        },
        include: { batch: true },
        orderBy: { batch: { expiryDate: 'asc' } },
      });

      if (!eligible) {
        throw new AppError(
          `No eligible non-expired batch found in ${input.location} for item ${item.name}`,
          400
        );
      }
      chosenBatchId = eligible.batchId;
    }

    // Verify batch is not expired or blocked
    const batch = await tx.inventoryBatch.findUnique({
      where: { id: chosenBatchId },
    });
    if (!batch) {
      throw new AppError(`Batch '${chosenBatchId}' not found`, 404);
    }
    if (batch.isBlocked) {
      throw new AppError(`Batch '${batch.batchNumber}' is blocked/quarantined and cannot be dispensed`, 400);
    }
    if (batch.expiryDate <= now) {
      throw new AppError(`Batch '${batch.batchNumber}' expired on ${batch.expiryDate.toISOString()} and is blocked`, 400);
    }

    // Check location stock
    const locStock = await tx.locationStock.findUnique({
      where: {
        location_itemId_batchId: {
          location: input.location,
          itemId: item.id,
          batchId: batch.id,
        },
      },
    });

    if (!locStock || locStock.quantity < input.quantity) {
      throw new AppError(
        `Insufficient stock for batch ${batch.batchNumber} in ${input.location}. Available: ${locStock?.quantity || 0}`,
        400
      );
    }

    // Decrement location stock
    await tx.locationStock.update({
      where: { id: locStock.id },
      data: { quantity: { decrement: input.quantity } },
    });

    // Decrement batch stock
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { currentQuantity: { decrement: input.quantity } },
    });

    // Decrement item aggregate
    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: input.quantity } },
    });

    // Create StockTransaction linked to order & patient
    const txn = await tx.stockTransaction.create({
      data: {
        transactionNumber: generateTxnNumber(),
        type: 'ISSUE_CLINICAL',
        itemId: item.id,
        batchId: batch.id,
        sourceLocation: input.location,
        targetLocation: null,
        quantity: input.quantity,
        balanceBefore: item.quantity,
        balanceAfter: updatedItem.quantity,
        orderId: order.id,
        patientId: order.patientId,
        reference: `Accession: ${order.accessionNumber}`,
        reason: input.notes || `Contrast administration for ${order.examinationName}`,
        performedById: input.administeredById,
        performedByName: input.administeredByName || 'Technologist',
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.administeredById,
      action: 'CONTRAST_DISPENSED_TO_PATIENT',
      entityType: 'StockTransaction',
      entityId: txn.id,
      details: {
        orderId: order.id,
        accession: order.accessionNumber,
        patientId: order.patient.patientId,
        itemCode: item.itemCode,
        batchNumber: batch.batchNumber,
        quantity: input.quantity,
        volumeMl: input.volumeMl,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      transaction: txn,
      batch,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
    };
  });
}

// =============================================================
// 10. OPENED-VIAL / WASTAGE LOG
// =============================================================
export async function recordWastage(
  input: {
    itemId: string;
    batchId?: string;
    location: string;
    quantity: number; // vials or units
    volumeUsedMl?: number;
    volumeWastedMl?: number;
    reason: string; // "PARTIAL_VIAL_REMAINDER", "CONTAMINATION", "EXPIRED", "SPILLAGE"
    orderId?: string;
    patientId?: string;
    recordedById: string;
    recordedByName?: string;
  },
  context?: AuditContext
) {
  if (input.quantity <= 0) {
    throw new AppError('Wastage quantity must be at least 1 unit', 400);
  }
  if (!input.reason) {
    throw new AppError('Wastage reason is required', 400);
  }

  const item = await getItemMasterById(input.itemId);

  return await prisma.$transaction(async (tx) => {
    let batchId = input.batchId;
    if (!batchId) {
      const firstStock = await tx.locationStock.findFirst({
        where: {
          itemId: item.id,
          location: input.location,
          quantity: { gte: input.quantity },
        },
      });
      if (firstStock) {
        batchId = firstStock.batchId;
      }
    }

    if (batchId) {
      const locStock = await tx.locationStock.findUnique({
        where: {
          location_itemId_batchId: {
            location: input.location,
            itemId: item.id,
            batchId,
          },
        },
      });

      if (locStock && locStock.quantity >= input.quantity) {
        await tx.locationStock.update({
          where: { id: locStock.id },
          data: { quantity: { decrement: input.quantity } },
        });

        await tx.inventoryBatch.update({
          where: { id: batchId },
          data: { currentQuantity: { decrement: input.quantity } },
        });
      }
    }

    // Update item total
    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: input.quantity } },
    });

    // Create WastageLog
    const wastage = await tx.wastageLog.create({
      data: {
        wastageNumber: generateWastageNumber(),
        itemId: item.id,
        batchId: batchId || null,
        location: input.location,
        quantity: input.quantity,
        volumeUsedMl: input.volumeUsedMl ? new Prisma.Decimal(input.volumeUsedMl) : null,
        volumeWastedMl: input.volumeWastedMl ? new Prisma.Decimal(input.volumeWastedMl) : null,
        reason: input.reason,
        orderId: input.orderId || null,
        patientId: input.patientId || null,
        recordedById: input.recordedById,
        recordedByName: input.recordedByName || 'Staff',
      },
    });

    // Create StockTransaction
    await tx.stockTransaction.create({
      data: {
        transactionNumber: generateTxnNumber(),
        type: 'WASTAGE',
        itemId: item.id,
        batchId: batchId || null,
        sourceLocation: input.location,
        targetLocation: null,
        quantity: input.quantity,
        balanceBefore: item.quantity,
        balanceAfter: updatedItem.quantity,
        orderId: input.orderId,
        patientId: input.patientId,
        reason: `Wastage: ${input.reason} (Log: ${wastage.wastageNumber})`,
        performedById: input.recordedById,
        performedByName: input.recordedByName || 'Staff',
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.recordedById,
      action: 'INVENTORY_WASTAGE_RECORDED',
      entityType: 'WastageLog',
      entityId: wastage.id,
      details: {
        wastageNumber: wastage.wastageNumber,
        itemCode: item.itemCode,
        quantity: input.quantity,
        reason: input.reason,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return wastage;
  });
}

export async function listWastageLogs(location?: string) {
  const where: Prisma.WastageLogWhereInput = {};
  if (location) where.location = location;
  return prisma.wastageLog.findMany({
    where,
    include: { item: true },
    orderBy: { recordedAt: 'desc' },
    take: 100,
  });
}

// =============================================================
// 11 & 12. MEDICINE / EMERGENCY KIT REGISTER & CHECKLISTS
// =============================================================
export async function getEmergencyKitRegister(location?: string) {
  await ensureDefaultInventoryCatalog();

  const where: Prisma.InventoryItemWhereInput = {
    OR: [{ isEmergencyKit: true }, { category: 'EMERGENCY_KIT' }, { category: 'MEDICINE' }],
    active: true,
  };

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      locationStocks: {
        where: location ? { location } : undefined,
      },
      batches: {
        where: { currentQuantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const now = new Date();
  return items.map((it) => {
    const totalQty = it.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
    const earliestBatch = it.batches[0];
    const isExpired = earliestBatch ? earliestBatch.expiryDate <= now : false;

    return {
      ...it,
      currentTotalStock: totalQty,
      earliestBatch: earliestBatch?.batchNumber || null,
      earliestExpiry: earliestBatch?.expiryDate || null,
      isExpired,
      status: isExpired ? 'EXPIRED' : totalQty <= it.reorderLevel ? 'LOW_STOCK' : 'ADEQUATE',
    };
  });
}

export async function recordEmergencyChecklist(
  input: {
    location: string;
    notes?: string;
    checkedById: string;
    checkedByName: string;
    items: Array<{
      itemId: string;
      batchId?: string;
      status: 'ACCEPTABLE' | 'EXPIRED' | 'LOW_STOCK' | 'REPLACED' | 'MISSING';
      currentStock: number;
      expiryDate?: Date | string;
      replacementDone?: boolean;
      replacementBatch?: string;
      remarks?: string;
    }>;
  },
  context?: AuditContext
) {
  if (!input.items || input.items.length === 0) {
    throw new AppError('Checklist must contain at least one inspected item', 400);
  }

  const checklistNumber = generateChecklistNumber();
  const hasActionRequired = input.items.some(
    (it) => it.status === 'EXPIRED' || it.status === 'MISSING' || (it.status === 'LOW_STOCK' && !it.replacementDone)
  );

  return await prisma.$transaction(async (tx) => {
    const checklist = await tx.emergencyChecklist.create({
      data: {
        checklistNumber,
        location: input.location,
        status: hasActionRequired ? 'ACTION_REQUIRED' : 'COMPLETED',
        checkedById: input.checkedById,
        checkedByName: input.checkedByName,
        notes: input.notes,
        items: {
          create: input.items.map((it) => ({
            itemId: it.itemId,
            batchId: it.batchId || null,
            status: it.status,
            currentStock: it.currentStock,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
            replacementDone: it.replacementDone || false,
            replacementBatch: it.replacementBatch || null,
            remarks: it.remarks || null,
          })),
        },
      },
      include: {
        items: {
          include: { item: true },
        },
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.checkedById,
      action: 'EMERGENCY_KIT_CHECKLIST_SUBMITTED',
      entityType: 'EmergencyChecklist',
      entityId: checklist.id,
      details: {
        checklistNumber: checklist.checklistNumber,
        location: input.location,
        status: checklist.status,
        itemCount: input.items.length,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return checklist;
  });
}

export async function listEmergencyChecklists(location?: string) {
  const where: Prisma.EmergencyChecklistWhereInput = {};
  if (location) {
    where.location = location;
  }

  return await prisma.emergencyChecklist.findMany({
    where,
    include: {
      items: {
        include: { item: true },
      },
    },
    orderBy: { checkedAt: 'desc' },
  });
}

// =============================================================
// 13. FILM STOCK & FILM COUNTING
// =============================================================
export async function getFilmStockSummary() {
  await ensureDefaultInventoryCatalog();

  const filmItems = await prisma.inventoryItem.findMany({
    where: { category: 'FILM', active: true },
    include: {
      locationStocks: true,
      batches: {
        where: { currentQuantity: { gt: 0 } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const summary = await Promise.all(
    filmItems.map(async (item) => {
      // Aggregate transactions for received, printed, spoiled
      const txns = await prisma.stockTransaction.findMany({
        where: { itemId: item.id },
      });

      const totalReceived = txns
        .filter((t) => t.type === 'PURCHASE_RECEIPT')
        .reduce((sum, t) => sum + t.quantity, 0);

      const totalPrinted = txns
        .filter((t) => t.type === 'FILM_PRINT')
        .reduce((sum, t) => sum + t.quantity, 0);

      const totalSpoiled = txns
        .filter((t) => t.type === 'FILM_SPOIL')
        .reduce((sum, t) => sum + t.quantity, 0);

      const currentBalance = item.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);

      return {
        id: item.id,
        itemId: item.id,
        itemCode: item.itemCode,
        name: item.name,
        filmSize: item.filmSize || 'Standard',
        currentPhysicalStock: currentBalance,
        reorderLevel: item.reorderLevel,
        batches: item.batches,
        totalReceived,
        totalPrinted,
        totalSpoiled,
        closingBalance: currentBalance,
        reorderAlert: currentBalance <= item.reorderLevel,
      };
    })
  );

  return summary;
}

export async function recordFilmUsage(
  input: {
    itemId: string;
    location: string;
    printedQty: number;
    spoiledQty: number;
    orderId?: string;
    patientId?: string;
    performedById: string;
    performedByName?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  const totalDeduction = input.printedQty + input.spoiledQty;
  if (totalDeduction <= 0) {
    throw new AppError('Total film count (printed + spoiled) must be greater than zero', 400);
  }

  const item = await getItemMasterById(input.itemId);

  return await prisma.$transaction(async (tx) => {
    // Check stock
    const locStock = await tx.locationStock.findFirst({
      where: {
        itemId: item.id,
        location: input.location,
        quantity: { gte: totalDeduction },
      },
      include: { batch: true },
      orderBy: { batch: { expiryDate: 'asc' } },
    });

    if (!locStock) {
      throw new AppError(
        `Insufficient film stock in ${input.location} for ${item.name}. Required: ${totalDeduction}`,
        400
      );
    }

    // Decrement location stock
    await tx.locationStock.update({
      where: { id: locStock.id },
      data: { quantity: { decrement: totalDeduction } },
    });

    // Decrement batch
    await tx.inventoryBatch.update({
      where: { id: locStock.batchId },
      data: { currentQuantity: { decrement: totalDeduction } },
    });

    // Decrement item aggregate
    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: totalDeduction } },
    });

    // Record FILM_PRINT transaction if > 0
    if (input.printedQty > 0) {
      await tx.stockTransaction.create({
        data: {
          transactionNumber: generateTxnNumber(),
          type: 'FILM_PRINT',
          itemId: item.id,
          batchId: locStock.batchId,
          sourceLocation: input.location,
          targetLocation: null,
          quantity: input.printedQty,
          balanceBefore: item.quantity,
          balanceAfter: item.quantity - input.printedQty,
          orderId: input.orderId || null,
          patientId: input.patientId || null,
          reason: input.notes || 'Physical film printed for diagnostic report',
          performedById: input.performedById,
          performedByName: input.performedByName || 'Technologist',
        },
      });
    }

    // Record FILM_SPOIL transaction if > 0
    if (input.spoiledQty > 0) {
      await tx.stockTransaction.create({
        data: {
          transactionNumber: generateTxnNumber(),
          type: 'FILM_SPOIL',
          itemId: item.id,
          batchId: locStock.batchId,
          sourceLocation: input.location,
          targetLocation: null,
          quantity: input.spoiledQty,
          balanceBefore: item.quantity - input.printedQty,
          balanceAfter: updatedItem.quantity,
          orderId: input.orderId || null,
          patientId: input.patientId || null,
          reason: input.notes || 'Spoiled/jammed exposure sheet',
          performedById: input.performedById,
          performedByName: input.performedByName || 'Technologist',
        },
      });
    }

    await logAuditEvent({
      userId: context?.userId || input.performedById,
      action: 'FILM_STOCK_CONSUMED',
      entityType: 'InventoryItem',
      entityId: item.id,
      details: {
        printedQty: input.printedQty,
        spoiledQty: input.spoiledQty,
        location: input.location,
        orderId: input.orderId,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      itemId: item.id,
      printed: input.printedQty,
      spoiled: input.spoiledQty,
      closingBalance: updatedItem.quantity,
    };
  });
}

// =============================================================
// 14. CONSUMABLE USAGE BY SCAN
// =============================================================
export async function recordScanConsumables(
  input: {
    orderId: string;
    patientId: string;
    location: string;
    recordedById: string;
    recordedByName?: string;
    consumables: Array<{
      itemId: string;
      batchId?: string;
      quantity: number;
      notes?: string;
    }>;
  },
  context?: AuditContext
) {
  if (!input.consumables || input.consumables.length === 0) {
    throw new AppError('At least one consumable item must be specified', 400);
  }

  const order = await prisma.imagingOrder.findUnique({
    where: { id: input.orderId },
  });
  if (!order) {
    throw new AppError(`Imaging order '${input.orderId}' not found`, 404);
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const usages: any[] = [];

    for (const c of input.consumables) {
      if (c.quantity <= 0) continue;

      const item = await tx.inventoryItem.findUnique({ where: { id: c.itemId } });
      if (!item) {
        throw new AppError(`Consumable item '${c.itemId}' not found`, 404);
      }

      let chosenBatchId = c.batchId;
      if (!chosenBatchId) {
        const eligible = await tx.locationStock.findFirst({
          where: {
            itemId: item.id,
            location: input.location,
            quantity: { gte: c.quantity },
            batch: {
              isBlocked: false,
              expiryDate: { gt: now },
            },
          },
          include: { batch: true },
          orderBy: { batch: { expiryDate: 'asc' } },
        });

        if (!eligible) {
          throw new AppError(
            `Insufficient stock for consumable ${item.name} in ${input.location}`,
            400
          );
        }
        chosenBatchId = eligible.batchId;
      }

      // Deduct from location stock
      await tx.locationStock.updateMany({
        where: {
          location: input.location,
          itemId: item.id,
          batchId: chosenBatchId,
        },
        data: { quantity: { decrement: c.quantity } },
      });

      // Deduct from batch
      await tx.inventoryBatch.update({
        where: { id: chosenBatchId },
        data: { currentQuantity: { decrement: c.quantity } },
      });

      // Deduct from item aggregate
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: { decrement: c.quantity } },
      });

      // Create OrderConsumableUsage record
      const usage = await tx.orderConsumableUsage.create({
        data: {
          orderId: order.id,
          patientId: input.patientId,
          itemId: item.id,
          batchId: chosenBatchId,
          quantity: c.quantity,
          location: input.location,
          recordedById: input.recordedById,
          recordedByName: input.recordedByName || 'Technologist',
          notes: c.notes || null,
        },
      });
      usages.push(usage);

      // Create StockTransaction
      await tx.stockTransaction.create({
        data: {
          transactionNumber: generateTxnNumber(),
          type: 'ISSUE_CLINICAL',
          itemId: item.id,
          batchId: chosenBatchId,
          sourceLocation: input.location,
          targetLocation: null,
          quantity: c.quantity,
          balanceBefore: item.quantity,
          balanceAfter: updatedItem.quantity,
          orderId: order.id,
          patientId: input.patientId,
          reason: `Consumable for scan: ${c.notes || item.name}`,
          performedById: input.recordedById,
          performedByName: input.recordedByName || 'Technologist',
        },
      });
    }

    await logAuditEvent({
      userId: context?.userId || input.recordedById,
      action: 'SCAN_CONSUMABLES_RECORDED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        orderId: order.id,
        patientId: input.patientId,
        itemsCount: usages.length,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return usages;
  });
}

// =============================================================
// 15. MINIMUM STOCK / REORDER ALERTS
// =============================================================
export async function getReorderAlerts() {
  await ensureDefaultInventoryCatalog();

  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    include: {
      locationStocks: true,
      batches: {
        where: { currentQuantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const alerts: any[] = [];

  for (const it of items) {
    const totalPhysical = it.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
    if (totalPhysical <= it.reorderLevel) {
      const deficit = it.reorderLevel - totalPhysical;
      const suggestedOrderQty = Math.max(deficit * 2, it.reorderLevel);

      alerts.push({
        itemId: it.id,
        itemCode: it.itemCode,
        name: it.name,
        category: it.category,
        unit: it.unit,
        currentStock: totalPhysical,
        reorderLevel: it.reorderLevel,
        deficit,
        suggestedOrderQty,
        estimatedOrderCost: (it.unitPrice as any).mul
          ? (it.unitPrice as any).mul(suggestedOrderQty).toNumber()
          : Number(it.unitPrice) * suggestedOrderQty,
        preferredSupplier: it.batches[0]?.supplierName || 'Default Vendor',
      });
    }
  }

  return {
    asOf: new Date(),
    alertCount: alerts.length,
    alerts,
  };
}

// =============================================================
// 17. PHYSICAL STOCK AUDIT
// =============================================================
export async function recordStockAudit(
  input: {
    location: string;
    notes?: string;
    auditedById: string;
    auditedByName: string;
    items: Array<{
      itemId: string;
      batchId?: string;
      countedQty: number;
      discrepancyReason?: string;
      autoReconcile?: boolean;
    }>;
  },
  context?: AuditContext
) {
  if (!input.items || input.items.length === 0) {
    throw new AppError('Audit must inspect at least one stock item', 400);
  }

  const auditNumber = generateAuditNumber();

  return await prisma.$transaction(async (tx) => {
    let totalNetVariance = 0;
    const auditItemsData: any[] = [];

    for (const entry of input.items) {
      // Find expected stock
      let expected: number;

      if (entry.batchId) {
        const targetLocStock = await tx.locationStock.findUnique({
          where: {
            location_itemId_batchId: {
              location: input.location,
              itemId: entry.itemId,
              batchId: entry.batchId,
            },
          },
        });
        expected = targetLocStock?.quantity || 0;
      } else {
        const stocks = await tx.locationStock.findMany({
          where: {
            location: input.location,
            itemId: entry.itemId,
          },
        });
        expected = stocks.reduce((sum, s) => sum + s.quantity, 0);
      }

      const variance = entry.countedQty - expected;
      totalNetVariance += variance;

      // If auto-reconcile is enabled, align the balance and record transaction
      let reconciled = false;
      if (entry.autoReconcile && variance !== 0 && entry.batchId) {
        await tx.locationStock.upsert({
          where: {
            location_itemId_batchId: {
              location: input.location,
              itemId: entry.itemId,
              batchId: entry.batchId,
            },
          },
          create: {
            location: input.location,
            itemId: entry.itemId,
            batchId: entry.batchId,
            quantity: entry.countedQty,
          },
          update: {
            quantity: entry.countedQty,
          },
        });

        await tx.inventoryBatch.update({
          where: { id: entry.batchId },
          data: { currentQuantity: { increment: variance } },
        });

        const item = await tx.inventoryItem.update({
          where: { id: entry.itemId },
          data: { quantity: { increment: variance } },
        });

        await tx.stockTransaction.create({
          data: {
            transactionNumber: generateTxnNumber(),
            type: 'AUDIT_RECONCILIATION',
            itemId: entry.itemId,
            batchId: entry.batchId,
            sourceLocation: variance < 0 ? input.location : null,
            targetLocation: variance > 0 ? input.location : null,
            quantity: Math.abs(variance),
            balanceBefore: item.quantity - variance,
            balanceAfter: item.quantity,
            reason: `Audit ${auditNumber} reconciliation: ${entry.discrepancyReason || 'Physical variance'}`,
            performedById: input.auditedById,
            performedByName: input.auditedByName,
          },
        });

        reconciled = true;
      }

      auditItemsData.push({
        itemId: entry.itemId,
        batchId: entry.batchId || null,
        expectedQty: expected,
        countedQty: entry.countedQty,
        variance,
        discrepancyReason: entry.discrepancyReason || null,
        reconciled,
      });
    }

    const audit = await tx.stockAudit.create({
      data: {
        auditNumber,
        location: input.location,
        status: 'COMPLETED',
        auditedById: input.auditedById,
        auditedByName: input.auditedByName,
        totalVariance: totalNetVariance,
        notes: input.notes,
        items: {
          create: auditItemsData,
        },
      },
      include: {
        items: {
          include: { item: true, batch: true },
        },
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.auditedById,
      action: 'STOCK_AUDIT_COMPLETED',
      entityType: 'StockAudit',
      entityId: audit.id,
      details: {
        auditNumber: audit.auditNumber,
        location: input.location,
        totalVariance: totalNetVariance,
        itemsAudited: auditItemsData.length,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return audit;
  });
}

export async function listStockAudits(location?: string) {
  const where: Prisma.StockAuditWhereInput = {};
  if (location) {
    where.location = location;
  }

  return await prisma.stockAudit.findMany({
    where,
    include: {
      items: {
        include: { item: true, batch: true },
      },
    },
    orderBy: { auditedAt: 'desc' },
  });
}

// =============================================================
// 18. RECALL / BATCH TRACEABILITY
// =============================================================
export async function traceBatch(batchNumberOrId: string) {
  const batch = await prisma.inventoryBatch.findFirst({
    where: {
      OR: [{ id: batchNumberOrId }, { batchNumber: batchNumberOrId }],
    },
    include: {
      item: true,
      locationStocks: true,
    },
  });

  if (!batch) {
    throw new AppError(`Batch '${batchNumberOrId}' not found in inventory registry`, 404);
  }

  // 1. Trace all stock transactions for this batch
  const transactions = await prisma.stockTransaction.findMany({
    where: { batchId: batch.id },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Trace all consumable usage by scan
  const consumableUsages = await prisma.orderConsumableUsage.findMany({
    where: { batchId: batch.id },
    orderBy: { recordedAt: 'desc' },
  });

  // 3. Trace contrast administration records if batch matches
  const contrastAdminRecords = await prisma.contrastAdministration.findMany({
    where: { batchLotNumber: batch.batchNumber },
  });

  // 4. Trace wastage logs
  const wastageRecords = await prisma.wastageLog.findMany({
    where: { batchId: batch.id },
  });

  // Collect all distinct order IDs and patient IDs
  const orderIds = Array.from(
    new Set([
      ...transactions.map((t) => t.orderId).filter(Boolean),
      ...consumableUsages.map((u) => u.orderId).filter(Boolean),
      ...contrastAdminRecords.map((c) => c.imagingOrderId).filter(Boolean),
    ])
  ) as string[];

  // Fetch full clinical context for affected patients
  const affectedOrders = await prisma.imagingOrder.findMany({
    where: { id: { in: orderIds } },
    include: {
      patient: true,
      report: true,
    },
  });

  const affectedPatients = affectedOrders.map((o) => ({
    patientId: o.patient.patientId,
    patientName: `${o.patient.firstName} ${o.patient.lastName}`,
    phone: o.patient.phone,
    orderId: o.id,
    accessionNumber: o.accessionNumber,
    examinationName: o.examinationName,
    modality: o.modality,
    status: o.orderStatus,
    hasFinalReport: !!o.report?.finalizedAt,
  }));

  return {
    batch: {
      id: batch.id,
      batchNumber: batch.batchNumber,
      itemCode: batch.item.itemCode,
      itemName: batch.item.name,
      supplierName: batch.supplierName,
      purchaseInvoice: batch.purchaseInvoice,
      receivedDate: batch.receivedDate,
      expiryDate: batch.expiryDate,
      initialQuantity: batch.initialQuantity,
      currentQuantity: batch.currentQuantity,
      isBlocked: batch.isBlocked,
      blockReason: batch.blockReason,
    },
    currentStockLocations: batch.locationStocks.map((ls) => ({
      location: ls.location,
      quantity: ls.quantity,
    })),
    affectedPatientCount: affectedPatients.length,
    affectedPatients,
    transactionCount: transactions.length,
    transactions,
    wastageCount: wastageRecords.length,
    wastageRecords,
  };
}

// =============================================================
// 19. PURCHASE / SUPPLIER REPORTS
// =============================================================
export async function getInventoryReports(filters?: {
  startDate?: string;
  endDate?: string;
  supplierName?: string;
}) {
  await ensureDefaultInventoryCatalog();

  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    include: {
      locationStocks: true,
      batches: true,
    },
  });

  // 1. Stock Valuation
  let totalValuation = 0;
  const valuationByCategory: Record<string, { count: number; totalStock: number; valuation: number }> = {};

  for (const it of items) {
    const stock = it.locationStocks.reduce((sum, ls) => sum + ls.quantity, 0);
    const price = Number(it.unitPrice);
    const itemVal = stock * price;
    totalValuation += itemVal;

    if (!valuationByCategory[it.category]) {
      valuationByCategory[it.category] = { count: 0, totalStock: 0, valuation: 0 };
    }
    valuationByCategory[it.category].count += 1;
    valuationByCategory[it.category].totalStock += stock;
    valuationByCategory[it.category].valuation += itemVal;
  }

  // 2. Purchase History & Supplier Breakdown
  const poWhere: Prisma.SupplierPurchaseWhereInput = {};
  if (filters?.supplierName) {
    poWhere.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
  }
  if (filters?.startDate || filters?.endDate) {
    poWhere.receivedAt = {};
    if (filters.startDate) poWhere.receivedAt.gte = new Date(filters.startDate);
    if (filters.endDate) poWhere.receivedAt.lte = new Date(filters.endDate);
  }

  const purchases = await prisma.supplierPurchase.findMany({
    where: poWhere,
    orderBy: { receivedAt: 'desc' },
  });

  const supplierSummary: Record<string, { totalOrders: number; totalSpend: number }> = {};
  for (const p of purchases) {
    const spend = Number(p.totalAmount);
    if (!supplierSummary[p.supplierName]) {
      supplierSummary[p.supplierName] = { totalOrders: 0, totalSpend: 0 };
    }
    supplierSummary[p.supplierName].totalOrders += 1;
    supplierSummary[p.supplierName].totalSpend += spend;
  }

  // 3. Consumption & Wastage Rates
  const wastages = await prisma.wastageLog.findMany({
    include: { item: true },
    orderBy: { recordedAt: 'desc' },
  });

  const totalWastedUnits = wastages.reduce((sum, w) => sum + w.quantity, 0);

  return {
    asOf: new Date(),
    stockValuation: {
      totalValuation: Math.round(totalValuation * 100) / 100,
      totalCatalogItems: items.length,
      byCategory: valuationByCategory,
    },
    purchases: {
      totalPurchases: purchases.length,
      totalSpend: Object.values(supplierSummary).reduce((s, x) => s + x.totalSpend, 0),
      recentOrders: purchases.slice(0, 20),
      bySupplier: supplierSummary,
    },
    wastageSummary: {
      totalWastedUnits,
      wastageLogCount: wastages.length,
      recentWastages: wastages.slice(0, 10),
    },
  };
}

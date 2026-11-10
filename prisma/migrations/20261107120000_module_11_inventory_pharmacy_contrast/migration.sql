-- DropIndex
DROP INDEX IF EXISTS "inventory_items_sku_key";

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "barcode" TEXT,
ADD COLUMN IF NOT EXISTS "concentration" TEXT,
ADD COLUMN IF NOT EXISTS "contrastType" TEXT,
ADD COLUMN IF NOT EXISTS "filmSize" TEXT,
ADD COLUMN IF NOT EXISTS "isEmergencyKit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "itemCode" TEXT,
ADD COLUMN IF NOT EXISTS "packSize" TEXT,
ADD COLUMN IF NOT EXISTS "subCategory" TEXT,
ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'PIECE';

-- Update existing itemCode from sku if needed
UPDATE "inventory_items" SET "itemCode" = "sku" WHERE "itemCode" IS NULL;
ALTER TABLE "inventory_items" ALTER COLUMN "itemCode" SET NOT NULL;
ALTER TABLE "inventory_items" ALTER COLUMN "sku" DROP NOT NULL;
ALTER TABLE "inventory_items" ALTER COLUMN "unitPrice" SET NOT NULL;
ALTER TABLE "inventory_items" ALTER COLUMN "unitPrice" SET DEFAULT 0.00;

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierName" TEXT,
    "purchaseInvoice" TEXT,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initialQuantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "location_stocks" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "sourceLocation" TEXT,
    "targetLocation" TEXT,
    "quantity" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "patientId" TEXT,
    "unitCost" DECIMAL(10,2),
    "totalValue" DECIMAL(10,2),
    "reference" TEXT,
    "reason" TEXT,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "wastage_logs" (
    "id" TEXT NOT NULL,
    "wastageNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "volumeUsedMl" DECIMAL(8,2),
    "volumeWastedMl" DECIMAL(8,2),
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "patientId" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wastage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_consumable_usages" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_consumable_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "emergency_checklists" (
    "id" TEXT NOT NULL,
    "checklistNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "checkedById" TEXT NOT NULL,
    "checkedByName" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "emergency_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "emergency_checklist_items" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "replacementDone" BOOLEAN NOT NULL DEFAULT false,
    "replacementBatch" TEXT,
    "remarks" TEXT,

    CONSTRAINT "emergency_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_audits" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "auditedById" TEXT NOT NULL,
    "auditedByName" TEXT NOT NULL,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVariance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "stock_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_audit_items" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "discrepancyReason" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stock_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supplier_purchases" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_itemCode_key" ON "inventory_items"("itemCode");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_barcode_key" ON "inventory_items"("barcode");
CREATE INDEX IF NOT EXISTS "inventory_items_contrastType_idx" ON "inventory_items"("contrastType");

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_batches_itemId_batchNumber_key" ON "inventory_batches"("itemId", "batchNumber");
CREATE INDEX IF NOT EXISTS "inventory_batches_itemId_idx" ON "inventory_batches"("itemId");
CREATE INDEX IF NOT EXISTS "inventory_batches_expiryDate_idx" ON "inventory_batches"("expiryDate");

CREATE UNIQUE INDEX IF NOT EXISTS "location_stocks_location_itemId_batchId_key" ON "location_stocks"("location", "itemId", "batchId");
CREATE INDEX IF NOT EXISTS "location_stocks_location_idx" ON "location_stocks"("location");
CREATE INDEX IF NOT EXISTS "location_stocks_itemId_idx" ON "location_stocks"("itemId");
CREATE INDEX IF NOT EXISTS "location_stocks_batchId_idx" ON "location_stocks"("batchId");

CREATE UNIQUE INDEX IF NOT EXISTS "stock_transactions_transactionNumber_key" ON "stock_transactions"("transactionNumber");
CREATE INDEX IF NOT EXISTS "stock_transactions_itemId_idx" ON "stock_transactions"("itemId");
CREATE INDEX IF NOT EXISTS "stock_transactions_batchId_idx" ON "stock_transactions"("batchId");
CREATE INDEX IF NOT EXISTS "stock_transactions_orderId_idx" ON "stock_transactions"("orderId");
CREATE INDEX IF NOT EXISTS "stock_transactions_patientId_idx" ON "stock_transactions"("patientId");
CREATE INDEX IF NOT EXISTS "stock_transactions_type_idx" ON "stock_transactions"("type");
CREATE INDEX IF NOT EXISTS "stock_transactions_createdAt_idx" ON "stock_transactions"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "wastage_logs_wastageNumber_key" ON "wastage_logs"("wastageNumber");
CREATE INDEX IF NOT EXISTS "wastage_logs_itemId_idx" ON "wastage_logs"("itemId");
CREATE INDEX IF NOT EXISTS "wastage_logs_batchId_idx" ON "wastage_logs"("batchId");
CREATE INDEX IF NOT EXISTS "wastage_logs_orderId_idx" ON "wastage_logs"("orderId");

CREATE INDEX IF NOT EXISTS "order_consumable_usages_orderId_idx" ON "order_consumable_usages"("orderId");
CREATE INDEX IF NOT EXISTS "order_consumable_usages_patientId_idx" ON "order_consumable_usages"("patientId");
CREATE INDEX IF NOT EXISTS "order_consumable_usages_itemId_idx" ON "order_consumable_usages"("itemId");

CREATE UNIQUE INDEX IF NOT EXISTS "emergency_checklists_checklistNumber_key" ON "emergency_checklists"("checklistNumber");
CREATE INDEX IF NOT EXISTS "emergency_checklists_location_idx" ON "emergency_checklists"("location");
CREATE INDEX IF NOT EXISTS "emergency_checklists_checkedAt_idx" ON "emergency_checklists"("checkedAt");

CREATE INDEX IF NOT EXISTS "emergency_checklist_items_checklistId_idx" ON "emergency_checklist_items"("checklistId");
CREATE INDEX IF NOT EXISTS "emergency_checklist_items_itemId_idx" ON "emergency_checklist_items"("itemId");

CREATE UNIQUE INDEX IF NOT EXISTS "stock_audits_auditNumber_key" ON "stock_audits"("auditNumber");
CREATE INDEX IF NOT EXISTS "stock_audits_location_idx" ON "stock_audits"("location");
CREATE INDEX IF NOT EXISTS "stock_audits_auditedAt_idx" ON "stock_audits"("auditedAt");

CREATE INDEX IF NOT EXISTS "stock_audit_items_auditId_idx" ON "stock_audit_items"("auditId");
CREATE INDEX IF NOT EXISTS "stock_audit_items_itemId_idx" ON "stock_audit_items"("itemId");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_purchases_poNumber_key" ON "supplier_purchases"("poNumber");
CREATE INDEX IF NOT EXISTS "supplier_purchases_supplierName_idx" ON "supplier_purchases"("supplierName");
CREATE INDEX IF NOT EXISTS "supplier_purchases_receivedAt_idx" ON "supplier_purchases"("receivedAt");

-- AddForeignKey
ALTER TABLE "inventory_batches" DROP CONSTRAINT IF EXISTS "inventory_batches_itemId_fkey";
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "location_stocks" DROP CONSTRAINT IF EXISTS "location_stocks_itemId_fkey";
ALTER TABLE "location_stocks" ADD CONSTRAINT "location_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "location_stocks" DROP CONSTRAINT IF EXISTS "location_stocks_batchId_fkey";
ALTER TABLE "location_stocks" ADD CONSTRAINT "location_stocks_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_transactions" DROP CONSTRAINT IF EXISTS "stock_transactions_itemId_fkey";
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_transactions" DROP CONSTRAINT IF EXISTS "stock_transactions_batchId_fkey";
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wastage_logs" DROP CONSTRAINT IF EXISTS "wastage_logs_itemId_fkey";
ALTER TABLE "wastage_logs" ADD CONSTRAINT "wastage_logs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wastage_logs" DROP CONSTRAINT IF EXISTS "wastage_logs_batchId_fkey";
ALTER TABLE "wastage_logs" ADD CONSTRAINT "wastage_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_consumable_usages" DROP CONSTRAINT IF EXISTS "order_consumable_usages_itemId_fkey";
ALTER TABLE "order_consumable_usages" ADD CONSTRAINT "order_consumable_usages_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_consumable_usages" DROP CONSTRAINT IF EXISTS "order_consumable_usages_batchId_fkey";
ALTER TABLE "order_consumable_usages" ADD CONSTRAINT "order_consumable_usages_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "emergency_checklist_items" DROP CONSTRAINT IF EXISTS "emergency_checklist_items_checklistId_fkey";
ALTER TABLE "emergency_checklist_items" ADD CONSTRAINT "emergency_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "emergency_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "emergency_checklist_items" DROP CONSTRAINT IF EXISTS "emergency_checklist_items_itemId_fkey";
ALTER TABLE "emergency_checklist_items" ADD CONSTRAINT "emergency_checklist_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_audit_items" DROP CONSTRAINT IF EXISTS "stock_audit_items_auditId_fkey";
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "stock_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_audit_items" DROP CONSTRAINT IF EXISTS "stock_audit_items_itemId_fkey";
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_audit_items" DROP CONSTRAINT IF EXISTS "stock_audit_items_batchId_fkey";
ALTER TABLE "stock_audit_items" ADD CONSTRAINT "stock_audit_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


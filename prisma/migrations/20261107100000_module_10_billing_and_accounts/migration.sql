-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'UPI';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discountApprovedAt" TIMESTAMP(3),
ADD COLUMN     "discountApprovedById" TEXT,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- CreateTable
CREATE TABLE "price_master_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ModalityType",
    "category" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_master_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "discountReason" TEXT,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'EXAM',

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptData" JSONB,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "refundMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "invoiceId" TEXT,
    "orderId" TEXT,
    "patientId" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "preAuthCode" TEXT,
    "claimAmount" DECIMAL(10,2) NOT NULL,
    "approvedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "copayAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "settlementReference" TEXT,
    "settledAt" TIMESTAMP(3),
    "documents" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_closings" (
    "id" TEXT NOT NULL,
    "closingNumber" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "cashCollected" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "cardCollected" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "upiCollected" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "onlineCollected" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "refundsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "expectedCash" DECIMAL(10,2) NOT NULL,
    "actualCash" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashier_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_master_items_code_key" ON "price_master_items"("code");

-- CreateIndex
CREATE INDEX "price_master_items_category_idx" ON "price_master_items"("category");

-- CreateIndex
CREATE INDEX "price_master_items_modality_idx" ON "price_master_items"("modality");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNumber_key" ON "quotations"("quotationNumber");

-- CreateIndex
CREATE INDEX "quotations_patientId_idx" ON "quotations"("patientId");

-- CreateIndex
CREATE INDEX "quotations_orderId_idx" ON "quotations"("orderId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON "receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentId_key" ON "receipts"("paymentId");

-- CreateIndex
CREATE INDEX "receipts_invoiceId_idx" ON "receipts"("invoiceId");

-- CreateIndex
CREATE INDEX "receipts_patientId_idx" ON "receipts"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refundNumber_key" ON "refunds"("refundNumber");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");

-- CreateIndex
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_claimNumber_key" ON "insurance_claims"("claimNumber");

-- CreateIndex
CREATE INDEX "insurance_claims_invoiceId_idx" ON "insurance_claims"("invoiceId");

-- CreateIndex
CREATE INDEX "insurance_claims_patientId_idx" ON "insurance_claims"("patientId");

-- CreateIndex
CREATE INDEX "insurance_claims_orderId_idx" ON "insurance_claims"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "cashier_closings_closingNumber_key" ON "cashier_closings"("closingNumber");

-- CreateIndex
CREATE INDEX "cashier_closings_cashierId_idx" ON "cashier_closings"("cashierId");

-- CreateIndex
CREATE INDEX "cashier_closings_closingDate_idx" ON "cashier_closings"("closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


/*
  Warnings:

  - You are about to drop the column `costPerUnit` on the `inventory_items` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `inventory_items` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `inventory_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `inventory_items` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `invoices` table. All the data in the column will be lost.
  - You are about to alter the column `paidAmount` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `status` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `transactionRef` on the `payments` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `isPreliminary` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `pacsTransferAt` on the `studies` table. All the data in the column will be lost.
  - You are about to drop the column `studyDate` on the `studies` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imagingOrderId]` on the table `appointments` will be added. If there are existing duplicate values, this will fail.
  - Made the column `entityId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `authorizationStatus` on table `imaging_orders` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `outstandingAmount` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modality` to the `studies` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "imaging_orders_priority_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "imaging_orders" ALTER COLUMN "authorizationStatus" SET NOT NULL;

-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN "costPerUnit",
DROP COLUMN "isActive",
DROP COLUMN "location",
DROP COLUMN "unit",
ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "balance",
DROP COLUMN "dueDate",
DROP COLUMN "totalAmount",
ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "outstandingAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "total" DECIMAL(10,2) NOT NULL,
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "status",
DROP COLUMN "transactionRef",
ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "reference" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "paymentMethod" SET DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "reports" DROP COLUMN "isPreliminary",
ADD COLUMN     "draftContent" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "studies" DROP COLUMN "pacsTransferAt",
DROP COLUMN "studyDate",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "modality" "ModalityType" NOT NULL,
ADD COLUMN     "seriesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "studyInstanceUid" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_imagingOrderId_key" ON "appointments"("imagingOrderId");

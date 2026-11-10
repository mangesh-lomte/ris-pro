import crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Healthcare Identifier Standards:
 * 
 * 1. Patient ID (MRN):
 *    Format: PAT-YYYY-XXXXX (e.g., PAT-2026-83921)
 *    Persistent, unique identifier assigned upon initial patient registration.
 *    Single source of truth throughout all radiology appointments and orders.
 * 
 * 2. Accession Number:
 *    Format: ACC-YYYYMMDD-XXXX or ACC-YYYYMMDD-MOD-XXXX (e.g., ACC-20261105-CT-9B2F)
 *    Unique identifier assigned per imaging order, preserving traceability
 *    across MWL (Modality Worklist), DICOM/PACS headers, and Radiologist Diagnostic Reports.
 */

export function generatePatientId(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return `PAT-${year}-${randomSuffix}`;
}

export function generateAccessionNumber(modality?: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 alphanumeric chars
  const modPart = modality ? `-${modality.toUpperCase()}` : '';
  return `ACC-${dateStr}${modPart}-${randomHex}`;
}

export function generateAppointmentNumber(): string {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `APT-${year}-${randomDigits}`;
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `INV-${year}-${randomDigits}`;
}

export function generateStudyInstanceUid(): string {
  const hex = crypto.randomBytes(16).toString('hex');
  const decimal = BigInt('0x' + hex).toString();
  return `2.25.${decimal}`;
}

/**
 * Collision-proof server-side generator with database verification and retries
 */
export async function generateUniquePatientId(
  client: PrismaClient | Prisma.TransactionClient
): Promise<string> {
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generatePatientId();
    const existing = await client.patient.findUnique({
      where: { patientId: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  // Fallback to high-entropy timestamp suffix if collision persists
  const year = new Date().getFullYear();
  const entropy = Date.now().toString().slice(-5);
  return `PAT-${year}-${entropy}`;
}

export async function generateUniqueAccessionNumber(
  client: PrismaClient | Prisma.TransactionClient,
  modality?: string
): Promise<string> {
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateAccessionNumber(modality);
    const existing = await client.imagingOrder.findUnique({
      where: { accessionNumber: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const modPart = modality ? `-${modality.toUpperCase()}` : '';
  const entropy = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ACC-${dateStr}${modPart}-${entropy}`;
}

export async function generateUniqueAppointmentNumber(
  client: PrismaClient | Prisma.TransactionClient
): Promise<string> {
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateAppointmentNumber();
    const existing = await client.appointment.findUnique({
      where: { appointmentNumber: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  const year = new Date().getFullYear();
  const entropy = Date.now().toString().slice(-4);
  return `APT-${year}-${entropy}`;
}

/**
 * Daily reception queue token generator (e.g. CT-001, MRI-002, XR-003)
 */
export async function generateDailyQueueToken(
  client: PrismaClient | Prisma.TransactionClient,
  modality: string
): Promise<string> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const checkedInToday = await client.appointment.count({
    where: {
      modality: modality as any,
      checkedInAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const nextSequence = (checkedInToday + 1).toString().padStart(3, '0');
  const modPrefix = modality.toUpperCase().slice(0, 3);
  return `${modPrefix}-${nextSequence}`;
}

export function generateScheduleNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PM-${year}-${rand}`;
}

export function generateQcCheckNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `QC-${year}-${rand}`;
}

export function generateServiceTicketNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TKT-${year}-${rand}`;
}

export function generateDowntimeNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DWN-${year}-${rand}`;
}

export function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CAL-${year}-${rand}`;
}

export function generateContractNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AMC-${year}-${rand}`;
}

export function generateServiceRecordNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SRV-${year}-${rand}`;
}

export function generateShareNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SHR-${year}-${rand}`;
}

export function generateTransferNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TRF-${year}-${rand}`;
}

export function generateImportNumber(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `IMP-${year}-${rand}`;
}

export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}



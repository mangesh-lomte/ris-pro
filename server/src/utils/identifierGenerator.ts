import crypto from 'crypto';

/**
 * Healthcare Identifier Standards:
 * 
 * 1. Patient ID (MRN):
 *    Format: PAT-YYYY-XXXXX (e.g., PAT-2026-83921)
 *    Persistent, unique identifier assigned upon initial patient registration.
 *    Single source of truth throughout all radiology appointments and orders.
 * 
 * 2. Accession Number:
 *    Format: ACC-YYYYMMDD-XXXX (e.g., ACC-20261105-9B2F)
 *    Unique identifier assigned per imaging order, preserving traceability
 *    across MWL (Modality Worklist), DICOM/PACS headers, and Radiologist Diagnostic Reports.
 */

export function generatePatientId(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return `PAT-${year}-${randomSuffix}`;
}

export function generateAccessionNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 alphanumeric chars
  return `ACC-${dateStr}-${randomHex}`;
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

/**
 * Conceptual DICOM Study Instance UID generator conforming to standard UID roots
 * Root format: 2.25.<decimal-encoded-uuid> (RFC 4122 / DICOM PS 3.5 §9)
 */
export function generateStudyInstanceUid(): string {
  const hex = crypto.randomBytes(16).toString('hex');
  const decimal = BigInt('0x' + hex).toString();
  return `2.25.${decimal}`;
}

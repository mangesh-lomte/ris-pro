import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { DocumentCategory } from '@prisma/client';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;

export const MAX_DOCUMENT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface UploadDocumentInput {
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileBase64: string;
  notes?: string;
}

export interface UserContext {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Returns storage root directory for technologist supporting documents.
 */
export function getDocumentStorageDir(): string {
  return path.resolve(process.cwd(), 'server', 'storage', 'documents');
}

/**
 * Validates file type and size constraints.
 */
export function validateDocumentFile(fileName: string, fileType: string, fileSizeBytes: number): void {
  const ext = path.extname(fileName).toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(fileType as (typeof ALLOWED_MIME_TYPES)[number]);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]);

  if (!isMimeAllowed && !isExtAllowed) {
    throw AppError.badRequest(
      `Invalid file type '${fileType}'. Supported clinical document formats are PDF, JPEG, JPG, PNG, and WebP.`
    );
  }

  if (fileSizeBytes <= 0) {
    throw AppError.badRequest('Uploaded file is empty.');
  }

  if (fileSizeBytes > MAX_DOCUMENT_FILE_SIZE) {
    throw AppError.badRequest(
      `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 5 MB.`
    );
  }
}

/**
 * Resolves an imaging order by ID or Accession Number.
 */
async function resolveOrder(identifier: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [
        { id: identifier },
        { accessionNumber: identifier },
        { appointment: { id: identifier } },
        { appointment: { appointmentNumber: identifier } },
      ],
    },
    include: {
      patient: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  return order;
}

/**
 * Attaches a supporting clinical document to the selected imaging order.
 */
export async function uploadOrderDocument(
  identifier: string,
  payload: UploadDocumentInput,
  userContext: UserContext
) {
  const order = await resolveOrder(identifier);

  if (!payload.category || !Object.values(DocumentCategory).includes(payload.category)) {
    throw AppError.badRequest(
      `Invalid document category '${payload.category}'. Allowed categories: ${Object.values(DocumentCategory).join(', ')}`
    );
  }

  if (!payload.fileName || payload.fileName.trim().length === 0) {
    throw AppError.badRequest('File name is required.');
  }

  if (!payload.fileBase64 || payload.fileBase64.trim().length === 0) {
    throw AppError.badRequest('File content is required.');
  }

  // Decode buffer & validate (stripping data URI header if present)
  const base64Data = payload.fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const buffer = Buffer.from(base64Data, 'base64');
  validateDocumentFile(payload.fileName, payload.fileType, buffer.length);

  // Generate safe stored filename preventing path traversal
  const ext = path.extname(payload.fileName).toLowerCase() || '.bin';
  const rawBase = path.basename(payload.fileName, ext);
  const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) || 'doc';
  const storedFilename = `doc_${order.accessionNumber}_${Date.now()}_${safeBase}${ext}`;

  // Ensure storage directory exists
  const storageDir = getDocumentStorageDir();
  await fs.promises.mkdir(storageDir, { recursive: true });

  const targetPath = path.join(storageDir, storedFilename);
  if (!targetPath.startsWith(storageDir)) {
    throw AppError.forbidden('Invalid document storage path.');
  }

  await fs.promises.writeFile(targetPath, buffer);

  // Persist metadata
  const doc = await prisma.orderDocument.create({
    data: {
      imagingOrderId: order.id,
      patientId: order.patientId,
      accessionNumber: order.accessionNumber,
      category: payload.category,
      fileName: path.basename(payload.fileName),
      storedFilename,
      fileType: payload.fileType || 'application/octet-stream',
      fileSize: buffer.length,
      notes: payload.notes?.trim() || null,
      uploadedByUserId: userContext.userId,
    },
    include: {
      uploadedByUser: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  // Audit event (never logging file content)
  await logAuditEvent({
    userId: userContext.userId,
    action: 'DOCUMENT_UPLOADED',
    entityType: 'OrderDocument',
    entityId: doc.id,
    details: {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      category: doc.category,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return doc;
}

/**
 * Retrieves all attached supporting documents for an examination.
 */
export async function getOrderDocuments(identifier: string) {
  const order = await resolveOrder(identifier);

  const documents = await prisma.orderDocument.findMany({
    where: {
      imagingOrderId: order.id,
    },
    include: {
      uploadedByUser: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  return documents;
}

/**
 * Retrieves document binary data for viewing or downloading with ownership check.
 */
export async function getOrderDocumentFile(
  identifier: string,
  documentId: string,
  userContext: UserContext
) {
  const order = await resolveOrder(identifier);

  const doc = await prisma.orderDocument.findFirst({
    where: {
      id: documentId,
      imagingOrderId: order.id,
    },
  });

  if (!doc) {
    throw AppError.notFound(`Document with ID '${documentId}' not found for this examination.`);
  }

  const storageDir = getDocumentStorageDir();
  const safeFilename = path.basename(doc.storedFilename);
  const targetPath = path.join(storageDir, safeFilename);

  if (!targetPath.startsWith(storageDir)) {
    throw AppError.forbidden('Invalid file path access.');
  }

  try {
    const fileBuffer = await fs.promises.readFile(targetPath);

    await logAuditEvent({
      userId: userContext.userId,
      action: 'DOCUMENT_DOWNLOADED',
      entityType: 'OrderDocument',
      entityId: doc.id,
      details: {
        orderId: order.id,
        accessionNumber: order.accessionNumber,
        category: doc.category,
        fileName: doc.fileName,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return {
      fileBuffer,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
    };
  } catch (err) {
    throw AppError.notFound(`Document file '${doc.fileName}' not found on storage server.`);
  }
}

/**
 * Deletes an attached supporting document with auditable history.
 */
export async function deleteOrderDocument(
  identifier: string,
  documentId: string,
  userContext: UserContext
) {
  const order = await resolveOrder(identifier);

  const doc = await prisma.orderDocument.findFirst({
    where: {
      id: documentId,
      imagingOrderId: order.id,
    },
  });

  if (!doc) {
    throw AppError.notFound(`Document with ID '${documentId}' not found for this examination.`);
  }

  // Delete file from disk if present
  try {
    const storageDir = getDocumentStorageDir();
    const safeFilename = path.basename(doc.storedFilename);
    const targetPath = path.join(storageDir, safeFilename);
    if (targetPath.startsWith(storageDir) && fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch {
    // Log and continue deletion from DB
  }

  await prisma.orderDocument.delete({
    where: { id: doc.id },
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'DOCUMENT_DELETED',
    entityType: 'OrderDocument',
    entityId: doc.id,
    details: {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      category: doc.category,
      fileName: doc.fileName,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return { success: true };
}

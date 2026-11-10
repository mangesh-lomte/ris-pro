import { prisma } from '../config/db';
import {
  ReportStatus,
  ReportAmendmentType,
  UserRole,
} from '@prisma/client';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';

export interface CreateReportAmendmentInput {
  amendmentType: 'CORRECTION' | 'ADDENDUM';
  reason: string;
  content?: string;
  findings?: string;
  impression?: string;
  targetVersion: number;
}

export interface UserContext {
  userId: string;
  role: UserRole;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Retrieve complete immutable version history for a finalized diagnostic report.
 */
export async function getReportVersionHistory(
  identifier: string,
  userContext: UserContext
) {
  if (!userContext || !userContext.userId) {
    throw AppError.unauthorized('Authentication required');
  }

  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id: identifier.trim() }, { accessionNumber: identifier.trim() }],
    },
    include: {
      patient: true,
      report: {
        include: {
          radiologist: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          amendments: {
            orderBy: { versionNumber: 'asc' },
            include: {
              createdBy: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${identifier}`, 'ORDER_NOT_FOUND');
  }

  if (!order.report) {
    throw AppError.notFound(`Diagnostic report not found for order: ${order.accessionNumber}`, 'REPORT_NOT_FOUND');
  }

  const report = order.report;

  // Version 1 is the original finalized report
  const v1 = {
    versionNumber: 1,
    amendmentType: 'FINAL',
    label: 'Original Final Report',
    reason: 'Initial finalized diagnostic report',
    findings: report.findings,
    impression: report.impression,
    content: report.findings ? `Findings:\n${report.findings}\n\nImpression:\n${report.impression || ''}` : '',
    contentSnapshot: {
      findings: report.findings,
      impression: report.impression,
      status: ReportStatus.FINAL,
    },
    author: report.radiologist
      ? {
          id: report.radiologist.id,
          name: `${report.radiologist.firstName} ${report.radiologist.lastName}`.trim(),
          email: report.radiologist.email,
        }
      : { id: 'unknown', name: 'Original Radiologist', email: '' },
    createdAt: report.finalizedAt || report.createdAt,
    isOriginal: true,
  };

  // Map subsequent amendments (version 2, 3...)
  const amendmentVersions = (report.amendments || []).map((a) => ({
    versionNumber: a.versionNumber,
    amendmentType: a.amendmentType,
    label: a.amendmentType === ReportAmendmentType.CORRECTION ? 'Correction' : 'Addendum',
    reason: a.reason,
    findings: a.findings,
    impression: a.impression,
    content: a.findings || a.impression || '',
    contentSnapshot: a.contentSnapshot,
    author: {
      id: a.createdBy.id,
      name: `${a.createdBy.firstName} ${a.createdBy.lastName}`.trim(),
      email: a.createdBy.email,
    },
    createdAt: a.createdAt,
    isOriginal: false,
  }));

  const allVersions = [v1, ...amendmentVersions];
  const latestAmendment = report.amendments && report.amendments.length > 0
    ? report.amendments[report.amendments.length - 1]
    : null;

  return {
    reportId: report.id,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
    currentVersion: report.version,
    reportStatus: report.status,
    isFinalized: report.status === ReportStatus.FINAL || report.status === ReportStatus.ADDENDUM,
    originalFinalizedAt: report.finalizedAt,
    versions: allVersions,
    latestEffectiveContent: {
      findings: latestAmendment?.findings ?? report.findings,
      impression: latestAmendment?.impression ?? report.impression,
    },
  };
}

/**
 * Create an auditable correction or addendum for an already finalized report.
 * Preserves the original final report and increments version atomically.
 */
export async function createReportAmendment(
  identifier: string,
  input: CreateReportAmendmentInput,
  userContext: UserContext
) {
  if (!userContext || !userContext.userId) {
    throw AppError.unauthorized('Authentication required');
  }

  // RBAC: Only Radiologists and Admins can amend finalized reports
  if (userContext.role !== UserRole.RADIOLOGIST && userContext.role !== UserRole.ADMIN) {
    throw AppError.forbidden(
      `Role '${userContext.role}' is not authorized to create report amendments.`,
      'RBAC_FORBIDDEN'
    );
  }

  // Input validations
  if (!input.amendmentType || (input.amendmentType !== 'CORRECTION' && input.amendmentType !== 'ADDENDUM')) {
    throw AppError.badRequest('Invalid amendment type. Must be CORRECTION or ADDENDUM.', 'INVALID_AMENDMENT_TYPE');
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw AppError.badRequest('Amendment reason is required.', 'REASON_REQUIRED');
  }

  const hasContent = Boolean(
    (input.content && input.content.trim().length > 0) ||
    (input.findings && input.findings.trim().length > 0) ||
    (input.impression && input.impression.trim().length > 0)
  );

  if (!hasContent) {
    throw AppError.badRequest('Amendment content is required.', 'CONTENT_REQUIRED');
  }

  if (typeof input.targetVersion !== 'number') {
    throw AppError.badRequest('targetVersion is required for optimistic concurrency verification.', 'TARGET_VERSION_REQUIRED');
  }

  // Locate order and report
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id: identifier.trim() }, { accessionNumber: identifier.trim() }],
    },
    include: {
      patient: true,
      report: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found: ${identifier}`, 'ORDER_NOT_FOUND');
  }

  if (!order.report) {
    throw AppError.notFound(`Diagnostic report not found for order: ${order.accessionNumber}`, 'REPORT_NOT_FOUND');
  }

  const report = order.report;

  // Rule: Only a finalized report may be corrected or amended
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot amend report in status '${report.status}'. Only finalized reports (FINAL or ADDENDUM) can be amended.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  // Concurrency check: Stale version protection
  if (report.version !== input.targetVersion) {
    throw AppError.conflict(
      `Report version conflict: target version ${input.targetVersion} does not match current version ${report.version}. Reload latest version.`,
      'REPORT_VERSION_CONFLICT'
    );
  }

  const amendmentType = input.amendmentType === 'CORRECTION'
    ? ReportAmendmentType.CORRECTION
    : ReportAmendmentType.ADDENDUM;

  // Execute amendment in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // Re-verify report inside transaction
    const currentReport = await tx.report.findUnique({
      where: { id: report.id },
    });

    if (!currentReport || currentReport.version !== input.targetVersion) {
      throw AppError.conflict(
        'Concurrent report modification detected. Please reload.',
        'REPORT_VERSION_CONFLICT'
      );
    }

    const nextVersion = currentReport.version + 1;

    // Content formatting
    let effectiveFindings = input.findings?.trim() || null;
    let effectiveImpression = input.impression?.trim() || null;

    if (!effectiveFindings && input.content) {
      if (amendmentType === ReportAmendmentType.CORRECTION) {
        effectiveFindings = input.content.trim();
        effectiveImpression = currentReport.impression;
      } else {
        effectiveFindings = `${currentReport.findings || ''}\n\n[ADDENDUM v${nextVersion}]: ${input.content.trim()}`.trim();
        effectiveImpression = currentReport.impression;
      }
    }

    const snapshot = {
      amendmentType,
      versionNumber: nextVersion,
      reason: input.reason.trim(),
      rawContent: input.content?.trim() || null,
      findings: effectiveFindings,
      impression: effectiveImpression,
      authorId: userContext.userId,
      createdAt: new Date().toISOString(),
      previousVersion: currentReport.version,
    };

    const newAmendment = await tx.reportAmendment.create({
      data: {
        reportId: currentReport.id,
        versionNumber: nextVersion,
        amendmentType,
        reason: input.reason.trim(),
        findings: effectiveFindings,
        impression: effectiveImpression,
        contentSnapshot: snapshot,
        createdById: userContext.userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Atomically increment version and transition to ADDENDUM status if applicable
    const updatedReport = await tx.report.update({
      where: { id: currentReport.id },
      data: {
        version: nextVersion,
        status: amendmentType === ReportAmendmentType.ADDENDUM ? ReportStatus.ADDENDUM : currentReport.status,
      },
    });

    return {
      amendment: newAmendment,
      updatedReport,
      nextVersion,
    };
  });

  // Log audit event
  const auditAction = amendmentType === ReportAmendmentType.CORRECTION
    ? 'REPORT_CORRECTION_CREATED'
    : 'REPORT_ADDENDUM_CREATED';

  await logAuditEvent({
    userId: userContext.userId,
    action: auditAction,
    entityType: 'Report',
    entityId: report.id,
    details: {
      reportId: report.id,
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      amendmentType: input.amendmentType,
      versionNumber: result.nextVersion,
      targetVersion: input.targetVersion,
      reason: input.reason.trim(),
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    amendment: {
      id: result.amendment.id,
      versionNumber: result.amendment.versionNumber,
      amendmentType: result.amendment.amendmentType,
      reason: result.amendment.reason,
      findings: result.amendment.findings,
      impression: result.amendment.impression,
      createdAt: result.amendment.createdAt,
      author: {
        id: result.amendment.createdBy.id,
        name: `${result.amendment.createdBy.firstName} ${result.amendment.createdBy.lastName}`.trim(),
        email: result.amendment.createdBy.email,
      },
    },
    currentVersion: result.nextVersion,
    reportStatus: result.updatedReport.status,
  };
}


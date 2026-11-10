import crypto from 'crypto';
import { OrderStatus, ReportStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { getEffectivePacsAdapter, isOrderEligibleForRadiologist } from './radiologist.service';

export interface FinalizeReportPayload {
  draftVersion?: number;
  findings: string;
  impression: string;
  approved: boolean;
  signatureStatement?: string;
}

export interface DigitalSignatureData {
  algorithm: string;
  signedBy: string;
  signerEmail: string;
  signerRole: string;
  signerId: string;
  signedAt: string;
  signatureHash: string;
  statement: string;
  manifest: {
    patientId: string;
    accessionNumber: string;
    studyInstanceUid: string;
    version: number;
    findingsHash: string;
    impressionHash: string;
  };
}

/**
 * Returns a review and completeness summary of the report draft before final signing and locking.
 * Implements PDF Module 09: "Report review / approval - Check report text, exam identity and completeness."
 */
export async function getReportReviewSummary(
  identifier: string,
  userContext: { userId: string; role: UserRole }
) {
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id: identifier.trim() }, { accessionNumber: identifier.trim() }],
    },
    include: {
      patient: true,
      scanLifecycles: {
        include: { imageQualityReview: true },
      },
      imageQualityReviews: {
        orderBy: { createdAt: 'desc' },
      },
      pacsStudyLink: true,
      pacsHandoffs: {
        orderBy: { createdAt: 'desc' },
      },
      study: true,
      reportDraft: {
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } },
          template: true,
        },
      },
      report: {
        include: {
          radiologist: { select: { id: true, firstName: true, lastName: true, email: true } },
          signedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          amendments: true,
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const effectiveAdapter = getEffectivePacsAdapter();
  if (!isOrderEligibleForRadiologist(order, effectiveAdapter)) {
    throw AppError.conflict(
      `Imaging order '${order.accessionNumber}' is not eligible for reporting in current state '${order.orderStatus}'.`,
      'ORDER_NOT_ELIGIBLE'
    );
  }

  const isFinalized = Boolean(
    order.report &&
      (order.report.status === ReportStatus.FINAL ||
        order.report.status === ReportStatus.ADDENDUM ||
        order.report.isLocked)
  );

  // Extract structured draft contents
  const draftContent = (order.reportDraft?.content as Record<string, any>) || {};
  const findings = (draftContent.Findings || draftContent.findings || order.report?.findings || '').trim();
  const impression = (draftContent.Impression || draftContent.impression || order.report?.impression || '').trim();
  const clinicalIndication = (draftContent['Clinical Indication'] || draftContent.clinicalIndication || order.clinicalIndication || '').trim();
  const comparison = (draftContent.Comparison || draftContent.comparison || '').trim();
  const measurements = Array.isArray(draftContent._measurements) ? draftContent._measurements : [];
  const keyImages = Array.isArray(draftContent._keyImages) ? draftContent._keyImages : [];

  const missingFields: string[] = [];
  if (!findings) missingFields.push('Findings');
  if (!impression) missingFields.push('Impression');

  const signer = await prisma.user.findUnique({
    where: { id: userContext.userId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });

  return {
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
    patientDob: order.patient.dateOfBirth?.toISOString() || null,
    patientGender: order.patient.gender,
    modality: order.modality,
    bodyPart: order.bodyPart,
    examinationName: order.examinationName,
    studyInstanceUid: order.pacsStudyLink?.studyInstanceUid || order.study?.studyInstanceUid || null,
    isFinalized,
    isLocked: isFinalized,
    draftVersion: order.reportDraft?.version || 1,
    content: {
      clinicalIndication,
      comparison,
      findings,
      impression,
      measurements,
      keyImages,
    },
    completeness: {
      hasFindings: findings.length > 0,
      hasImpression: impression.length > 0,
      isComplete: missingFields.length === 0,
      missingFields,
    },
    signerPreview: signer
      ? {
          id: signer.id,
          name: `${signer.firstName} ${signer.lastName}`.trim(),
          email: signer.email,
          role: signer.role,
        }
      : null,
    legalStatement:
      'I hereby authorize, certify, and apply my digital signature to this diagnostic report, permanently locking the findings under 21 CFR Part 11 compliant audit controls.',
  };
}

/**
 * Authorizes, signs, locks, and finalizes a diagnostic report with cryptographic digital signature.
 * Implements PDF Module 09:
 * - Report review / approval (Completeness & identity check)
 * - Final sign / lock (Authorize final report with named radiologist and timestamp)
 * - Digital signature (Apply approved electronic sign-off process)
 */
export async function finalizeAndSignReport(
  identifier: string,
  payload: FinalizeReportPayload,
  userContext: { userId: string; role: UserRole; ipAddress?: string; userAgent?: string }
) {
  // Server-side authorization check
  if (userContext.role !== UserRole.RADIOLOGIST && userContext.role !== UserRole.ADMIN) {
    throw AppError.forbidden(
      'Only qualified Radiologists or System Administrators are authorized to sign and finalize diagnostic reports.',
      'FINAL_SIGN_FORBIDDEN'
    );
  }

  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id: identifier.trim() }, { accessionNumber: identifier.trim() }],
    },
    include: {
      patient: true,
      scanLifecycles: {
        include: { imageQualityReview: true },
      },
      imageQualityReviews: {
        orderBy: { createdAt: 'desc' },
      },
      pacsStudyLink: true,
      pacsHandoffs: {
        orderBy: { createdAt: 'desc' },
      },
      study: true,
      reportDraft: true,
      report: {
        include: {
          radiologist: true,
          signedBy: true,
          amendments: true,
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const effectiveAdapter = getEffectivePacsAdapter();
  if (!isOrderEligibleForRadiologist(order, effectiveAdapter)) {
    throw AppError.conflict(
      `Imaging order '${order.accessionNumber}' is not eligible for reporting in current state '${order.orderStatus}'.`,
      'ORDER_NOT_ELIGIBLE'
    );
  }

  // 1. Completeness & Review Approval Validation
  if (!payload.approved) {
    throw AppError.badRequest(
      'Report review and approval confirmation is required before final sign and lock.',
      'REPORT_APPROVAL_REQUIRED'
    );
  }

  const findings = (payload.findings || '').trim();
  if (!findings) {
    throw AppError.badRequest('Report findings cannot be empty.', 'REPORT_FINDINGS_REQUIRED');
  }

  const impression = (payload.impression || '').trim();
  if (!impression) {
    throw AppError.badRequest('Report impression cannot be empty.', 'REPORT_IMPRESSION_REQUIRED');
  }

  // 2. Duplicate Finalization Protection
  if (
    order.report &&
    (order.report.status === ReportStatus.FINAL ||
      order.report.status === ReportStatus.ADDENDUM ||
      order.report.isLocked)
  ) {
    throw AppError.conflict(
      'Report has already been finalized and locked. Further modifications must be submitted as auditable Phase 4.8 corrections or addenda.',
      'REPORT_ALREADY_FINALIZED'
    );
  }

  // 3. Stale / Concurrent Finalization Protection
  if (
    order.reportDraft &&
    payload.draftVersion !== undefined &&
    order.reportDraft.version !== payload.draftVersion
  ) {
    throw AppError.conflict(
      `Draft version conflict: target version ${payload.draftVersion} does not match current draft version ${order.reportDraft.version}. Reload latest draft before finalizing.`,
      'REPORT_DRAFT_VERSION_CONFLICT'
    );
  }

  // Retrieve signing user details
  const signingUser = await prisma.user.findUniqueOrThrow({
    where: { id: userContext.userId },
  });

  // Ensure an associated Study record exists
  let study = order.study;
  if (!study) {
    const studyUid =
      order.pacsStudyLink?.studyInstanceUid ||
      `1.2.840.10008.1.${Date.now()}.${Math.floor(Math.random() * 10000)}`;
    study = await prisma.study.create({
      data: {
        orderId: order.id,
        patientId: order.patient.id,
        studyInstanceUid: studyUid,
        modality: order.modality,
        accessionNumber: order.accessionNumber,
      },
    });
  }

  const now = new Date();
  const studyInstanceUid = (order.pacsStudyLink?.studyInstanceUid || study.studyInstanceUid || '').trim();

  // 4. Compute Tamper-Evident SHA-256 Digital Signature
  const canonicalString = `${order.patient.patientId}|${order.accessionNumber}|${studyInstanceUid}|1|${findings}|${impression}|${signingUser.id}|${now.toISOString()}`;
  const signatureHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

  const digitalSignature: DigitalSignatureData = {
    algorithm: 'SHA-256',
    signedBy: `${signingUser.firstName} ${signingUser.lastName}`.trim(),
    signerEmail: signingUser.email,
    signerRole: signingUser.role,
    signerId: signingUser.id,
    signedAt: now.toISOString(),
    signatureHash,
    statement:
      payload.signatureStatement ||
      'Electronically reviewed, approved, and authorized for final clinical release under 21 CFR Part 11 electronic records policy.',
    manifest: {
      patientId: order.patient.patientId,
      accessionNumber: order.accessionNumber,
      studyInstanceUid,
      version: 1,
      findingsHash: crypto.createHash('sha256').update(findings).digest('hex'),
      impressionHash: crypto.createHash('sha256').update(impression).digest('hex'),
    },
  };

  // 5. Execute Atomic Finalization Transaction
  const finalizedReport = await prisma.$transaction(async (tx) => {
    let reportRecord;
    if (order.report) {
      reportRecord = await tx.report.update({
        where: { id: order.report.id },
        data: {
          radiologistId: signingUser.id,
          signedById: signingUser.id,
          status: ReportStatus.FINAL,
          findings,
          impression,
          version: 1,
          finalizedAt: now,
          signedAt: now,
          isSigned: true,
          isLocked: true,
          signatureHash,
          digitalSignature: digitalSignature as any,
        },
        include: {
          radiologist: { select: { id: true, firstName: true, lastName: true, email: true } },
          signedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          amendments: true,
        },
      });
    } else {
      reportRecord = await tx.report.create({
        data: {
          orderId: order.id,
          studyId: study.id,
          radiologistId: signingUser.id,
          signedById: signingUser.id,
          status: ReportStatus.FINAL,
          findings,
          impression,
          version: 1,
          finalizedAt: now,
          signedAt: now,
          isSigned: true,
          isLocked: true,
          signatureHash,
          digitalSignature: digitalSignature as any,
        },
        include: {
          radiologist: { select: { id: true, firstName: true, lastName: true, email: true } },
          signedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          amendments: true,
        },
      });
    }

    // Advance imaging order to COMPLETED
    await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.COMPLETED,
      },
    });

    // Record Audit Event
    await tx.auditLog.create({
      data: {
        userId: signingUser.id,
        action: 'REPORT_FINALIZED_AND_SIGNED',
        entityType: 'Report',
        entityId: reportRecord.id,
        details: {
          orderId: order.id,
          reportId: reportRecord.id,
          patientId: order.patient.patientId,
          accessionNumber: order.accessionNumber,
          version: 1,
          signerId: signingUser.id,
          signerName: `${signingUser.firstName} ${signingUser.lastName}`.trim(),
          signedAt: now.toISOString(),
          signatureHash,
          status: 'FINAL',
          isLocked: true,
        },
        ipAddress: userContext.ipAddress || '127.0.0.1',
        userAgent: userContext.userAgent || 'unknown',
      },
    });

    return reportRecord;
  });

  return {
    reportId: finalizedReport.id,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    status: finalizedReport.status,
    version: finalizedReport.version,
    findings: finalizedReport.findings,
    impression: finalizedReport.impression,
    finalizedAt: finalizedReport.finalizedAt?.toISOString(),
    signedAt: finalizedReport.signedAt?.toISOString(),
    signer: {
      id: signingUser.id,
      name: `${signingUser.firstName} ${signingUser.lastName}`.trim(),
      email: signingUser.email,
      role: signingUser.role,
    },
    isSigned: finalizedReport.isSigned,
    isLocked: finalizedReport.isLocked,
    signatureHash: finalizedReport.signatureHash,
    digitalSignature: finalizedReport.digitalSignature,
  };
}


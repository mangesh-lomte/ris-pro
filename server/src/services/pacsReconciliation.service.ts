import { prisma } from '../config/db';
import { getPacsGateway, PacsStudyLookupOutcome, PacsStudyLookupResult } from '../integrations/pacs';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { PacsStudyLinkStatus } from '@prisma/client';

export interface UserContext {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function getPacsStatus() {
  const gateway = getPacsGateway();
  const [health, caps] = await Promise.all([
    gateway.checkHealth(),
    gateway.getCapabilities(),
  ]);

  return {
    adapter: caps.adapter,
    connected: health.connected,
    serverName: health.serverName || caps.serverName || 'Manrad RIS PACS',
    version: health.version || caps.version || 'Unknown',
    apiVersion: health.apiVersion,
    dicomAet: health.dicomAet,
    dicomWebPluginAvailable: caps.dicomWebPluginAvailable ?? false,
    metadataLookupSupported: caps.metadataLookupSupported,
    reconciliationSupported: caps.reconciliationSupported,
    dicomTransferSupported: caps.dicomTransferSupported,
    viewerSupported: caps.viewerSupported,
    checkedAt: health.checkedAt,
    details: health.details,
  };
}

export async function lookupPacsStudy(
  identifier: string,
  userContext: UserContext
): Promise<PacsStudyLookupResult & { pacsStudyLink?: any }> {
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
      pacsStudyLink: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const risAccession = order.accessionNumber;
  const risPatientId = order.patient.patientId;
  const gateway = getPacsGateway();

  const searchResult = await gateway.findStudyByAccession(risAccession);

  if (searchResult.outcome === PacsStudyLookupOutcome.PACS_UNAVAILABLE) {
    return {
      outcome: PacsStudyLookupOutcome.PACS_UNAVAILABLE,
      message: 'PACS server is currently unavailable or connection timed out.',
      metadata: null,
      risAccession,
      risPatientId,
      pacsStudyLink: order.pacsStudyLink,
    };
  }

  if (searchResult.outcome === PacsStudyLookupOutcome.NOT_FOUND || searchResult.studies.length === 0) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_STUDY_LOOKUP',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: risAccession,
        outcome: PacsStudyLookupOutcome.NOT_FOUND,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return {
      outcome: PacsStudyLookupOutcome.NOT_FOUND,
      message: 'Orthanc is connected, but no PACS study currently matches this RIS accession number.',
      metadata: null,
      risAccession,
      risPatientId,
      pacsStudyLink: order.pacsStudyLink,
    };
  }

  if (searchResult.outcome === PacsStudyLookupOutcome.AMBIGUOUS_MATCH || searchResult.studies.length > 1) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_STUDY_MISMATCH_DETECTED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: risAccession,
        reason: 'AMBIGUOUS_MATCH',
        candidateCount: searchResult.studies.length,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return {
      outcome: PacsStudyLookupOutcome.AMBIGUOUS_MATCH,
      message: 'Multiple Orthanc studies found matching accession number. Manual reconciliation required.',
      candidateStudies: searchResult.studies.map((s) => ({
        orthancStudyId: s.orthancStudyId,
        studyInstanceUid: s.studyInstanceUid,
        accessionNumber: s.accessionNumber,
        patientId: s.patientId,
        description: s.studyDescription,
      })),
      risAccession,
      risPatientId,
      pacsStudyLink: order.pacsStudyLink,
    };
  }

  const study = searchResult.studies[0];

  // Validate Accession Number match
  if (study.accessionNumber.trim().toUpperCase() !== risAccession.trim().toUpperCase()) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_STUDY_MISMATCH_DETECTED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: risAccession,
        pacsAccession: study.accessionNumber,
        reason: 'ACCESSION_MISMATCH',
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return {
      outcome: PacsStudyLookupOutcome.ACCESSION_MISMATCH,
      message: 'Accession number mismatch detected between RIS order and PACS study.',
      metadata: study,
      risAccession,
      risPatientId,
      pacsStudyLink: order.pacsStudyLink,
    };
  }

  // Validate Patient ID consistency
  if (study.patientId && study.patientId.trim().toUpperCase() !== risPatientId.trim().toUpperCase()) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_STUDY_MISMATCH_DETECTED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: risAccession,
        risPatientId,
        pacsPatientId: study.patientId,
        reason: 'PATIENT_ID_MISMATCH',
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return {
      outcome: PacsStudyLookupOutcome.PATIENT_ID_MISMATCH,
      message: 'Patient ID mismatch detected between RIS patient and PACS study.',
      metadata: study,
      risAccession,
      risPatientId,
      pacsStudyLink: order.pacsStudyLink,
    };
  }

  // Exact Match Verified
  await logAuditEvent({
    userId: userContext.userId,
    action: 'PACS_STUDY_MATCHED',
    entityType: 'ImagingOrder',
    entityId: order.id,
    details: {
      accessionNumber: risAccession,
      orthancStudyId: study.orthancStudyId,
      studyInstanceUid: study.studyInstanceUid,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    outcome: PacsStudyLookupOutcome.MATCHED,
    message: 'Orthanc PACS study matched RIS accession number and patient identity.',
    metadata: study,
    risAccession,
    risPatientId,
    pacsStudyLink: order.pacsStudyLink,
  };
}

export async function reconcilePacsStudy(
  identifier: string,
  userContext: UserContext
) {
  // Re-run lookup to ensure fresh, server-authoritative state
  const lookup = await lookupPacsStudy(identifier, userContext);

  if (lookup.outcome !== PacsStudyLookupOutcome.MATCHED || !lookup.metadata) {
    throw AppError.badRequest(
      `Cannot reconcile PACS study: outcome is '${lookup.outcome}'. Only MATCHED studies can be linked.`,
      'PACS_RECONCILIATION_NOT_MATCHED'
    );
  }

  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [
        { id: identifier },
        { accessionNumber: identifier },
        { appointment: { id: identifier } },
        { appointment: { appointmentNumber: identifier } },
      ],
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const study = lookup.metadata;
  const now = new Date();

  // Phase 3.6R Uniqueness Protection: Prevent one Orthanc study from linking to multiple orders
  const conflictingLink = await prisma.pacsStudyLink.findFirst({
    where: {
      OR: [
        { orthancStudyId: study.orthancStudyId },
        ...(study.studyInstanceUid ? [{ studyInstanceUid: study.studyInstanceUid }] : []),
      ],
      imagingOrderId: { not: order.id },
    },
    include: {
      imagingOrder: true,
    },
  });

  if (conflictingLink) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_STUDY_LINK_CONFLICT',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        orthancStudyId: study.orthancStudyId,
        conflictingOrderId: conflictingLink.imagingOrderId,
        conflictingAccession: conflictingLink.imagingOrder?.accessionNumber,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    throw AppError.conflict(
      `Orthanc PACS study '${study.orthancStudyId}' is already linked to another clinical order (${conflictingLink.imagingOrder?.accessionNumber || conflictingLink.imagingOrderId}).`,
      'PACS_STUDY_ALREADY_LINKED'
    );
  }

  // Persist or update PacsStudyLink (Idempotent for same order)
  const pacsStudyLink = await prisma.pacsStudyLink.upsert({
    where: { imagingOrderId: order.id },
    create: {
      imagingOrderId: order.id,
      orthancStudyId: study.orthancStudyId,
      studyInstanceUid: study.studyInstanceUid,
      status: PacsStudyLinkStatus.LINKED,
      verifiedAt: now,
      verifiedByUserId: userContext.userId,
    },
    update: {
      orthancStudyId: study.orthancStudyId,
      studyInstanceUid: study.studyInstanceUid,
      status: PacsStudyLinkStatus.LINKED,
      verifiedAt: now,
      verifiedByUserId: userContext.userId,
    },
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'PACS_STUDY_RECONCILED',
    entityType: 'ImagingOrder',
    entityId: order.id,
    details: {
      pacsStudyLinkId: pacsStudyLink.id,
      orthancStudyId: study.orthancStudyId,
      accessionNumber: order.accessionNumber,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    outcome: PacsStudyLookupOutcome.MATCHED,
    message: 'PACS study successfully reconciled and linked to RIS imaging order.',
    link: pacsStudyLink,
    metadata: study,
  };
}


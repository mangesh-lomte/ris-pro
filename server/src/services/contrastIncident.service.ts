import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  OrderStatus,
  PreparationStatus,
  SafetyStatus,
  ScanState,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

export const CONTRAST_ROUTES = ['IV', 'ORAL', 'OTHER'] as const;
export type ContrastRouteType = (typeof CONTRAST_ROUTES)[number];

export const INCIDENT_CATEGORIES = [
  'CONTRAST_REACTION',
  'EXTRAVASATION',
  'PATIENT_DISTRESS',
  'PATIENT_REQUEST',
  'EQUIPMENT_RELATED',
  'WORKFLOW_EVENT',
  'OTHER',
] as const;
export type IncidentCategoryType = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_WORKFLOW_ACTIONS = [
  'SCAN_INTERRUPTED',
  'SCAN_STOPPED',
  'CLINICIAN_NOTIFIED',
  'PATIENT_MONITORED',
  'OTHER',
] as const;
export type IncidentWorkflowActionType = (typeof INCIDENT_WORKFLOW_ACTIONS)[number];

export interface UserContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordContrastInput {
  contrastAgentName: string;
  concentration?: string;
  volume: number;
  volumeUnit?: string;
  route: ContrastRouteType;
  routeNotes?: string;
  batchLotNumber?: string;
  expirationDate?: string | Date;
  administrationNotes?: string;
}

export interface RecordIncidentInput {
  category: IncidentCategoryType;
  description: string;
  contrastAdministrationId?: string;
  clinicianNotified?: boolean;
  notificationNotes?: string;
  workflowActionTaken?: IncidentWorkflowActionType;
  workflowActionNotes?: string;
}

/**
 * Loads authoritative contrast administration context for an exam identifier.
 */
export async function getContrastContext(identifier: string) {
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
      patient: {
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          isActive: true,
        },
      },
      confirmedProtocol: true,
      safetyScreening: {
        select: {
          safetyStatus: true,
          reviewedAt: true,
        },
      },
      preparation: {
        select: {
          preparationStatus: true,
          preparedAt: true,
        },
      },
      scanLifecycles: {
        orderBy: { attemptNumber: 'desc' },
        include: {
          equipment: true,
        },
      },
      contrastAdministrations: {
        orderBy: { administeredAt: 'desc' },
        include: {
          administeredByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          incidents: {
            select: { id: true, category: true, description: true, recordedAt: true },
          },
        },
      },
      incidents: {
        orderBy: { recordedAt: 'desc' },
        include: {
          recordedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          contrastAdministration: {
            select: { id: true, contrastAgentName: true, volume: true, volumeUnit: true, administeredAt: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const currentScan = order.scanLifecycles[0] || null;

  return {
    orderId: order.id,
    patientId: order.patient.patientId,
    accessionNumber: order.accessionNumber,
    modality: order.modality,
    examination: order.examinationName,
    bodyPart: order.bodyPart,
    priority: order.priority,
    contrastRequired: order.contrastRequired,
    orderStatus: order.orderStatus,
    safetyStatus: order.safetyScreening?.safetyStatus || SafetyStatus.NOT_STARTED,
    isSafetyCleared: order.safetyScreening?.safetyStatus === SafetyStatus.CLEARED,
    preparationStatus: order.preparation?.preparationStatus || PreparationStatus.NOT_STARTED,
    isPreparationComplete: order.preparation?.preparationStatus === PreparationStatus.COMPLETE,
    scanState: currentScan?.state || ScanState.NOT_STARTED,
    patient: {
      id: order.patient.id,
      patientId: order.patient.patientId,
      firstName: order.patient.firstName,
      lastName: order.patient.lastName,
      dateOfBirth: order.patient.dateOfBirth,
      gender: order.patient.gender,
      isActive: order.patient.isActive,
    },
    equipment: currentScan?.equipment
      ? {
          id: currentScan.equipment.id,
          name: currentScan.equipment.name,
          modality: currentScan.equipment.modality,
          location: currentScan.equipment.location,
        }
      : null,
    protocol: order.confirmedProtocol
      ? {
          id: order.confirmedProtocol.id,
          code: order.confirmedProtocol.code,
          name: order.confirmedProtocol.name,
        }
      : null,
    administrations: order.contrastAdministrations.map((adm) => ({
      id: adm.id,
      contrastAgentName: adm.contrastAgentName,
      concentration: adm.concentration,
      volume: Number(adm.volume),
      volumeUnit: adm.volumeUnit,
      route: adm.route,
      routeNotes: adm.routeNotes,
      batchLotNumber: adm.batchLotNumber,
      expirationDate: adm.expirationDate,
      administeredAt: adm.administeredAt,
      administeredBy: adm.administeredByUser,
      administrationNotes: adm.administrationNotes,
      hasIncident: adm.incidents.length > 0,
      incidents: adm.incidents,
    })),
    incidents: order.incidents.map((inc) => ({
      id: inc.id,
      category: inc.category,
      description: inc.description,
      occurredAt: inc.occurredAt,
      recordedAt: inc.recordedAt,
      recordedBy: inc.recordedByUser,
      clinicianNotified: inc.clinicianNotified,
      clinicianNotifiedAt: inc.clinicianNotifiedAt,
      notificationNotes: inc.notificationNotes,
      workflowActionTaken: inc.workflowActionTaken,
      workflowActionNotes: inc.workflowActionNotes,
      contrastAdministration: inc.contrastAdministration
        ? {
            id: inc.contrastAdministration.id,
            contrastAgentName: inc.contrastAdministration.contrastAgentName,
            volume: Number(inc.contrastAdministration.volume),
            volumeUnit: inc.contrastAdministration.volumeUnit,
            administeredAt: inc.contrastAdministration.administeredAt,
          }
        : null,
    })),
  };
}

/**
 * Atomically records contrast administration for an active examination.
 */
export async function recordContrastAdministration(
  identifier: string,
  payload: RecordContrastInput,
  userContext: UserContext
) {
  const now = new Date();

  // Validate expiration date if provided
  let parsedExpirationDate: Date | null = null;
  if (payload.expirationDate) {
    parsedExpirationDate = new Date(payload.expirationDate);
    if (isNaN(parsedExpirationDate.getTime())) {
      throw AppError.badRequest('Invalid expiration date format.', 'VALIDATION_ERROR');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedExpirationDate < today) {
      throw AppError.badRequest(
        'The documented contrast product has expired. Expired contrast media cannot be administered.',
        'VALIDATION_ERROR'
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Re-read authoritative order state
    const order = await tx.imagingOrder.findFirst({
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
        safetyScreening: true,
        preparation: true,
        confirmedProtocol: true,
        scanLifecycles: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;

    // 2. Active Patient & Terminal State Checks
    if (!order.patient.isActive) {
      throw AppError.conflict('Cannot administer contrast to an inactive patient record.', 'PATIENT_INACTIVE');
    }

    if (order.orderStatus === OrderStatus.SCAN_CANCELLED || order.orderStatus === OrderStatus.CANCELLED) {
      throw AppError.conflict(
        `Cannot administer contrast for a cancelled examination (status: ${order.orderStatus}).`,
        'SCAN_CANCELLED'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_COMPLETED) {
      throw AppError.conflict(
        'Cannot administer contrast for an examination with completed scan acquisition.',
        'SCAN_COMPLETED'
      );
    }

    // 3. Contrast Eligibility Check (Strict authoritative database field)
    if (!order.contrastRequired) {
      throw AppError.conflict(
        'Contrast administration is not required or indicated for this non-contrast examination.',
        'CONTRAST_NOT_REQUIRED'
      );
    }

    // 4. Safety Milestone Gate
    if (order.safetyScreening?.safetyStatus !== SafetyStatus.CLEARED) {
      throw AppError.conflict(
        `Safety screening must be CLEARED before contrast administration. Current safety status: '${order.safetyScreening?.safetyStatus || 'NOT_STARTED'}'.`,
        'SAFETY_CLEARANCE_REQUIRED'
      );
    }

    // 5. Preparation Milestone Gate
    if (order.preparation?.preparationStatus !== PreparationStatus.COMPLETE) {
      throw AppError.conflict(
        `Patient preparation must be COMPLETE before contrast administration. Current preparation status: '${order.preparation?.preparationStatus || 'NOT_STARTED'}'.`,
        'PREPARATION_INCOMPLETE'
      );
    }

    // 6. Scan Lifecycle Workflow Gate (Restricted to active acquisition)
    if (order.orderStatus === OrderStatus.READY_FOR_SCAN) {
      throw AppError.conflict(
        'Cannot administer contrast before scan acquisition has started. Exam must be in SCAN_IN_PROGRESS.',
        'SCAN_NOT_IN_PROGRESS'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_INTERRUPTED) {
      throw AppError.conflict(
        'Cannot record first-time contrast administration while scan acquisition is interrupted. Resume scan to SCAN_IN_PROGRESS first.',
        'SCAN_NOT_IN_PROGRESS'
      );
    }

    if (
      order.orderStatus !== OrderStatus.SCAN_IN_PROGRESS ||
      currentScan?.state !== ScanState.IN_PROGRESS
    ) {
      throw AppError.conflict(
        `Contrast administration requires scan acquisition to be active (status: ${order.orderStatus}).`,
        'SCAN_NOT_IN_PROGRESS'
      );
    }

    // 7. Persist ContrastAdministration record
    const contrastAdmin = await tx.contrastAdministration.create({
      data: {
        imagingOrderId: order.id,
        scanLifecycleId: currentScan?.id || null,
        contrastAgentName: payload.contrastAgentName.trim(),
        concentration: payload.concentration?.trim() || null,
        volume: new Prisma.Decimal(payload.volume),
        volumeUnit: payload.volumeUnit || 'mL',
        route: payload.route,
        routeNotes: payload.routeNotes?.trim() || null,
        batchLotNumber: payload.batchLotNumber?.trim() || null,
        expirationDate: parsedExpirationDate,
        administeredAt: now,
        administeredByUserId: userContext.userId,
        administrationNotes: payload.administrationNotes?.trim() || null,
      },
      include: {
        administeredByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    return {
      order,
      contrastAdmin,
    };
  });

  // 8. Audit Logging
  await logAuditEvent({
    userId: userContext.userId,
    action: 'CONTRAST_ADMINISTERED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.order.patient.patientId,
      contrastAdministrationId: result.contrastAdmin.id,
      contrastAgentName: result.contrastAdmin.contrastAgentName,
      volume: Number(result.contrastAdmin.volume),
      volumeUnit: result.contrastAdmin.volumeUnit,
      route: result.contrastAdmin.route,
      administeredAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    id: result.contrastAdmin.id,
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    patientId: result.order.patient.patientId,
    contrastAgentName: result.contrastAdmin.contrastAgentName,
    concentration: result.contrastAdmin.concentration,
    volume: Number(result.contrastAdmin.volume),
    volumeUnit: result.contrastAdmin.volumeUnit,
    route: result.contrastAdmin.route,
    routeNotes: result.contrastAdmin.routeNotes,
    batchLotNumber: result.contrastAdmin.batchLotNumber,
    expirationDate: result.contrastAdmin.expirationDate,
    administeredAt: result.contrastAdmin.administeredAt,
    administeredBy: result.contrastAdmin.administeredByUser,
    administrationNotes: result.contrastAdmin.administrationNotes,
    hasIncident: false,
  };
}

/**
 * Loads list of incidents for an exam identifier.
 */
export async function getIncidents(identifier: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [
        { id: identifier },
        { accessionNumber: identifier },
        { appointment: { id: identifier } },
        { appointment: { appointmentNumber: identifier } },
      ],
    },
    select: { id: true, accessionNumber: true },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const incidents = await prisma.technologistIncident.findMany({
    where: { imagingOrderId: order.id },
    orderBy: { recordedAt: 'asc' },
    include: {
      recordedByUser: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      contrastAdministration: {
        select: {
          id: true,
          contrastAgentName: true,
          volume: true,
          volumeUnit: true,
          administeredAt: true,
        },
      },
    },
  });

  return incidents.map((inc) => ({
    id: inc.id,
    imagingOrderId: inc.imagingOrderId,
    accessionNumber: order.accessionNumber,
    category: inc.category,
    description: inc.description,
    occurredAt: inc.occurredAt,
    recordedAt: inc.recordedAt,
    recordedBy: inc.recordedByUser,
    clinicianNotified: inc.clinicianNotified,
    clinicianNotifiedAt: inc.clinicianNotifiedAt,
    notificationNotes: inc.notificationNotes,
    workflowActionTaken: inc.workflowActionTaken,
    workflowActionNotes: inc.workflowActionNotes,
    contrastAdministration: inc.contrastAdministration
      ? {
          id: inc.contrastAdministration.id,
          contrastAgentName: inc.contrastAdministration.contrastAgentName,
          volume: Number(inc.contrastAdministration.volume),
          volumeUnit: inc.contrastAdministration.volumeUnit,
          administeredAt: inc.contrastAdministration.administeredAt,
        }
      : null,
  }));
}

/**
 * Records a technologist incident associated with an active examination.
 * DOES NOT mutate ScanLifecycle state or OrderStatus.
 */
export async function recordIncident(
  identifier: string,
  payload: RecordIncidentInput,
  userContext: UserContext
) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Re-read authoritative order state
    const order = await tx.imagingOrder.findFirst({
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
        scanLifecycles: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;

    // 2. Patient active check
    if (!order.patient.isActive) {
      throw AppError.conflict('Cannot record incident for an inactive patient record.', 'PATIENT_INACTIVE');
    }

    // 3. Workflow State Gate: Incident recording is permitted during SCAN_IN_PROGRESS or SCAN_INTERRUPTED
    if (order.orderStatus === OrderStatus.READY_FOR_SCAN) {
      throw AppError.conflict(
        'Cannot record incident for an exam that has not started acquisition.',
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_COMPLETED) {
      throw AppError.conflict(
        'Cannot record new incidents on a completed scan acquisition in this phase.',
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_CANCELLED || order.orderStatus === OrderStatus.CANCELLED) {
      throw AppError.conflict(
        `Cannot record incidents on a cancelled examination (status: ${order.orderStatus}).`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const isPermittedStatus =
      order.orderStatus === OrderStatus.SCAN_IN_PROGRESS ||
      order.orderStatus === OrderStatus.SCAN_INTERRUPTED;

    if (!isPermittedStatus) {
      throw AppError.conflict(
        `Incident recording is restricted to active scan acquisition states (SCAN_IN_PROGRESS or SCAN_INTERRUPTED). Current status: ${order.orderStatus}`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    // 4. Validate contrast link if provided
    let linkedContrastId: string | null = null;
    if (payload.contrastAdministrationId) {
      const linkedContrast = await tx.contrastAdministration.findUnique({
        where: { id: payload.contrastAdministrationId },
      });

      if (!linkedContrast || linkedContrast.imagingOrderId !== order.id) {
        throw AppError.badRequest(
          'Referenced contrast administration record does not belong to this exam.',
          'INVALID_CONTRAST_LINK'
        );
      }
      linkedContrastId = linkedContrast.id;
    }

    // 5. Persist TechnologistIncident (WITHOUT MUTATING orderStatus or scanLifecycle.state)
    const incident = await tx.technologistIncident.create({
      data: {
        imagingOrderId: order.id,
        scanLifecycleId: currentScan?.id || null,
        contrastAdministrationId: linkedContrastId,
        category: payload.category,
        description: payload.description.trim(),
        occurredAt: now,
        recordedAt: now,
        recordedByUserId: userContext.userId,
        clinicianNotified: Boolean(payload.clinicianNotified),
        clinicianNotifiedAt: payload.clinicianNotified ? now : null,
        notificationNotes: payload.notificationNotes?.trim() || null,
        workflowActionTaken: payload.workflowActionTaken || null,
        workflowActionNotes: payload.workflowActionNotes?.trim() || null,
      },
      include: {
        recordedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        contrastAdministration: {
          select: { id: true, contrastAgentName: true, volume: true, volumeUnit: true, administeredAt: true },
        },
      },
    });

    return {
      order,
      incident,
    };
  });

  // 6. Audit Logging
  await logAuditEvent({
    userId: userContext.userId,
    action: 'INCIDENT_RECORDED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.order.patient.patientId,
      incidentId: result.incident.id,
      category: result.incident.category,
      clinicianNotified: result.incident.clinicianNotified,
      workflowActionTaken: result.incident.workflowActionTaken,
      recordedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  if (result.incident.clinicianNotified) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'CLINICIAN_NOTIFICATION_RECORDED',
      entityType: 'ImagingOrder',
      entityId: result.order.id,
      details: {
        accessionNumber: result.order.accessionNumber,
        patientId: result.order.patient.patientId,
        incidentId: result.incident.id,
        category: result.incident.category,
        notifiedAt: now,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  }

  return {
    id: result.incident.id,
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    patientId: result.order.patient.patientId,
    category: result.incident.category,
    description: result.incident.description,
    occurredAt: result.incident.occurredAt,
    recordedAt: result.incident.recordedAt,
    recordedBy: result.incident.recordedByUser,
    clinicianNotified: result.incident.clinicianNotified,
    clinicianNotifiedAt: result.incident.clinicianNotifiedAt,
    notificationNotes: result.incident.notificationNotes,
    workflowActionTaken: result.incident.workflowActionTaken,
    workflowActionNotes: result.incident.workflowActionNotes,
    contrastAdministration: result.incident.contrastAdministration
      ? {
          id: result.incident.contrastAdministration.id,
          contrastAgentName: result.incident.contrastAdministration.contrastAgentName,
          volume: Number(result.incident.contrastAdministration.volume),
          volumeUnit: result.incident.contrastAdministration.volumeUnit,
          administeredAt: result.incident.contrastAdministration.administeredAt,
        }
      : null,
  };
}

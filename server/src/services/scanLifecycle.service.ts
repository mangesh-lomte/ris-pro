import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  EquipmentStatus,
  OrderStatus,
  PreparationStatus,
  SafetyStatus,
  ScanLifecycleAction,
  ScanState,
} from '@prisma/client';

export const INTERRUPTION_REASONS = [
  'PATIENT_REQUEST',
  'EQUIPMENT_ISSUE',
  'WORKFLOW_ISSUE',
  'OTHER',
] as const;

export type InterruptionReason = (typeof INTERRUPTION_REASONS)[number];

export const CANCELLATION_REASONS = [
  'PATIENT_REQUEST',
  'PATIENT_UNABLE_TO_CONTINUE',
  'EQUIPMENT_ISSUE',
  'ORDER_CANCELLED',
  'WORKFLOW_ISSUE',
  'OTHER',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export interface UserContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface InterruptScanInput {
  reason: InterruptionReason;
  notes?: string;
}

export interface CancelScanInput {
  reason: CancellationReason;
  notes?: string;
}

/**
 * Loads authoritative scan lifecycle context for an exam identifier.
 */
export async function getScanLifecycleContext(identifier: string) {
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
      appointment: {
        include: {
          equipment: true,
          examDefinition: true,
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
          startedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          interruptedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          resumedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          completedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          cancelledByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          events: {
            orderBy: { timestamp: 'asc' },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  const currentScan = order.scanLifecycles[0] || null;

  const assignedEquipment =
    currentScan?.equipment || order.appointment?.equipment || null;

  return {
    orderId: order.id,
    patientId: order.patient.patientId,
    accessionNumber: order.accessionNumber,
    orderStatus: order.orderStatus,
    modality: order.modality,
    examination: order.examinationName,
    bodyPart: order.bodyPart,
    priority: order.priority,
    contrastRequired: order.contrastRequired,
    patient: {
      id: order.patient.id,
      patientId: order.patient.patientId,
      firstName: order.patient.firstName,
      lastName: order.patient.lastName,
      dateOfBirth: order.patient.dateOfBirth,
      gender: order.patient.gender,
      isActive: order.patient.isActive,
    },
    equipment: assignedEquipment
      ? {
        id: assignedEquipment.id,
        name: assignedEquipment.name,
        modality: assignedEquipment.modality,
        location: assignedEquipment.location,
        status: assignedEquipment.status,
      }
      : null,
    protocol: order.confirmedProtocol
      ? {
        id: order.confirmedProtocol.id,
        code: order.confirmedProtocol.code,
        name: order.confirmedProtocol.name,
        modality: order.confirmedProtocol.modality,
        bodyPart: order.confirmedProtocol.bodyPart,
        description: order.confirmedProtocol.description,
      }
      : null,
    safetyStatus: order.safetyScreening?.safetyStatus || SafetyStatus.NOT_STARTED,
    isSafetyCleared: order.safetyScreening?.safetyStatus === SafetyStatus.CLEARED,
    preparationStatus: order.preparation?.preparationStatus || PreparationStatus.NOT_STARTED,
    isPreparationComplete: order.preparation?.preparationStatus === PreparationStatus.COMPLETE,
    scan: currentScan
      ? {
        id: currentScan.id,
        attemptNumber: currentScan.attemptNumber,
        state: currentScan.state,
        startedAt: currentScan.startedAt,
        startedBy: currentScan.startedByUser,
        interruptedAt: currentScan.interruptedAt,
        interruptedBy: currentScan.interruptedByUser,
        interruptionReason: currentScan.interruptionReason,
        interruptionNotes: currentScan.interruptionNotes,
        resumedAt: currentScan.resumedAt,
        resumedBy: currentScan.resumedByUser,
        completedAt: currentScan.completedAt,
        completedBy: currentScan.completedByUser,
        cancelledAt: currentScan.cancelledAt,
        cancelledBy: currentScan.cancelledByUser,
        cancellationReason: currentScan.cancellationReason,
        cancellationNotes: currentScan.cancellationNotes,
        events: currentScan.events.map((evt) => ({
          id: evt.id,
          action: evt.action,
          timestamp: evt.timestamp,
          reason: evt.reason,
          notes: evt.notes,
          user: evt.user,
        })),
      }
      : null,
    attempts: order.scanLifecycles.map((s) => ({
      id: s.id,
      attemptNumber: s.attemptNumber,
      state: s.state,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      cancelledAt: s.cancelledAt,
    })),
  };
}

/**
 * Atomically transitions an order from READY_FOR_SCAN to SCAN_IN_PROGRESS.
 */
export async function startScan(
  identifier: string,
  inputEquipmentId: string | undefined,
  userContext: UserContext
) {
  const now = new Date();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // 1. Re-read authoritative order state inside transaction
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
          appointment: {
            include: { equipment: true },
          },
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

      // 2. Active Patient & Cancellation Check
      if (!order.patient.isActive) {
        throw AppError.conflict('Cannot start scan for an inactive patient record.', 'PATIENT_INACTIVE');
      }

      if (order.orderStatus === OrderStatus.CANCELLED || order.orderStatus === OrderStatus.SCAN_CANCELLED) {
        throw AppError.conflict(`Cannot start scan on cancelled order (status: ${order.orderStatus}).`, 'SCAN_CANCELLED');
      }

      // 3. Concurrency / Duplicate Start Check
      const activeScan = order.scanLifecycles.find(
        (s) => s.state === ScanState.IN_PROGRESS || s.state === ScanState.INTERRUPTED
      );
      if (
        order.orderStatus === OrderStatus.SCAN_IN_PROGRESS ||
        activeScan
      ) {
        throw AppError.conflict(
          `Scan acquisition is already in progress for accession ${order.accessionNumber}.`,
          'SCAN_ALREADY_STARTED'
        );
      }

      if (order.orderStatus === OrderStatus.SCAN_COMPLETED) {
        throw AppError.conflict(
          `Scan acquisition for accession ${order.accessionNumber} is already completed.`,
          'SCAN_ALREADY_COMPLETED'
        );
      }

      // 4. Strict Milestone Prerequisites: READY_FOR_SCAN
      if (order.orderStatus !== OrderStatus.READY_FOR_SCAN) {
        throw AppError.conflict(
          `Cannot start scan. Current order status is '${order.orderStatus}'. Exam must be in 'READY_FOR_SCAN' status.`,
          'SCAN_NOT_READY'
        );
      }

      // 5. Safety Milestone Gate
      if (order.safetyScreening?.safetyStatus !== SafetyStatus.CLEARED) {
        throw AppError.conflict(
          `Safety screening must be CLEARED before scanning. Current safety status: '${order.safetyScreening?.safetyStatus || 'NOT_STARTED'}'.`,
          'SCAN_NOT_READY'
        );
      }

      // 6. Preparation Milestone Gate
      if (order.preparation?.preparationStatus !== PreparationStatus.COMPLETE) {
        throw AppError.conflict(
          `Patient preparation must be COMPLETE before scanning. Current preparation status: '${order.preparation?.preparationStatus || 'NOT_STARTED'}'.`,
          'SCAN_NOT_READY'
        );
      }

      // 7. Confirmed Protocol Milestone Gate
      if (!order.confirmedProtocol || !order.confirmedProtocol.isActive) {
        throw AppError.conflict(
          'An active, approved workflow protocol must be confirmed before starting scan acquisition.',
          'SCAN_NOT_READY'
        );
      }

      // 8. Equipment Validation Gate
      const resolvedEquipmentId = inputEquipmentId || order.appointment?.equipmentId;
      if (!resolvedEquipmentId) {
        throw AppError.conflict(
          'No equipment assigned or available for scan acquisition. Assign equipment to the appointment.',
          'EQUIPMENT_UNAVAILABLE'
        );
      }

      const equipment = await tx.equipment.findUnique({
        where: { id: resolvedEquipmentId },
      });

      if (!equipment) {
        throw AppError.notFound(`Assigned equipment ID '${resolvedEquipmentId}' does not exist.`);
      }

      if (equipment.modality !== order.modality) {
        throw AppError.conflict(
          `Equipment modality mismatch: scanner '${equipment.name}' (${equipment.modality}) cannot be used for ${order.modality} examination.`,
          'EQUIPMENT_UNAVAILABLE'
        );
      }

      if (
        equipment.status === EquipmentStatus.MAINTENANCE ||
        equipment.status === EquipmentStatus.OUT_OF_SERVICE
      ) {
        throw AppError.conflict(
          `Assigned scanner '${equipment.name}' is currently unavailable (status: ${equipment.status}).`,
          'EQUIPMENT_UNAVAILABLE'
        );
      }

      // 9. Create ScanLifecycle and update orderStatus to SCAN_IN_PROGRESS
      const maxAttempt = order.scanLifecycles.reduce((max, s) => Math.max(max, s.attemptNumber), 0);
      const nextAttemptNumber = maxAttempt + 1;

      const scanLifecycle = await tx.scanLifecycle.create({
        data: {
          imagingOrderId: order.id,
          attemptNumber: nextAttemptNumber,
          equipmentId: equipment.id,
          startedByUserId: userContext.userId,
          startedAt: now,
          state: ScanState.IN_PROGRESS,
          events: {
            create: {
              action: ScanLifecycleAction.STARTED,
              userId: userContext.userId,
              timestamp: now,
              metadata: {
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                protocolCode: order.confirmedProtocol.code,
              },
            },
          },
        },
        include: {
          equipment: true,
          events: true,
        },
      });

      const updatedOrder = await tx.imagingOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.SCAN_IN_PROGRESS,
        },
      });

      return {
        order: updatedOrder,
        patient: order.patient,
        equipment,
        protocol: order.confirmedProtocol,
        scanLifecycle,
      };
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw AppError.conflict(
        'Scan acquisition is already in progress for this order.',
        'SCAN_ALREADY_STARTED'
      );
    }
    throw error;
  }

  // 10. Audit Logging
  await logAuditEvent({
    userId: userContext.userId,
    action: 'SCAN_STARTED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.patient.patientId,
      attemptNumber: result.scanLifecycle.attemptNumber,
      equipmentId: result.equipment.id,
      equipmentName: result.equipment.name,
      protocolCode: result.protocol.code,
      startedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    patientId: result.patient.patientId,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    modality: result.order.modality,
    examination: result.order.examinationName,
    equipment: {
      id: result.equipment.id,
      name: result.equipment.name,
    },
    protocol: {
      id: result.protocol.id,
      code: result.protocol.code,
      name: result.protocol.name,
    },
    scan: {
      id: result.scanLifecycle.id,
      attemptNumber: result.scanLifecycle.attemptNumber,
      state: result.scanLifecycle.state,
      startedAt: result.scanLifecycle.startedAt,
      interruptedAt: null,
      resumedAt: null,
      completedAt: null,
      cancelledAt: null,
    },
  };
}

/**
 * Atomically interrupts an active scan (SCAN_IN_PROGRESS -> SCAN_INTERRUPTED).
 */
export async function interruptScan(
  identifier: string,
  payload: InterruptScanInput,
  userContext: UserContext
) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
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

    if (order.orderStatus === OrderStatus.READY_FOR_SCAN) {
      throw AppError.conflict(
        'Cannot interrupt a scan that has not been started yet.',
        'SCAN_NOT_IN_PROGRESS'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_INTERRUPTED) {
      throw AppError.conflict(
        'Scan acquisition is already in interrupted state.',
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_COMPLETED) {
      throw AppError.conflict(
        'Cannot interrupt a completed scan acquisition.',
        'SCAN_ALREADY_COMPLETED'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_CANCELLED) {
      throw AppError.conflict(
        'Cannot interrupt a cancelled scan acquisition.',
        'SCAN_CANCELLED'
      );
    }

    if (
      order.orderStatus !== OrderStatus.SCAN_IN_PROGRESS ||
      !currentScan ||
      currentScan.state !== ScanState.IN_PROGRESS
    ) {
      throw AppError.conflict(
        `Cannot interrupt scan from current order status '${order.orderStatus}'. Scan must be SCAN_IN_PROGRESS.`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const cleanNotes = payload.notes ? payload.notes.trim().slice(0, 1000) : null;

    const updatedLifecycle = await tx.scanLifecycle.update({
      where: { id: currentScan.id },
      data: {
        state: ScanState.INTERRUPTED,
        interruptedAt: now,
        interruptedByUserId: userContext.userId,
        interruptionReason: payload.reason,
        interruptionNotes: cleanNotes,
        events: {
          create: {
            action: ScanLifecycleAction.INTERRUPTED,
            userId: userContext.userId,
            timestamp: now,
            reason: payload.reason,
            notes: cleanNotes,
          },
        },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.SCAN_INTERRUPTED,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scanLifecycle: updatedLifecycle,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'SCAN_INTERRUPTED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.patient.patientId,
      reason: payload.reason,
      notes: payload.notes || null,
      interruptedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scan: {
      id: result.scanLifecycle.id,
      attemptNumber: result.scanLifecycle.attemptNumber,
      state: result.scanLifecycle.state,
      startedAt: result.scanLifecycle.startedAt,
      interruptedAt: result.scanLifecycle.interruptedAt,
      interruptionReason: result.scanLifecycle.interruptionReason,
      interruptionNotes: result.scanLifecycle.interruptionNotes,
      resumedAt: result.scanLifecycle.resumedAt,
      completedAt: null,
      cancelledAt: null,
    },
  };
}

/**
 * Atomically resumes an interrupted scan (SCAN_INTERRUPTED -> SCAN_IN_PROGRESS).
 */
export async function resumeScan(identifier: string, userContext: UserContext) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
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

    if (order.orderStatus === OrderStatus.SCAN_IN_PROGRESS) {
      throw AppError.conflict(
        'Scan acquisition is already in progress.',
        'SCAN_ALREADY_STARTED'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_COMPLETED) {
      throw AppError.conflict(
        'Cannot resume a completed scan acquisition.',
        'SCAN_ALREADY_COMPLETED'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_CANCELLED) {
      throw AppError.conflict(
        'Cannot resume a cancelled scan acquisition.',
        'SCAN_CANCELLED'
      );
    }

    if (
      order.orderStatus !== OrderStatus.SCAN_INTERRUPTED ||
      !currentScan ||
      currentScan.state !== ScanState.INTERRUPTED
    ) {
      throw AppError.conflict(
        `Cannot resume scan from status '${order.orderStatus}'. Scan must be SCAN_INTERRUPTED.`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const updatedLifecycle = await tx.scanLifecycle.update({
      where: { id: currentScan.id },
      data: {
        state: ScanState.IN_PROGRESS,
        resumedAt: now,
        resumedByUserId: userContext.userId,
        events: {
          create: {
            action: ScanLifecycleAction.RESUMED,
            userId: userContext.userId,
            timestamp: now,
          },
        },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.SCAN_IN_PROGRESS,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scanLifecycle: updatedLifecycle,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'SCAN_RESUMED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.patient.patientId,
      resumedAt: now,
      originalStartedAt: result.scanLifecycle.startedAt,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scan: {
      id: result.scanLifecycle.id,
      attemptNumber: result.scanLifecycle.attemptNumber,
      state: result.scanLifecycle.state,
      startedAt: result.scanLifecycle.startedAt,
      interruptedAt: result.scanLifecycle.interruptedAt,
      resumedAt: result.scanLifecycle.resumedAt,
      completedAt: null,
      cancelledAt: null,
    },
  };
}

/**
 * Atomically marks an in-progress scan as completed (SCAN_IN_PROGRESS -> SCAN_COMPLETED).
 */
export async function finishScan(identifier: string, userContext: UserContext) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
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

    if (order.orderStatus === OrderStatus.READY_FOR_SCAN) {
      throw AppError.conflict(
        'Cannot finish scan acquisition before it has been started.',
        'SCAN_NOT_IN_PROGRESS'
      );
    }

    if (order.orderStatus === OrderStatus.SCAN_INTERRUPTED) {
      throw AppError.conflict(
        'Cannot finish an interrupted scan directly. You must resume the scan first before completing acquisition.',
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    if (
      order.orderStatus === OrderStatus.SCAN_COMPLETED ||
      currentScan?.state === ScanState.COMPLETED
    ) {
      throw AppError.conflict(
        'Scan acquisition is already marked completed.',
        'SCAN_ALREADY_COMPLETED'
      );
    }

    if (
      order.orderStatus === OrderStatus.SCAN_CANCELLED ||
      currentScan?.state === ScanState.CANCELLED
    ) {
      throw AppError.conflict(
        'Cannot complete a cancelled scan acquisition.',
        'SCAN_CANCELLED'
      );
    }

    if (
      order.orderStatus !== OrderStatus.SCAN_IN_PROGRESS ||
      !currentScan ||
      currentScan.state !== ScanState.IN_PROGRESS
    ) {
      throw AppError.conflict(
        `Cannot finish scan from status '${order.orderStatus}'. Scan must be SCAN_IN_PROGRESS.`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    // Verify timestamp monotonicity: completedAt >= startedAt
    if (currentScan.startedAt && now < currentScan.startedAt) {
      throw AppError.conflict(
        'Scan completion timestamp cannot precede start timestamp.',
        'INVALID_TIMESTAMP'
      );
    }

    const updatedLifecycle = await tx.scanLifecycle.update({
      where: { id: currentScan.id },
      data: {
        state: ScanState.COMPLETED,
        completedAt: now,
        completedByUserId: userContext.userId,
        events: {
          create: {
            action: ScanLifecycleAction.COMPLETED,
            userId: userContext.userId,
            timestamp: now,
          },
        },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.SCAN_COMPLETED,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scanLifecycle: updatedLifecycle,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'SCAN_COMPLETED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.patient.patientId,
      startedAt: result.scanLifecycle.startedAt,
      completedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scan: {
      id: result.scanLifecycle.id,
      attemptNumber: result.scanLifecycle.attemptNumber,
      state: result.scanLifecycle.state,
      startedAt: result.scanLifecycle.startedAt,
      completedAt: result.scanLifecycle.completedAt,
    },
  };
}

/**
 * Atomically cancels a scan from READY_FOR_SCAN or SCAN_INTERRUPTED.
 * Direct cancellation from SCAN_IN_PROGRESS is strictly rejected.
 */
export async function cancelScan(
  identifier: string,
  payload: CancelScanInput,
  userContext: UserContext
) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
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
        appointment: true,
        scanLifecycles: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;

    // SECTION 7 STRICT RULE: SCAN_IN_PROGRESS cannot cancel directly!
    if (order.orderStatus === OrderStatus.SCAN_IN_PROGRESS) {
      throw AppError.conflict(
        'Direct cancellation of an active scan in progress is prohibited. The scan must first be interrupted before cancellation can occur.',
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    if (
      order.orderStatus === OrderStatus.SCAN_COMPLETED ||
      currentScan?.state === ScanState.COMPLETED
    ) {
      throw AppError.conflict(
        'Cannot cancel a scan that has already been completed.',
        'SCAN_ALREADY_COMPLETED'
      );
    }

    if (
      order.orderStatus === OrderStatus.SCAN_CANCELLED ||
      currentScan?.state === ScanState.CANCELLED
    ) {
      throw AppError.conflict(
        'Scan acquisition is already cancelled.',
        'SCAN_CANCELLED'
      );
    }

    // Allowed transition origins: READY_FOR_SCAN or SCAN_INTERRUPTED
    if (
      order.orderStatus !== OrderStatus.READY_FOR_SCAN &&
      order.orderStatus !== OrderStatus.SCAN_INTERRUPTED
    ) {
      throw AppError.conflict(
        `Cannot cancel scan acquisition from status '${order.orderStatus}'. Permitted origin states: READY_FOR_SCAN or SCAN_INTERRUPTED.`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const cleanNotes = payload.notes ? payload.notes.trim().slice(0, 1000) : null;

    let scanLifecycle;

    if (currentScan && order.orderStatus === OrderStatus.SCAN_INTERRUPTED) {
      // Order had already started and was in SCAN_INTERRUPTED
      scanLifecycle = await tx.scanLifecycle.update({
        where: { id: currentScan.id },
        data: {
          state: ScanState.CANCELLED,
          cancelledAt: now,
          cancelledByUserId: userContext.userId,
          cancellationReason: payload.reason,
          cancellationNotes: cleanNotes,
          events: {
            create: {
              action: ScanLifecycleAction.CANCELLED,
              userId: userContext.userId,
              timestamp: now,
              reason: payload.reason,
              notes: cleanNotes,
            },
          },
        },
      });
    } else {
      // Order was cancelled before starting (from READY_FOR_SCAN)
      const maxAttempt = order.scanLifecycles.reduce((max, s) => Math.max(max, s.attemptNumber), 0);
      scanLifecycle = await tx.scanLifecycle.create({
        data: {
          imagingOrderId: order.id,
          attemptNumber: maxAttempt + 1,
          equipmentId: order.appointment?.equipmentId || null,
          startedAt: now,
          state: ScanState.CANCELLED,
          cancelledAt: now,
          cancelledByUserId: userContext.userId,
          cancellationReason: payload.reason,
          cancellationNotes: cleanNotes,
          events: {
            create: {
              action: ScanLifecycleAction.CANCELLED,
              userId: userContext.userId,
              timestamp: now,
              reason: payload.reason,
              notes: cleanNotes,
            },
          },
        },
      });
    }

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.SCAN_CANCELLED,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scanLifecycle,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'SCAN_CANCELLED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      patientId: result.patient.patientId,
      reason: payload.reason,
      notes: payload.notes || null,
      cancelledAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scan: {
      id: result.scanLifecycle.id,
      attemptNumber: result.scanLifecycle.attemptNumber,
      state: result.scanLifecycle.state,
      startedAt: result.scanLifecycle.startedAt,
      cancelledAt: result.scanLifecycle.cancelledAt,
      cancellationReason: result.scanLifecycle.cancellationReason,
      cancellationNotes: result.scanLifecycle.cancellationNotes,
    },
  };
}

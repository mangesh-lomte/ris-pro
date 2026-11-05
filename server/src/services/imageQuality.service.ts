import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { getPacsGateway } from '../integrations/pacs';
import {
  ImageQualityReason,
  ImageQualityStatus,
  OrderStatus,
  PacsHandoffOutcome,
  PacsHandoffStatus,
  ScanState,
} from '@prisma/client';

export interface UserContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ImageQualityDecisionInput {
  reason: ImageQualityReason;
  notes?: string;
}

export interface ImageQualityAcceptInput {
  notes?: string;
}

/**
 * Loads authoritative Image Quality Review & Acquisition Context for an exam.
 */
export async function getImageQualityContext(identifier: string) {
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
      appointment: {
        include: { equipment: true },
      },
      scanLifecycles: {
        orderBy: { attemptNumber: 'desc' },
        include: {
          equipment: true,
          startedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
          completedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
          imageQualityReview: {
            include: {
              startedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
              reviewedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
              repeatAuthorizedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
              pacsHandoff: {
                include: {
                  initiatedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                  attempts: {
                    orderBy: { attemptNumber: 'asc' },
                    include: {
                      initiatedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                    },
                  },
                },
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
  const currentQA = currentScan?.imageQualityReview || null;
  const currentPacs = currentQA?.pacsHandoff || null;

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
        }
      : null,
    protocol: order.confirmedProtocol
      ? {
          id: order.confirmedProtocol.id,
          code: order.confirmedProtocol.code,
          name: order.confirmedProtocol.name,
          modality: order.confirmedProtocol.modality,
          bodyPart: order.confirmedProtocol.bodyPart,
        }
      : null,
    currentScan: currentScan
      ? {
          id: currentScan.id,
          attemptNumber: currentScan.attemptNumber,
          state: currentScan.state,
          startedAt: currentScan.startedAt,
          startedBy: currentScan.startedByUser,
          completedAt: currentScan.completedAt,
          completedBy: currentScan.completedByUser,
        }
      : null,
    imageQualityReview: currentQA
      ? {
          id: currentQA.id,
          status: currentQA.status,
          startedAt: currentQA.startedAt,
          startedBy: currentQA.startedByUser,
          reviewedAt: currentQA.reviewedAt,
          reviewedBy: currentQA.reviewedByUser,
          reasonCode: currentQA.reasonCode,
          notes: currentQA.notes,
          repeatAuthorizedAt: currentQA.repeatAuthorizedAt,
          repeatAuthorizedBy: currentQA.repeatAuthorizedByUser,
        }
      : null,
    pacsHandoff: currentPacs
      ? {
          id: currentPacs.id,
          status: currentPacs.status,
          attemptCount: currentPacs.attemptCount,
          initiatedAt: currentPacs.initiatedAt,
          initiatedBy: currentPacs.initiatedByUser,
          lastAttemptAt: currentPacs.lastAttemptAt,
          completedAt: currentPacs.completedAt,
          lastErrorCode: currentPacs.lastErrorCode,
          lastErrorMessage: currentPacs.lastErrorMessage,
          attempts: currentPacs.attempts.map((att) => ({
            id: att.id,
            attemptNumber: att.attemptNumber,
            startedAt: att.startedAt,
            completedAt: att.completedAt,
            outcome: att.outcome,
            errorCode: att.errorCode,
            errorMessage: att.errorMessage,
            initiatedBy: att.initiatedByUser,
          })),
        }
      : null,
    attemptHistory: order.scanLifecycles.map((s) => ({
      scanLifecycleId: s.id,
      attemptNumber: s.attemptNumber,
      state: s.state,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      qaStatus: s.imageQualityReview?.status || null,
      qaReasonCode: s.imageQualityReview?.reasonCode || null,
      qaNotes: s.imageQualityReview?.notes || null,
      repeatAuthorizedAt: s.imageQualityReview?.repeatAuthorizedAt || null,
      pacsStatus: s.imageQualityReview?.pacsHandoff?.status || null,
    })),
    flags: {
      canStartQA:
        order.orderStatus === OrderStatus.SCAN_COMPLETED &&
        currentScan?.state === ScanState.COMPLETED &&
        !currentQA,
      canAccept: currentQA?.status === ImageQualityStatus.PENDING,
      canRepeat: currentQA?.status === ImageQualityStatus.PENDING,
      canReject: currentQA?.status === ImageQualityStatus.PENDING,
      canAuthorizeRepeat:
        currentQA?.status === ImageQualityStatus.REPEAT_REQUIRED ||
        currentQA?.status === ImageQualityStatus.REJECTED,
      canInitiateHandoff:
        order.orderStatus === OrderStatus.PACS_READY &&
        currentQA?.status === ImageQualityStatus.ACCEPTED &&
        (!currentPacs || currentPacs.status === PacsHandoffStatus.READY),
      canRetryHandoff:
        order.orderStatus === OrderStatus.PACS_HANDOFF_FAILED &&
        currentPacs?.status === PacsHandoffStatus.FAILED,
    },
  };
}

/**
 * Transitions an exam from SCAN_COMPLETED to IMAGE_QA_PENDING.
 */
export async function startImageQualityReview(identifier: string, userContext: UserContext) {
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
          include: { imageQualityReview: true },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    if (!order.patient.isActive) {
      throw AppError.conflict('Cannot perform Image Quality Review for an inactive patient record.', 'PATIENT_INACTIVE');
    }

    const currentScan = order.scanLifecycles[0] || null;

    if (!currentScan || currentScan.state !== ScanState.COMPLETED) {
      throw AppError.conflict(
        `Cannot start Image Quality Review. Scan acquisition is not completed (current state: ${currentScan?.state || 'NONE'}).`,
        'SCAN_NOT_COMPLETED'
      );
    }

    if (order.orderStatus !== OrderStatus.SCAN_COMPLETED) {
      throw AppError.conflict(
        `Cannot begin Image Quality Review from status '${order.orderStatus}'. Exam must be in 'SCAN_COMPLETED' status.`,
        'SCAN_NOT_COMPLETED'
      );
    }

    if (currentScan.imageQualityReview) {
      throw AppError.conflict(
        `Image Quality Review has already been started for acquisition attempt ${currentScan.attemptNumber}.`,
        'IMAGE_QA_ALREADY_STARTED'
      );
    }

    const review = await tx.imageQualityReview.create({
      data: {
        imagingOrderId: order.id,
        scanLifecycleId: currentScan.id,
        status: ImageQualityStatus.PENDING,
        startedByUserId: userContext.userId,
        startedAt: now,
      },
      include: {
        startedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.IMAGE_QA_PENDING,
      },
    });

    return {
      order: updatedOrder,
      scan: currentScan,
      review,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'IMAGE_QA_STARTED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      scanLifecycleId: result.scan.id,
      attemptNumber: result.scan.attemptNumber,
      imageQualityReviewId: result.review.id,
      startedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scanLifecycleId: result.scan.id,
    attemptNumber: result.scan.attemptNumber,
    imageQualityReview: {
      id: result.review.id,
      status: result.review.status,
      startedAt: result.review.startedAt,
      startedBy: result.review.startedByUser,
    },
  };
}

/**
 * Accepts the images for the current acquisition attempt.
 * Transitions order to PACS_READY atomically and sets up initial PacsHandoff record.
 */
export async function acceptImageQuality(
  identifier: string,
  payload: ImageQualityAcceptInput,
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
          include: {
            imageQualityReview: true,
            pacsHandoff: true,
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;
    if (!currentScan) {
      throw AppError.notFound(`No scan acquisition found for order: ${identifier}`);
    }

    const review = currentScan.imageQualityReview;
    if (!review) {
      throw AppError.conflict('Image Quality Review must be started before it can be accepted.', 'WORKFLOW_STATE_CONFLICT');
    }

    if (review.status !== ImageQualityStatus.PENDING) {
      throw AppError.conflict(
        `Image Quality Review cannot be accepted from current status '${review.status}'.`,
        'IMAGE_QA_ALREADY_DECIDED'
      );
    }

    const cleanNotes = payload.notes?.trim() || null;

    const updatedReview = await tx.imageQualityReview.update({
      where: { id: review.id },
      data: {
        status: ImageQualityStatus.ACCEPTED,
        reviewedByUserId: userContext.userId,
        reviewedAt: now,
        notes: cleanNotes,
      },
      include: {
        reviewedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Create authoritative PacsHandoff summary record in READY state
    const pacsHandoff = await tx.pacsHandoff.create({
      data: {
        imagingOrderId: order.id,
        scanLifecycleId: currentScan.id,
        imageQualityReviewId: updatedReview.id,
        status: PacsHandoffStatus.READY,
        attemptCount: 0,
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PACS_READY,
      },
    });

    return {
      order: updatedOrder,
      scan: currentScan,
      review: updatedReview,
      pacsHandoff,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'IMAGE_ACCEPTED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      scanLifecycleId: result.scan.id,
      attemptNumber: result.scan.attemptNumber,
      imageQualityReviewId: result.review.id,
      acceptedAt: now,
      notes: payload.notes || null,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'PACS_HANDOFF_READY',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      scanLifecycleId: result.scan.id,
      attemptNumber: result.scan.attemptNumber,
      pacsHandoffId: result.pacsHandoff.id,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scanLifecycleId: result.scan.id,
    attemptNumber: result.scan.attemptNumber,
    imageQualityReview: {
      id: result.review.id,
      status: result.review.status,
      reviewedAt: result.review.reviewedAt,
      reviewedBy: result.review.reviewedByUser,
      notes: result.review.notes,
    },
    pacsHandoff: {
      id: result.pacsHandoff.id,
      status: result.pacsHandoff.status,
    },
  };
}

/**
 * Marks image acquisition as REPEAT_REQUIRED.
 */
export async function markRepeatRequired(
  identifier: string,
  payload: ImageQualityDecisionInput,
  userContext: UserContext
) {
  const now = new Date();

  if (payload.reason === ImageQualityReason.OTHER && (!payload.notes || payload.notes.trim().length < 3)) {
    throw AppError.badRequest(
      "Notes are required and must be at least 3 characters when reason is 'OTHER'.",
      'VALIDATION_ERROR'
    );
  }

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
          include: { imageQualityReview: true },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;
    if (!currentScan) {
      throw AppError.notFound(`No scan acquisition found for order: ${identifier}`);
    }

    const review = currentScan.imageQualityReview;
    if (!review) {
      throw AppError.conflict('Image Quality Review must be started before decision.', 'WORKFLOW_STATE_CONFLICT');
    }

    if (review.status !== ImageQualityStatus.PENDING) {
      throw AppError.conflict(
        `Image Quality Review cannot be modified from status '${review.status}'.`,
        'IMAGE_QA_ALREADY_DECIDED'
      );
    }

    const cleanNotes = payload.notes?.trim() || null;

    const updatedReview = await tx.imageQualityReview.update({
      where: { id: review.id },
      data: {
        status: ImageQualityStatus.REPEAT_REQUIRED,
        reviewedByUserId: userContext.userId,
        reviewedAt: now,
        reasonCode: payload.reason,
        notes: cleanNotes,
      },
      include: {
        reviewedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.REPEAT_REQUIRED,
      },
    });

    return {
      order: updatedOrder,
      scan: currentScan,
      review: updatedReview,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'IMAGE_REPEAT_REQUIRED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      scanLifecycleId: result.scan.id,
      attemptNumber: result.scan.attemptNumber,
      imageQualityReviewId: result.review.id,
      reason: payload.reason,
      notes: payload.notes || null,
      decidedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scanLifecycleId: result.scan.id,
    attemptNumber: result.scan.attemptNumber,
    imageQualityReview: {
      id: result.review.id,
      status: result.review.status,
      reasonCode: result.review.reasonCode,
      notes: result.review.notes,
      reviewedAt: result.review.reviewedAt,
      reviewedBy: result.review.reviewedByUser,
    },
  };
}

/**
 * Rejects image acquisition attempt.
 */
export async function rejectImageQuality(
  identifier: string,
  payload: ImageQualityDecisionInput,
  userContext: UserContext
) {
  const now = new Date();

  if (payload.reason === ImageQualityReason.OTHER && (!payload.notes || payload.notes.trim().length < 3)) {
    throw AppError.badRequest(
      "Notes are required and must be at least 3 characters when reason is 'OTHER'.",
      'VALIDATION_ERROR'
    );
  }

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
          include: { imageQualityReview: true },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;
    if (!currentScan) {
      throw AppError.notFound(`No scan acquisition found for order: ${identifier}`);
    }

    const review = currentScan.imageQualityReview;
    if (!review) {
      throw AppError.conflict('Image Quality Review must be started before decision.', 'WORKFLOW_STATE_CONFLICT');
    }

    if (review.status !== ImageQualityStatus.PENDING) {
      throw AppError.conflict(
        `Image Quality Review cannot be modified from status '${review.status}'.`,
        'IMAGE_QA_ALREADY_DECIDED'
      );
    }

    const cleanNotes = payload.notes?.trim() || null;

    const updatedReview = await tx.imageQualityReview.update({
      where: { id: review.id },
      data: {
        status: ImageQualityStatus.REJECTED,
        reviewedByUserId: userContext.userId,
        reviewedAt: now,
        reasonCode: payload.reason,
        notes: cleanNotes,
      },
      include: {
        reviewedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.IMAGE_REJECTED,
      },
    });

    return {
      order: updatedOrder,
      scan: currentScan,
      review: updatedReview,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'IMAGE_REJECTED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      scanLifecycleId: result.scan.id,
      attemptNumber: result.scan.attemptNumber,
      imageQualityReviewId: result.review.id,
      reason: payload.reason,
      notes: payload.notes || null,
      decidedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    scanLifecycleId: result.scan.id,
    attemptNumber: result.scan.attemptNumber,
    imageQualityReview: {
      id: result.review.id,
      status: result.review.status,
      reasonCode: result.review.reasonCode,
      notes: result.review.notes,
      reviewedAt: result.review.reviewedAt,
      reviewedBy: result.review.reviewedByUser,
    },
  };
}

/**
 * Authorizes a repeat acquisition from REPEAT_REQUIRED or IMAGE_REJECTED.
 * Sets order back to READY_FOR_SCAN without overwriting previous scan history.
 */
export async function authorizeRepeat(identifier: string, userContext: UserContext) {
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
          include: { imageQualityReview: true },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    const currentScan = order.scanLifecycles[0] || null;
    if (!currentScan) {
      throw AppError.notFound(`No acquisition record found for order: ${identifier}`);
    }

    const review = currentScan.imageQualityReview;
    if (!review) {
      throw AppError.conflict('No Image Quality Review exists to authorize repeat for.', 'WORKFLOW_STATE_CONFLICT');
    }

    if (review.repeatAuthorizedAt) {
      throw AppError.conflict(
        'Repeat has already been authorized for this examination attempt.',
        'REPEAT_ALREADY_AUTHORIZED'
      );
    }

    const isPermittedStatus =
      order.orderStatus === OrderStatus.REPEAT_REQUIRED ||
      order.orderStatus === OrderStatus.IMAGE_REJECTED;

    const isPermittedQA =
      review.status === ImageQualityStatus.REPEAT_REQUIRED ||
      review.status === ImageQualityStatus.REJECTED;

    if (!isPermittedStatus || !isPermittedQA) {
      throw AppError.conflict(
        `Cannot authorize repeat from current order status '${order.orderStatus}' and QA status '${review.status}'. Only REPEAT_REQUIRED or IMAGE_REJECTED may be authorized for repeat.`,
        'REPEAT_NOT_ALLOWED'
      );
    }

    const updateReviewResult = await tx.imageQualityReview.updateMany({
      where: {
        id: review.id,
        repeatAuthorizedAt: null,
      },
      data: {
        repeatAuthorizedByUserId: userContext.userId,
        repeatAuthorizedAt: now,
      },
    });

    if (updateReviewResult.count === 0) {
      throw AppError.conflict(
        'Repeat has already been authorized for this examination attempt.',
        'REPEAT_ALREADY_AUTHORIZED'
      );
    }

    const updateOrderResult = await tx.imagingOrder.updateMany({
      where: {
        id: order.id,
        orderStatus: { in: [OrderStatus.REPEAT_REQUIRED, OrderStatus.IMAGE_REJECTED] },
      },
      data: {
        orderStatus: OrderStatus.READY_FOR_SCAN,
      },
    });

    if (updateOrderResult.count === 0) {
      throw AppError.conflict(
        'Order status has already transitioned away from repeat-eligible state.',
        'REPEAT_ALREADY_AUTHORIZED'
      );
    }

    const updatedReview = await tx.imageQualityReview.findUniqueOrThrow({
      where: { id: review.id },
      include: {
        repeatAuthorizedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    const updatedOrder = await tx.imagingOrder.findUniqueOrThrow({
      where: { id: order.id },
    });

    return {
      order: updatedOrder,
      scan: currentScan,
      review: updatedReview,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'REPEAT_AUTHORIZED',
    entityType: 'ImagingOrder',
    entityId: result.order.id,
    details: {
      accessionNumber: result.order.accessionNumber,
      previousAttemptNumber: result.scan.attemptNumber,
      imageQualityReviewId: result.review.id,
      authorizedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    orderId: result.order.id,
    accessionNumber: result.order.accessionNumber,
    orderStatus: result.order.orderStatus,
    previousAttemptNumber: result.scan.attemptNumber,
    imageQualityReview: {
      id: result.review.id,
      status: result.review.status,
      repeatAuthorizedAt: result.review.repeatAuthorizedAt,
      repeatAuthorizedBy: result.review.repeatAuthorizedByUser,
    },
  };
}

/**
 * Loads authoritative PACS Handoff Context for an exam.
 */
export async function getPacsHandoffContext(identifier: string) {
  const context = await getImageQualityContext(identifier);
  return {
    integrationMode: 'SIMULATED',
    adapterIdentifier: 'Demo PACS Adapter (Simulated)',
    orderId: context.orderId,
    patientId: context.patientId,
    accessionNumber: context.accessionNumber,
    examination: context.examination,
    modality: context.modality,
    orderStatus: context.orderStatus,
    currentScan: context.currentScan,
    imageQualityReview: context.imageQualityReview,
    pacsHandoff: context.pacsHandoff,
    flags: context.flags,
  };
}

/**
 * Initiates simulated PACS Handoff for an exam in PACS_READY state.
 */
export async function initiatePacsHandoff(identifier: string, userContext: UserContext) {
  const now = new Date();

  // Phase 3.6R Transfer Protection: Real Orthanc mode must not pretend DICOM transfer occurred
  const gateway = getPacsGateway();
  const caps = await gateway.getCapabilities();
  if (!caps.dicomTransferSupported) {
    throw AppError.conflict(
      'Real Orthanc connectivity is available, but this RIS does not yet have a DICOM payload to transmit.',
      'PACS_TRANSFER_NOT_AVAILABLE'
    );
  }

  // Phase 1: Re-read authoritative order state & reconcile accession inside transaction
  const initialData = await prisma.$transaction(async (tx) => {
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
        confirmedProtocol: true,
        appointment: { include: { equipment: true } },
        scanLifecycles: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            equipment: true,
            imageQualityReview: {
              include: {
                pacsHandoff: {
                  include: { attempts: true },
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

    if (!order.patient.isActive) {
      throw AppError.conflict('Cannot initiate PACS handoff for an inactive patient.', 'PATIENT_INACTIVE');
    }

    if (order.orderStatus === OrderStatus.PACS_HANDOFF_PENDING) {
      throw AppError.conflict('PACS handoff is already pending.', 'PACS_HANDOFF_ALREADY_PENDING');
    }

    if (order.orderStatus === OrderStatus.PACS_HANDOFF_COMPLETE) {
      throw AppError.conflict('PACS handoff has already been completed.', 'PACS_HANDOFF_ALREADY_COMPLETE');
    }

    if (order.orderStatus !== OrderStatus.PACS_READY) {
      throw AppError.conflict(
        `Cannot initiate PACS handoff from order status '${order.orderStatus}'. Exam must be in 'PACS_READY' status.`,
        'PACS_HANDOFF_NOT_READY'
      );
    }

    const currentScan = order.scanLifecycles[0] || null;
    if (!currentScan || currentScan.state !== ScanState.COMPLETED) {
      throw AppError.conflict('No completed scan acquisition exists for PACS handoff.', 'STUDY_CONTEXT_MISMATCH');
    }

    const currentQA = currentScan.imageQualityReview;
    if (!currentQA || currentQA.status !== ImageQualityStatus.ACCEPTED) {
      throw AppError.conflict(
        `Image Quality Review must be ACCEPTED prior to PACS handoff (current QA: ${currentQA?.status || 'NONE'}).`,
        'IMAGE_NOT_ACCEPTED'
      );
    }

    // Accession reconciliation check
    if (
      currentScan.imagingOrderId !== order.id ||
      currentQA.imagingOrderId !== order.id ||
      currentQA.scanLifecycleId !== currentScan.id
    ) {
      throw AppError.conflict(
        'Study context mismatch detected during accession reconciliation.',
        'STUDY_CONTEXT_MISMATCH'
      );
    }

    // Resolve or create PacsHandoff record
    let pacsHandoff = currentQA.pacsHandoff;
    if (!pacsHandoff) {
      pacsHandoff = await tx.pacsHandoff.create({
        data: {
          imagingOrderId: order.id,
          scanLifecycleId: currentScan.id,
          imageQualityReviewId: currentQA.id,
          status: PacsHandoffStatus.READY,
          attemptCount: 0,
        },
        include: { attempts: true },
      });
    }

    const nextAttemptNumber = pacsHandoff.attemptCount + 1;

    // Transition state to PENDING
    const updatedHandoff = await tx.pacsHandoff.update({
      where: { id: pacsHandoff.id },
      data: {
        status: PacsHandoffStatus.PENDING,
        attemptCount: nextAttemptNumber,
        initiatedByUserId: userContext.userId,
        initiatedAt: pacsHandoff.initiatedAt || now,
        lastAttemptAt: now,
      },
    });

    const attempt = await tx.pacsHandoffAttempt.create({
      data: {
        pacsHandoffId: pacsHandoff.id,
        attemptNumber: nextAttemptNumber,
        startedAt: now,
        outcome: PacsHandoffOutcome.FAILURE, // Temporary placeholder until resolved
        initiatedByUserId: userContext.userId,
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PACS_HANDOFF_PENDING,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scan: currentScan,
      review: currentQA,
      handoff: updatedHandoff,
      attempt,
      nextAttemptNumber,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'PACS_HANDOFF_INITIATED',
    entityType: 'ImagingOrder',
    entityId: initialData.order.id,
    details: {
      accessionNumber: initialData.order.accessionNumber,
      attemptNumber: initialData.nextAttemptNumber,
      scanLifecycleId: initialData.scan.id,
      pacsHandoffId: initialData.handoff.id,
      initiatedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  // Phase 2: Call PacsGateway (synchronously executed for prototype)
  const gatewayResult = await gateway.requestHandoff({
    imagingOrderId: initialData.order.id,
    accessionNumber: initialData.order.accessionNumber,
    patientId: initialData.patient.patientId,
    patientInternalId: initialData.patient.id,
    modality: initialData.order.modality,
    examination: initialData.order.examinationName,
    protocolCode: initialData.scan.equipment?.name || null,
    scanLifecycleId: initialData.scan.id,
    attemptNumber: initialData.scan.attemptNumber,
    equipmentId: initialData.scan.equipmentId,
    equipmentName: initialData.scan.equipment?.name || null,
    imageQualityReviewId: initialData.review.id,
    reviewedByUserId: initialData.review.reviewedByUserId || userContext.userId,
    reviewedAt: initialData.review.reviewedAt || now,
  });

  const completionNow = new Date();

  // Phase 3: Persist gateway result in transaction
  const finalData = await prisma.$transaction(async (tx) => {
    if (gatewayResult.success) {
      const completedHandoff = await tx.pacsHandoff.update({
        where: { id: initialData.handoff.id },
        data: {
          status: PacsHandoffStatus.COMPLETE,
          completedAt: completionNow,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await tx.pacsHandoffAttempt.update({
        where: { id: initialData.attempt.id },
        data: {
          outcome: PacsHandoffOutcome.SUCCESS,
          completedAt: completionNow,
          errorCode: null,
          errorMessage: null,
        },
      });

      const completedOrder = await tx.imagingOrder.update({
        where: { id: initialData.order.id },
        data: {
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      return {
        order: completedOrder,
        handoff: completedHandoff,
        outcome: PacsHandoffOutcome.SUCCESS,
      };
    } else {
      const failedHandoff = await tx.pacsHandoff.update({
        where: { id: initialData.handoff.id },
        data: {
          status: PacsHandoffStatus.FAILED,
          lastErrorCode: gatewayResult.errorCode || 'UNKNOWN',
          lastErrorMessage: gatewayResult.errorMessage || 'Simulated PACS handoff failure.',
        },
      });

      await tx.pacsHandoffAttempt.update({
        where: { id: initialData.attempt.id },
        data: {
          outcome: PacsHandoffOutcome.FAILURE,
          completedAt: completionNow,
          errorCode: gatewayResult.errorCode || 'UNKNOWN',
          errorMessage: gatewayResult.errorMessage || 'Simulated PACS handoff failure.',
        },
      });

      const failedOrder = await tx.imagingOrder.update({
        where: { id: initialData.order.id },
        data: {
          orderStatus: OrderStatus.PACS_HANDOFF_FAILED,
        },
      });

      return {
        order: failedOrder,
        handoff: failedHandoff,
        outcome: PacsHandoffOutcome.FAILURE,
      };
    }
  });

  if (finalData.outcome === PacsHandoffOutcome.SUCCESS) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_HANDOFF_COMPLETED',
      entityType: 'ImagingOrder',
      entityId: finalData.order.id,
      details: {
        accessionNumber: finalData.order.accessionNumber,
        pacsHandoffId: finalData.handoff.id,
        attemptNumber: initialData.nextAttemptNumber,
        completedAt: completionNow,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } else {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_HANDOFF_FAILED',
      entityType: 'ImagingOrder',
      entityId: finalData.order.id,
      details: {
        accessionNumber: finalData.order.accessionNumber,
        pacsHandoffId: finalData.handoff.id,
        attemptNumber: initialData.nextAttemptNumber,
        errorCode: gatewayResult.errorCode,
        errorMessage: gatewayResult.errorMessage,
        failedAt: completionNow,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  }

  return {
    orderId: finalData.order.id,
    accessionNumber: finalData.order.accessionNumber,
    orderStatus: finalData.order.orderStatus,
    pacsHandoff: {
      id: finalData.handoff.id,
      status: finalData.handoff.status,
      attemptCount: finalData.handoff.attemptCount,
      completedAt: finalData.handoff.completedAt,
      lastErrorCode: finalData.handoff.lastErrorCode,
      lastErrorMessage: finalData.handoff.lastErrorMessage,
    },
  };
}

/**
 * Retries a failed simulated PACS handoff.
 */
export async function retryPacsHandoff(identifier: string, userContext: UserContext) {
  const now = new Date();

  // Phase 3.6R Transfer Protection: Real Orthanc mode must not pretend DICOM transfer occurred
  const gateway = getPacsGateway();
  const caps = await gateway.getCapabilities();
  if (!caps.dicomTransferSupported) {
    throw AppError.conflict(
      'Real Orthanc connectivity is available, but this RIS does not yet have a DICOM payload to transmit.',
      'PACS_TRANSFER_NOT_AVAILABLE'
    );
  }

  // Phase 1: Re-read state & prepare retry inside transaction
  const initialData = await prisma.$transaction(async (tx) => {
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
          include: {
            equipment: true,
            imageQualityReview: {
              include: {
                pacsHandoff: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
    }

    if (order.orderStatus === OrderStatus.PACS_HANDOFF_PENDING) {
      throw AppError.conflict('PACS handoff is already pending.', 'PACS_HANDOFF_ALREADY_PENDING');
    }

    if (order.orderStatus === OrderStatus.PACS_HANDOFF_COMPLETE) {
      throw AppError.conflict('PACS handoff has already been completed.', 'PACS_HANDOFF_ALREADY_COMPLETE');
    }

    if (order.orderStatus !== OrderStatus.PACS_HANDOFF_FAILED) {
      throw AppError.conflict(
        `Cannot retry PACS handoff from status '${order.orderStatus}'. Only failed handoffs may be retried.`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const currentScan = order.scanLifecycles[0] || null;
    const currentQA = currentScan?.imageQualityReview || null;
    const pacsHandoff = currentQA?.pacsHandoff || null;

    if (!pacsHandoff || pacsHandoff.status !== PacsHandoffStatus.FAILED) {
      throw AppError.conflict(
        `PACS handoff is not in a failed state (current status: ${pacsHandoff?.status || 'NONE'}).`,
        'WORKFLOW_STATE_CONFLICT'
      );
    }

    const nextAttemptNumber = pacsHandoff.attemptCount + 1;

    const updatedHandoff = await tx.pacsHandoff.update({
      where: { id: pacsHandoff.id },
      data: {
        status: PacsHandoffStatus.PENDING,
        attemptCount: nextAttemptNumber,
        lastAttemptAt: now,
      },
    });

    const attempt = await tx.pacsHandoffAttempt.create({
      data: {
        pacsHandoffId: pacsHandoff.id,
        attemptNumber: nextAttemptNumber,
        startedAt: now,
        outcome: PacsHandoffOutcome.FAILURE,
        initiatedByUserId: userContext.userId,
      },
    });

    const updatedOrder = await tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PACS_HANDOFF_PENDING,
      },
    });

    return {
      order: updatedOrder,
      patient: order.patient,
      scan: currentScan!,
      review: currentQA!,
      handoff: updatedHandoff,
      attempt,
      nextAttemptNumber,
    };
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'PACS_HANDOFF_RETRIED',
    entityType: 'ImagingOrder',
    entityId: initialData.order.id,
    details: {
      accessionNumber: initialData.order.accessionNumber,
      attemptNumber: initialData.nextAttemptNumber,
      pacsHandoffId: initialData.handoff.id,
      retriedAt: now,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  // Phase 2: Call PacsGateway
  const gatewayResult = await gateway.requestHandoff({
    imagingOrderId: initialData.order.id,
    accessionNumber: initialData.order.accessionNumber,
    patientId: initialData.patient.patientId,
    patientInternalId: initialData.patient.id,
    modality: initialData.order.modality,
    examination: initialData.order.examinationName,
    protocolCode: initialData.scan.equipment?.name || null,
    scanLifecycleId: initialData.scan.id,
    attemptNumber: initialData.scan.attemptNumber,
    equipmentId: initialData.scan.equipmentId,
    equipmentName: initialData.scan.equipment?.name || null,
    imageQualityReviewId: initialData.review.id,
    reviewedByUserId: initialData.review.reviewedByUserId || userContext.userId,
    reviewedAt: initialData.review.reviewedAt || now,
  });

  const completionNow = new Date();

  // Phase 3: Persist result
  const finalData = await prisma.$transaction(async (tx) => {
    if (gatewayResult.success) {
      const completedHandoff = await tx.pacsHandoff.update({
        where: { id: initialData.handoff.id },
        data: {
          status: PacsHandoffStatus.COMPLETE,
          completedAt: completionNow,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await tx.pacsHandoffAttempt.update({
        where: { id: initialData.attempt.id },
        data: {
          outcome: PacsHandoffOutcome.SUCCESS,
          completedAt: completionNow,
          errorCode: null,
          errorMessage: null,
        },
      });

      const completedOrder = await tx.imagingOrder.update({
        where: { id: initialData.order.id },
        data: {
          orderStatus: OrderStatus.PACS_HANDOFF_COMPLETE,
        },
      });

      return {
        order: completedOrder,
        handoff: completedHandoff,
        outcome: PacsHandoffOutcome.SUCCESS,
      };
    } else {
      const failedHandoff = await tx.pacsHandoff.update({
        where: { id: initialData.handoff.id },
        data: {
          status: PacsHandoffStatus.FAILED,
          lastErrorCode: gatewayResult.errorCode || 'UNKNOWN',
          lastErrorMessage: gatewayResult.errorMessage || 'Simulated PACS handoff failure.',
        },
      });

      await tx.pacsHandoffAttempt.update({
        where: { id: initialData.attempt.id },
        data: {
          outcome: PacsHandoffOutcome.FAILURE,
          completedAt: completionNow,
          errorCode: gatewayResult.errorCode || 'UNKNOWN',
          errorMessage: gatewayResult.errorMessage || 'Simulated PACS handoff failure.',
        },
      });

      const failedOrder = await tx.imagingOrder.update({
        where: { id: initialData.order.id },
        data: {
          orderStatus: OrderStatus.PACS_HANDOFF_FAILED,
        },
      });

      return {
        order: failedOrder,
        handoff: failedHandoff,
        outcome: PacsHandoffOutcome.FAILURE,
      };
    }
  });

  if (finalData.outcome === PacsHandoffOutcome.SUCCESS) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_HANDOFF_COMPLETED',
      entityType: 'ImagingOrder',
      entityId: finalData.order.id,
      details: {
        accessionNumber: finalData.order.accessionNumber,
        pacsHandoffId: finalData.handoff.id,
        attemptNumber: initialData.nextAttemptNumber,
        completedAt: completionNow,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } else {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PACS_HANDOFF_FAILED',
      entityType: 'ImagingOrder',
      entityId: finalData.order.id,
      details: {
        accessionNumber: finalData.order.accessionNumber,
        pacsHandoffId: finalData.handoff.id,
        attemptNumber: initialData.nextAttemptNumber,
        errorCode: gatewayResult.errorCode,
        errorMessage: gatewayResult.errorMessage,
        failedAt: completionNow,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  }

  return {
    orderId: finalData.order.id,
    accessionNumber: finalData.order.accessionNumber,
    orderStatus: finalData.order.orderStatus,
    pacsHandoff: {
      id: finalData.handoff.id,
      status: finalData.handoff.status,
      attemptCount: finalData.handoff.attemptCount,
      completedAt: finalData.handoff.completedAt,
      lastErrorCode: finalData.handoff.lastErrorCode,
      lastErrorMessage: finalData.handoff.lastErrorMessage,
    },
  };
}


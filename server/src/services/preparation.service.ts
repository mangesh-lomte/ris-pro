import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  ConsentStatus,
  ExamDefinition,
  FastingStatus,
  ModalityType,
  OrderStatus,
  PreparationStatus,
  SafetyStatus,
  TechnologistPreparation,
} from '@prisma/client';

export interface PreparationRequirements {
  fastingRequired: boolean;
  ivRequired: boolean;
  contrastPreparationRequired: boolean;
  consentRequired: boolean;
  additionalPreparationRequired: boolean;
  additionalPreparationInstructions: string | null;
}

export interface SavePreparationInput {
  fastingStatus?: FastingStatus;
  ivReady?: boolean;
  contrastReady?: boolean;
  consentStatus?: ConsentStatus;
  additionalPreparationComplete?: boolean;
  preparationNotes?: string;
}

/**
 * Authoritative preparation requirements determined strictly from configured ExamDefinition data.
 * Requirements are NEVER inferred from body part, modality, or order contrast flags.
 */
export function evaluatePreparationRequirements(
  _order?: {
    modality?: ModalityType;
    bodyPart?: string | null;
    contrastRequired?: boolean;
  },
  examDef?: Partial<ExamDefinition> | null
): PreparationRequirements {
  const fastingRequired = Boolean(examDef?.fastingRequired);
  const ivRequired = Boolean(examDef?.ivRequired);
  const contrastPreparationRequired = Boolean(examDef?.contrastPreparationRequired);
  const consentRequired = Boolean(examDef?.consentRequired);
  const additionalPreparationInstructions = examDef?.additionalPreparationInstructions || null;
  const additionalPreparationRequired = Boolean(additionalPreparationInstructions);

  return {
    fastingRequired,
    ivRequired,
    contrastPreparationRequired,
    consentRequired,
    additionalPreparationRequired,
    additionalPreparationInstructions,
  };
}

/**
 * Pure deterministic rule engine to determine whether preparation is COMPLETE or IN_PROGRESS.
 * Server is strictly authoritative; client-supplied completion flags are never trusted.
 */
export function evaluatePreparationDecision(
  requirements: PreparationRequirements,
  input: SavePreparationInput
): PreparationStatus {
  if (requirements.fastingRequired && input.fastingStatus !== FastingStatus.CONFIRMED) {
    return PreparationStatus.IN_PROGRESS;
  }

  if (requirements.ivRequired && !input.ivReady) {
    return PreparationStatus.IN_PROGRESS;
  }

  if (requirements.contrastPreparationRequired && !input.contrastReady) {
    return PreparationStatus.IN_PROGRESS;
  }

  if (requirements.consentRequired && input.consentStatus !== ConsentStatus.CONFIRMED) {
    return PreparationStatus.IN_PROGRESS;
  }

  if (requirements.additionalPreparationRequired && !input.additionalPreparationComplete) {
    return PreparationStatus.IN_PROGRESS;
  }

  return PreparationStatus.COMPLETE;
}

/**
 * Loads exam preparation context, current safety state, requirements, existing record, and eligible protocols.
 */
export async function getPreparationContext(identifier: string) {
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
      referringDoctor: true,
      appointment: {
        include: {
          examDefinition: true,
          equipment: true,
        },
      },
      safetyScreening: {
        include: {
          completedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
      preparation: {
        include: {
          completedByUser: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
      confirmedProtocol: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  let examDef = order.appointment?.examDefinition || null;
  if (!examDef && order.appointment?.examDefinitionId) {
    examDef = await prisma.examDefinition.findUnique({
      where: { id: order.appointment.examDefinitionId },
    });
  }
  if (!examDef && order.examinationName) {
    examDef = await prisma.examDefinition.findFirst({
      where: {
        name: order.examinationName,
        modality: order.modality,
      },
    });
  }
  const requirements = evaluatePreparationRequirements(order, examDef);

  // Load eligible active protocols matching this modality
  const eligibleProtocols = await prisma.imagingProtocol.findMany({
    where: {
      isActive: true,
      modality: order.modality,
    },
    orderBy: { code: 'asc' },
  });

  const isSafetyCleared =
    order.safetyScreening?.safetyStatus === SafetyStatus.CLEARED &&
    (order.orderStatus === OrderStatus.SAFETY_CLEARED ||
      order.orderStatus === OrderStatus.PREPARATION_IN_PROGRESS ||
      order.orderStatus === OrderStatus.PREPARED ||
      order.orderStatus === OrderStatus.READY_FOR_SCAN);

  return {
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    appointmentId: order.appointment?.id || null,
    appointmentNumber: order.appointment?.appointmentNumber || null,
    modality: order.modality,
    examinationName: order.examinationName,
    bodyPart: order.bodyPart,
    clinicalIndication: order.clinicalIndication,
    priority: order.priority,
    orderStatus: order.orderStatus,
    contrastRequired: order.contrastRequired,
    patient: {
      id: order.patient.id,
      patientId: order.patient.patientId,
      firstName: order.patient.firstName,
      lastName: order.patient.lastName,
      dateOfBirth: order.patient.dateOfBirth.toISOString().split('T')[0],
      gender: order.patient.gender,
    },
    referringDoctor: order.referringDoctor?.name || order.referringDoctorText || null,
    equipment: order.appointment?.equipment
      ? {
          id: order.appointment.equipment.id,
          name: order.appointment.equipment.name,
          location: order.appointment.equipment.location,
        }
      : null,
    safetyStatus: order.safetyScreening?.safetyStatus || SafetyStatus.NOT_STARTED,
    isSafetyCleared,
    requirements,
    preparation: order.preparation || null,
    preparationStatus: order.preparation?.preparationStatus || PreparationStatus.NOT_STARTED,
    eligibleProtocols,
    confirmedProtocol: order.confirmedProtocol || null,
    protocolConfirmedAt: order.protocolConfirmedAt || null,
  };
}

/**
 * Saves preparation checklist state inside a database transaction.
 * Strictly enforces authoritative safety gate: SafetyStatus MUST be CLEARED.
 */
export async function savePreparation(
  identifier: string,
  payload: SavePreparationInput,
  userContext: { userId: string; ipAddress?: string; userAgent?: string }
): Promise<{
  preparation: TechnologistPreparation;
  requirements: PreparationRequirements;
  preparationStatus: PreparationStatus;
  orderStatus: OrderStatus;
}> {
  // 1. Resolve order
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
      appointment: {
        include: {
          examDefinition: true,
        },
      },
      safetyScreening: true,
      preparation: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  // 2. Strict Safety Gate Enforcement
  const isSafetyCleared =
    order.safetyScreening?.safetyStatus === SafetyStatus.CLEARED &&
    (order.orderStatus === OrderStatus.SAFETY_CLEARED ||
      order.orderStatus === OrderStatus.PREPARATION_IN_PROGRESS ||
      order.orderStatus === OrderStatus.PREPARED);

  if (!isSafetyCleared) {
    throw AppError.conflict(
      `Patient safety screening must be CLEARED and order in SAFETY_CLEARED status before preparation can proceed. Current safetyStatus: '${
        order.safetyScreening?.safetyStatus || 'NOT_STARTED'
      }', orderStatus: '${order.orderStatus}'.`
    );
  }

  // 3. Workflow State Transition Validation
  if (
    order.orderStatus === OrderStatus.READY_FOR_SCAN ||
    order.orderStatus === OrderStatus.COMPLETED ||
    order.orderStatus === OrderStatus.CANCELLED
  ) {
    throw AppError.conflict(
      `Cannot modify preparation on an order in status '${order.orderStatus}'.`
    );
  }

  // 4. Calculate authoritative requirements and preparation completion decision
  let examDef = order.appointment?.examDefinition || null;
  if (!examDef && order.appointment?.examDefinitionId) {
    examDef = await prisma.examDefinition.findUnique({
      where: { id: order.appointment.examDefinitionId },
    });
  }
  if (!examDef && order.examinationName) {
    examDef = await prisma.examDefinition.findFirst({
      where: {
        name: order.examinationName,
        modality: order.modality,
      },
    });
  }
  const requirements = evaluatePreparationRequirements(order, examDef);

  const cleanNotes = payload.preparationNotes ? payload.preparationNotes.trim().slice(0, 2000) : null;

  const sanitizedInput: SavePreparationInput = {
    fastingStatus: requirements.fastingRequired
      ? payload.fastingStatus || FastingStatus.NOT_CONFIRMED
      : FastingStatus.NOT_REQUIRED,
    ivReady: requirements.ivRequired ? Boolean(payload.ivReady) : false,
    contrastReady: requirements.contrastPreparationRequired ? Boolean(payload.contrastReady) : false,
    consentStatus: requirements.consentRequired
      ? payload.consentStatus || ConsentStatus.NOT_CONFIRMED
      : ConsentStatus.NOT_REQUIRED,
    additionalPreparationComplete: requirements.additionalPreparationRequired
      ? Boolean(payload.additionalPreparationComplete)
      : false,
    preparationNotes: cleanNotes || undefined,
  };

  const decisionStatus = evaluatePreparationDecision(requirements, sanitizedInput);
  const nextOrderStatus =
    decisionStatus === PreparationStatus.COMPLETE
      ? OrderStatus.PREPARED
      : OrderStatus.PREPARATION_IN_PROGRESS;

  // 5. Atomic Transaction: Upsert TechnologistPreparation and transition ImagingOrder
  const preparation = await prisma.$transaction(async (tx) => {
    const saved = await tx.technologistPreparation.upsert({
      where: {
        imagingOrderId: order.id,
      },
      update: {
        completedByUserId: userContext.userId,
        fastingRequired: requirements.fastingRequired,
        fastingStatus: sanitizedInput.fastingStatus || FastingStatus.NOT_REQUIRED,
        ivRequired: requirements.ivRequired,
        ivReady: sanitizedInput.ivReady || false,
        contrastPreparationRequired: requirements.contrastPreparationRequired,
        contrastReady: sanitizedInput.contrastReady || false,
        consentRequired: requirements.consentRequired,
        consentStatus: sanitizedInput.consentStatus || ConsentStatus.NOT_REQUIRED,
        additionalPreparationRequired: requirements.additionalPreparationRequired,
        additionalPreparationComplete: sanitizedInput.additionalPreparationComplete || false,
        additionalPreparationInstructions: requirements.additionalPreparationInstructions,
        preparationNotes: cleanNotes,
        preparationStatus: decisionStatus,
        preparedAt: decisionStatus === PreparationStatus.COMPLETE ? new Date() : null,
      },
      create: {
        imagingOrderId: order.id,
        patientId: order.patientId,
        appointmentId: order.appointment?.id || null,
        completedByUserId: userContext.userId,
        fastingRequired: requirements.fastingRequired,
        fastingStatus: sanitizedInput.fastingStatus || FastingStatus.NOT_REQUIRED,
        ivRequired: requirements.ivRequired,
        ivReady: sanitizedInput.ivReady || false,
        contrastPreparationRequired: requirements.contrastPreparationRequired,
        contrastReady: sanitizedInput.contrastReady || false,
        consentRequired: requirements.consentRequired,
        consentStatus: sanitizedInput.consentStatus || ConsentStatus.NOT_REQUIRED,
        additionalPreparationRequired: requirements.additionalPreparationRequired,
        additionalPreparationComplete: sanitizedInput.additionalPreparationComplete || false,
        additionalPreparationInstructions: requirements.additionalPreparationInstructions,
        preparationNotes: cleanNotes,
        preparationStatus: decisionStatus,
        preparedAt: decisionStatus === PreparationStatus.COMPLETE ? new Date() : null,
      },
    });

    if (order.orderStatus !== nextOrderStatus) {
      await tx.imagingOrder.update({
        where: { id: order.id },
        data: { orderStatus: nextOrderStatus },
      });
    }

    return saved;
  });

  // 6. Audit Logging
  try {
    const isFirstTime = !order.preparation;
    if (isFirstTime) {
      await logAuditEvent({
        userId: userContext.userId,
        action: 'PREPARATION_STARTED',
        entityType: 'TechnologistPreparation',
        entityId: preparation.id,
        details: {
          accessionNumber: order.accessionNumber,
          modality: order.modality,
          preparationStatus: decisionStatus,
        },
        ipAddress: userContext.ipAddress,
        userAgent: userContext.userAgent,
      });
    }

    await logAuditEvent({
      userId: userContext.userId,
      action: decisionStatus === PreparationStatus.COMPLETE ? 'PREPARATION_COMPLETED' : 'PREPARATION_UPDATED',
      entityType: 'TechnologistPreparation',
      entityId: preparation.id,
      details: {
        accessionNumber: order.accessionNumber,
        modality: order.modality,
        preparationStatus: decisionStatus,
        orderStatus: nextOrderStatus,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } catch {
    // Non-blocking audit failure
  }

  return {
    preparation,
    requirements,
    preparationStatus: decisionStatus,
    orderStatus: nextOrderStatus,
  };
}

import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  ModalityType,
  OrderStatus,
  SafetyStatus,
  TechnologistSafetyScreening,
} from '@prisma/client';

export type AnswerOption = 'YES' | 'NO' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface SafetyQuestionAnswers {
  // Common / Identity
  [key: string]: string | boolean | undefined;
  identityVerified?: boolean;
  identityVerificationMethod?: string;

  // MRI
  mri_pacemaker?: AnswerOption;
  mri_aneurysm_clip?: AnswerOption;
  mri_cochlear_implant?: AnswerOption;
  mri_neurostimulator?: AnswerOption;
  mri_infusion_pump?: AnswerOption;
  mri_metal_in_eyes?: AnswerOption;
  mri_implants_other?: AnswerOption;
  mri_pregnancy?: AnswerOption;
  mri_claustrophobia?: AnswerOption;
  mri_contrast_allergy?: AnswerOption;
  mri_renal_disease?: AnswerOption;

  // CT
  ct_pregnancy?: AnswerOption;
  ct_contrast_allergy?: AnswerOption;
  ct_renal_disease?: AnswerOption;
  ct_metformin?: AnswerOption;
  ct_asthma_allergies?: AnswerOption;

  // X-Ray
  xray_pregnancy?: AnswerOption;
}

export interface SafetyDecision {
  safetyStatus: SafetyStatus;
  riskFactors: string[];
  cautionNotes: string[];
  requiresClinicalReview: boolean;
  requiresRadiologistReview?: boolean; // Generic clinical review alias
}

export interface SaveSafetyScreeningInput {
  identityVerified: boolean;
  identityVerificationMethod: string;
  safetyNotes?: string;
  answers: SafetyQuestionAnswers;
}

/**
 * Pure clinical safety rules engine.
 * Records relevant safety history and workflow risk flags without acting as a full CDS engine or prescribing clinical thresholds.
 */
export function evaluateSafetyDecision(
  modality: ModalityType,
  contrastRequired: boolean,
  identityVerified: boolean,
  answers: SafetyQuestionAnswers
): SafetyDecision {
  const riskFactors: string[] = [];
  const cautionNotes: string[] = [];

  // Rule 1: Identity verification is mandatory for clearance
  if (!identityVerified) {
    riskFactors.push('Patient identity has not been verified using at least two independent clinical identifiers.');
  }

  // Modality-Specific Safety Rules
  if (modality === ModalityType.MRI) {
    // MRI implant and device concerns
    if (answers.mri_pacemaker === 'YES' || answers.mri_pacemaker === 'UNKNOWN') {
      riskFactors.push('Implanted cardiac device concern reported (pacemaker/ICD). Requires clinical review.');
    }
    if (answers.mri_aneurysm_clip === 'YES' || answers.mri_aneurysm_clip === 'UNKNOWN') {
      riskFactors.push('Cerebral aneurysm clip concern reported. Requires clinical review.');
    }
    if (answers.mri_cochlear_implant === 'YES' || answers.mri_cochlear_implant === 'UNKNOWN') {
      riskFactors.push('Cochlear implant or auditory device concern reported. Requires clinical review.');
    }
    if (answers.mri_neurostimulator === 'YES' || answers.mri_neurostimulator === 'UNKNOWN') {
      riskFactors.push('Neurostimulator or electronic implant concern reported. Requires clinical review.');
    }
    if (answers.mri_infusion_pump === 'YES' || answers.mri_infusion_pump === 'UNKNOWN') {
      riskFactors.push('Implanted infusion pump or catheter concern reported. Requires clinical review.');
    }
    if (answers.mri_metal_in_eyes === 'YES' || answers.mri_metal_in_eyes === 'UNKNOWN') {
      riskFactors.push('Metallic fragment in eyes concern reported. Requires clinical review.');
    }
    if (answers.mri_pregnancy === 'YES' || answers.mri_pregnancy === 'UNKNOWN') {
      riskFactors.push('Potential pregnancy reported. Requires clinical review.');
    }

    // MRI Contrast checks if contrast is ordered
    if (contrastRequired) {
      if (answers.mri_contrast_allergy === 'YES') {
        riskFactors.push('Prior contrast allergy or adverse reaction history reported. Requires clinical review.');
      }
      if (answers.mri_renal_disease === 'YES' || answers.mri_renal_disease === 'UNKNOWN') {
        riskFactors.push('Renal-risk history reported with contrast examination requested. Requires clinical review.');
      }
    }

    // Cautions
    if (answers.mri_implants_other === 'YES') {
      cautionNotes.push('Other metallic implant history noted. Verify implant safety before scanning.');
    }
    if (answers.mri_claustrophobia === 'YES') {
      cautionNotes.push('Patient reported history of claustrophobia.');
    }
  } else if (modality === ModalityType.CT) {
    // CT Ionizing Radiation & Contrast Checks
    if (answers.ct_pregnancy === 'YES' || answers.ct_pregnancy === 'UNKNOWN') {
      riskFactors.push('Potential pregnancy reported for ionizing radiation examination. Requires clinical review.');
    }

    if (contrastRequired) {
      if (answers.ct_contrast_allergy === 'YES') {
        riskFactors.push('Prior contrast allergy or adverse reaction history reported. Requires clinical review.');
      }
      if (answers.ct_renal_disease === 'YES' || answers.ct_renal_disease === 'UNKNOWN') {
        riskFactors.push('Renal-risk history reported with contrast examination requested. Requires clinical review.');
      }
    }

    // Cautions
    if (answers.ct_metformin === 'YES') {
      cautionNotes.push('Patient reported taking Metformin.');
    }
    if (answers.ct_asthma_allergies === 'YES') {
      cautionNotes.push('Patient reported history of asthma or allergies.');
    }
  } else if (modality === ModalityType.XRAY) {
    // Routine non-contrast X-ray: limited to relevant safety questions (especially pregnancy where applicable)
    if (answers.xray_pregnancy === 'YES' || answers.xray_pregnancy === 'UNKNOWN') {
      riskFactors.push('Potential pregnancy reported for ionizing radiation examination. Requires clinical review.');
    }
  }

  // Completeness check for required questions
  const hasIncompleteRequired = checkIncompleteQuestions(modality, contrastRequired, answers);

  if (riskFactors.length > 0) {
    return {
      safetyStatus: SafetyStatus.REQUIRES_REVIEW,
      riskFactors,
      cautionNotes,
      requiresClinicalReview: true,
      requiresRadiologistReview: true,
    };
  }

  if (hasIncompleteRequired) {
    return {
      safetyStatus: SafetyStatus.IN_REVIEW,
      riskFactors: ['Required modality safety questions are incomplete.'],
      cautionNotes,
      requiresClinicalReview: false,
      requiresRadiologistReview: false,
    };
  }

  return {
    safetyStatus: SafetyStatus.CLEARED,
    riskFactors: [],
    cautionNotes,
    requiresClinicalReview: false,
    requiresRadiologistReview: false,
  };
}

function checkIncompleteQuestions(
  modality: ModalityType,
  contrastRequired: boolean,
  answers: SafetyQuestionAnswers
): boolean {
  if (modality === ModalityType.MRI) {
    const required = [
      answers.mri_pacemaker,
      answers.mri_aneurysm_clip,
      answers.mri_cochlear_implant,
      answers.mri_neurostimulator,
      answers.mri_infusion_pump,
      answers.mri_metal_in_eyes,
    ];
    if (required.some((v) => !v)) return true;
    if (contrastRequired && (!answers.mri_contrast_allergy || !answers.mri_renal_disease)) {
      return true;
    }
  } else if (modality === ModalityType.CT) {
    if (!answers.ct_pregnancy) return true;
    if (contrastRequired && (!answers.ct_contrast_allergy || !answers.ct_renal_disease)) {
      return true;
    }
  } else if (modality === ModalityType.XRAY) {
    if (!answers.xray_pregnancy) return true;
  }
  return false;
}

/**
 * Loads exam context and any existing safety screening for a worklist exam.
 */
export async function getSafetyScreeningContext(identifier: string) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      OR: [
        { id: identifier },
        { appointmentNumber: identifier },
        { imagingOrderId: identifier },
        { imagingOrder: { accessionNumber: identifier } },
      ],
    },
    include: {
      patient: true,
      imagingOrder: {
        include: {
          referringDoctor: true,
          safetyScreening: {
            include: {
              completedByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
      equipment: true,
    },
  });

  if (!appointment || !appointment.imagingOrder) {
    // If appointment not found by that identifier, try finding by imaging order directly
    const order = await prisma.imagingOrder.findFirst({
      where: {
        OR: [
          { id: identifier },
          { accessionNumber: identifier },
        ],
      },
      include: {
        patient: true,
        referringDoctor: true,
        appointment: {
          include: {
            equipment: true,
          },
        },
        safetyScreening: {
          include: {
            completedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Imaging order or appointment not found for identifier: ${identifier}`);
    }

    return {
      appointmentId: order.appointment?.id || null,
      appointmentNumber: order.appointment?.appointmentNumber || null,
      orderId: order.id,
      accessionNumber: order.accessionNumber,
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
      screening: order.safetyScreening || null,
    };
  }

  const order = appointment.imagingOrder;
  return {
    appointmentId: appointment.id,
    appointmentNumber: appointment.appointmentNumber,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    modality: order.modality,
    examinationName: order.examinationName,
    bodyPart: order.bodyPart,
    clinicalIndication: order.clinicalIndication,
    priority: order.priority,
    orderStatus: order.orderStatus,
    contrastRequired: order.contrastRequired,
    patient: {
      id: appointment.patient.id,
      patientId: appointment.patient.patientId,
      firstName: appointment.patient.firstName,
      lastName: appointment.patient.lastName,
      dateOfBirth: appointment.patient.dateOfBirth.toISOString().split('T')[0],
      gender: appointment.patient.gender,
    },
    referringDoctor: order.referringDoctor?.name || order.referringDoctorText || null,
    equipment: appointment.equipment
      ? {
          id: appointment.equipment.id,
          name: appointment.equipment.name,
          location: appointment.equipment.location,
        }
      : null,
    screening: order.safetyScreening || null,
  };
}

/**
 * Saves and authoritatively evaluates safety screening inside a database transaction.
 * Updates orderStatus according to server safety decision:
 * - CLEARED -> SAFETY_CLEARED
 * - REQUIRES_REVIEW -> SAFETY_REVIEW
 * Emits required audit log events.
 */
export async function saveSafetyScreening(
  identifier: string,
  payload: SaveSafetyScreeningInput,
  userContext: { userId: string; ipAddress?: string; userAgent?: string }
): Promise<{
  screening: TechnologistSafetyScreening;
  decision: SafetyDecision;
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
      appointment: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  // 2. Validate workflow state transitions
  if (
    order.orderStatus === OrderStatus.COMPLETED ||
    order.orderStatus === OrderStatus.CANCELLED
  ) {
    throw AppError.conflict(
      `Cannot perform safety screening on an order in status '${order.orderStatus}'. Only orders awaiting technologist review can be screened.`
    );
  }

  // 3. Server-authoritative safety decision
  const decision = evaluateSafetyDecision(
    order.modality,
    order.contrastRequired,
    payload.identityVerified,
    payload.answers
  );

  let newOrderStatus = order.orderStatus;
  if (decision.safetyStatus === SafetyStatus.CLEARED) {
    newOrderStatus = OrderStatus.SAFETY_CLEARED;
  } else if (decision.safetyStatus === SafetyStatus.REQUIRES_REVIEW) {
    newOrderStatus = OrderStatus.SAFETY_REVIEW;
  }

  // 4. Atomic transaction: upsert screening + update order status
  const screening = await prisma.$transaction(async (tx) => {
    const saved = await tx.technologistSafetyScreening.upsert({
      where: {
        imagingOrderId: order.id,
      },
      update: {
        identityVerified: payload.identityVerified,
        identityVerificationMethod: payload.identityVerificationMethod,
        identityVerifiedAt: payload.identityVerified ? new Date() : null,
        safetyStatus: decision.safetyStatus,
        safetyNotes: payload.safetyNotes?.trim() || null,
        answers: payload.answers as unknown as object,
        riskFactors: decision.riskFactors,
        reviewedAt: new Date(),
        completedByUserId: userContext.userId,
      },
      create: {
        imagingOrderId: order.id,
        patientId: order.patientId,
        appointmentId: order.appointment?.id || null,
        completedByUserId: userContext.userId,
        modality: order.modality,
        identityVerified: payload.identityVerified,
        identityVerificationMethod: payload.identityVerificationMethod,
        identityVerifiedAt: payload.identityVerified ? new Date() : null,
        safetyStatus: decision.safetyStatus,
        safetyNotes: payload.safetyNotes?.trim() || null,
        answers: payload.answers as unknown as object,
        riskFactors: decision.riskFactors,
        reviewedAt: new Date(),
      },
    });

    if (newOrderStatus !== order.orderStatus) {
      await tx.imagingOrder.update({
        where: { id: order.id },
        data: { orderStatus: newOrderStatus },
      });
    }

    return saved;
  });

  // 5. Audit Logging (Non-blocking outside transaction)
  if (payload.identityVerified) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PATIENT_IDENTITY_VERIFIED',
      entityType: 'Patient',
      entityId: order.patient.id,
      details: {
        patientId: order.patient.patientId,
        accessionNumber: order.accessionNumber,
        method: payload.identityVerificationMethod,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  }

  if (decision.safetyStatus === SafetyStatus.CLEARED) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'SAFETY_CLEARED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        patientId: order.patient.patientId,
        modality: order.modality,
        cautionNotes: decision.cautionNotes,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } else if (decision.safetyStatus === SafetyStatus.REQUIRES_REVIEW) {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'SAFETY_REQUIRES_REVIEW',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        patientId: order.patient.patientId,
        modality: order.modality,
        riskFactors: decision.riskFactors,
        notes: payload.safetyNotes,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } else {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'SAFETY_SCREENING_UPDATED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        status: decision.safetyStatus,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  }

  return {
    screening,
    decision,
    orderStatus: newOrderStatus,
  };
}


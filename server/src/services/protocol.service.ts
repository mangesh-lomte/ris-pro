import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  ExamDefinition,
  ImagingProtocol,
  OrderStatus,
  PreparationStatus,
  SafetyStatus,
} from '@prisma/client';

/**
 * Validates protocol compatibility with order modality, exam definition, and anatomical target.
 * Server is strictly authoritative; client selection alone is never trusted.
 */
export function validateProtocolCompatibility(
  protocol: ImagingProtocol,
  order: { modality: string; bodyPart?: string | null; examinationName?: string },
  examDefinition?: Partial<ExamDefinition> | null
): void {
  // 1. Active Status Check
  if (!protocol.isActive) {
    throw AppError.conflict(
      `Protocol '${protocol.code}' is inactive or deprecated. Only active protocols may be confirmed.`
    );
  }

  // 2. Modality Compatibility Check
  if (protocol.modality !== order.modality) {
    throw AppError.conflict(
      `Protocol modality mismatch: cannot apply ${protocol.modality} protocol '${protocol.code}' to ${order.modality} examination.`
    );
  }

  // 3. Exam Definition Compatibility (where configured)
  if (protocol.examDefinitionId && examDefinition?.id) {
    if (protocol.examDefinitionId !== examDefinition.id) {
      throw AppError.conflict(
        `Protocol '${protocol.code}' is designated for exam '${protocol.examDefinitionId}', which is incompatible with scheduled exam '${examDefinition.code || examDefinition.name}'.`
      );
    }
  }

  // 4. Body Part / Anatomy Compatibility Check (where configured)
  if (protocol.bodyPart && order.bodyPart) {
    const protoAnatomy = protocol.bodyPart.toLowerCase().trim();
    const orderAnatomy = order.bodyPart.toLowerCase().trim();
    const isAnatomyCompatible =
      protoAnatomy === orderAnatomy ||
      orderAnatomy.includes(protoAnatomy) ||
      protoAnatomy.includes(orderAnatomy);

    if (!isAnatomyCompatible) {
      throw AppError.conflict(
        `Protocol '${protocol.code}' designated for anatomy '${protocol.bodyPart}' is incompatible with order anatomy '${order.bodyPart}'.`
      );
    }
  }
}

/**
 * Atomically confirms an approved workflow protocol and advances the order to READY_FOR_SCAN.
 * Enforces authoritative gates: Safety == CLEARED, Preparation == COMPLETE, Protocol active and compatible.
 *
 * NOTE: READY_FOR_SCAN signifies patient preparation is complete and protocol is confirmed.
 * It does NOT start image acquisition, launch a scanner console, create DICOM files, or transmit to PACS.
 */
export async function confirmProtocol(
  identifier: string,
  protocolId: string,
  userContext: { userId: string; ipAddress?: string; userAgent?: string }
): Promise<{
  orderId: string;
  accessionNumber: string;
  preparationStatus: PreparationStatus;
  protocol: {
    id: string;
    code: string;
    name: string;
    modality: string;
    bodyPart: string | null;
  };
  orderStatus: OrderStatus;
}> {
  if (!protocolId || protocolId.trim().length === 0) {
    throw AppError.badRequest('Protocol ID is required for confirmation.');
  }

  // 1. Resolve order with all related gate entities
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
      confirmedProtocol: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found for identifier: ${identifier}`);
  }

  // 2. Gate 1: Protocol Lock Status Check
  if (order.orderStatus === OrderStatus.READY_FOR_SCAN) {
    throw AppError.conflict(
      `Protocol is already confirmed and locked in READY_FOR_SCAN status for accession ${order.accessionNumber}. Modifications are restricted.`
    );
  }

  if (order.orderStatus === OrderStatus.COMPLETED || order.orderStatus === OrderStatus.CANCELLED) {
    throw AppError.conflict(
      `Cannot confirm protocol on an order in status '${order.orderStatus}'.`
    );
  }

  // 3. Gate 2: Authoritative Safety Clearance
  const isSafetyCleared =
    order.safetyScreening?.safetyStatus === SafetyStatus.CLEARED &&
    (order.orderStatus === OrderStatus.SAFETY_CLEARED ||
      order.orderStatus === OrderStatus.PREPARATION_IN_PROGRESS ||
      order.orderStatus === OrderStatus.PREPARED);

  if (!isSafetyCleared) {
    throw AppError.conflict(
      `Protocol confirmation requires CLEARED safety status and order in a preparation state. Current safetyStatus: '${
        order.safetyScreening?.safetyStatus || 'NOT_STARTED'
      }', orderStatus: '${order.orderStatus}'.`
    );
  }

  // 4. Gate 3: Preparation Completion Gate
  if (!order.preparation || order.preparation.preparationStatus !== PreparationStatus.COMPLETE) {
    throw AppError.conflict(
      `Patient preparation must be COMPLETE before protocol can be confirmed. Current preparation status: '${
        order.preparation?.preparationStatus || 'NOT_STARTED'
      }'.`
    );
  }

  // 5. Gate 4: Protocol Resolution & Compatibility Check
  const protocol = await prisma.imagingProtocol.findUnique({
    where: { id: protocolId.trim() },
  });

  if (!protocol) {
    throw AppError.notFound(`Imaging protocol not found for ID: ${protocolId}`);
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

  validateProtocolCompatibility(
    protocol,
    order,
    examDef
  );

  // 6. Atomic Transaction: Confirm Protocol and Transition OrderStatus to READY_FOR_SCAN
  const updatedOrder = await prisma.$transaction(async (tx) => {
    return tx.imagingOrder.update({
      where: { id: order.id },
      data: {
        confirmedProtocolId: protocol.id,
        protocolConfirmedAt: new Date(),
        protocolConfirmedById: userContext.userId,
        orderStatus: OrderStatus.READY_FOR_SCAN,
      },
      include: {
        confirmedProtocol: true,
      },
    });
  });

  // 7. Audit Logging
  try {
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PROTOCOL_SELECTED',
      entityType: 'ImagingProtocol',
      entityId: protocol.id,
      details: {
        protocolCode: protocol.code,
        accessionNumber: order.accessionNumber,
        modality: protocol.modality,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    await logAuditEvent({
      userId: userContext.userId,
      action: 'PROTOCOL_CONFIRMED',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        protocolCode: protocol.code,
        protocolName: protocol.name,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    await logAuditEvent({
      userId: userContext.userId,
      action: 'ORDER_READY_FOR_SCAN',
      entityType: 'ImagingOrder',
      entityId: order.id,
      details: {
        accessionNumber: order.accessionNumber,
        protocolCode: protocol.code,
        orderStatus: OrderStatus.READY_FOR_SCAN,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });
  } catch {
    // Non-blocking audit failure
  }

  return {
    orderId: updatedOrder.id,
    accessionNumber: updatedOrder.accessionNumber,
    preparationStatus: PreparationStatus.COMPLETE,
    protocol: {
      id: protocol.id,
      code: protocol.code,
      name: protocol.name,
      modality: protocol.modality,
      bodyPart: protocol.bodyPart,
    },
    orderStatus: OrderStatus.READY_FOR_SCAN,
  };
}

import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { isOrderEligibleForRadiologist, getEffectivePacsAdapter, UserContext } from './radiologist.service';
import { CriticalFindingStatus, UserRole } from '@prisma/client';

export interface CreateCriticalFindingInput {
  imagingOrderId: string;
  recipientId: string;
  findingText: string;
  severity?: string;
  userContext: UserContext;
  requesterRole: UserRole;
}

export interface CriticalFindingQueueQuery {
  status?: CriticalFindingStatus;
  page?: number;
  limit?: number;
  userId: string;
  userRole: UserRole;
}

export interface AcknowledgeCriticalFindingInput {
  id: string;
  notes?: string;
  userContext: UserContext;
  userRole: UserRole;
}

/**
 * 1. Create and Send Critical Finding Alert
 */
export async function createCriticalFinding(input: CreateCriticalFindingInput) {
  const { imagingOrderId, recipientId, findingText, severity, userContext, requesterRole } = input;

  if (requesterRole !== UserRole.RADIOLOGIST && requesterRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Only radiologists or administrators can create critical finding alerts');
  }

  if (!findingText || !findingText.trim()) {
    throw AppError.badRequest('Finding text description is required');
  }

  // Validate recipient exists, is active, and is an eligible clinician (RADIOLOGIST or ADMIN)
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
  });

  if (!recipient || !recipient.isActive || (recipient.role !== UserRole.RADIOLOGIST && recipient.role !== UserRole.ADMIN)) {
    throw AppError.badRequest('Selected recipient is not an eligible active Clinician');
  }

  // Fetch imaging order and verify eligibility
  const order = await prisma.imagingOrder.findUnique({
    where: { id: imagingOrderId },
    include: {
      patient: { select: { id: true, patientId: true, firstName: true, lastName: true, isActive: true } },
      imageQualityReviews: { select: { status: true } },
      scanLifecycles: {
        select: {
          attemptNumber: true,
          state: true,
          imageQualityReview: { select: { status: true } },
        },
      },
      pacsStudyLink: true,
      pacsHandoffs: { select: { status: true } },
    },
  });

  if (!order) {
    throw AppError.notFound('Imaging order not found');
  }

  const isEligible = isOrderEligibleForRadiologist(order as any, getEffectivePacsAdapter());
  if (!isEligible) {
    throw AppError.badRequest('Order is not eligible for critical finding alert (must be quality-accepted and PACS-linked)');
  }

  // Concurrency & Duplicate Action Protection:
  // Check if a pending critical finding already exists for this order
  const existingPending = await prisma.criticalFinding.findFirst({
    where: {
      imagingOrderId,
      status: CriticalFindingStatus.PENDING,
    },
  });

  if (existingPending) {
    throw AppError.conflict('A pending critical finding alert already exists for this study');
  }

  // Create Critical Finding
  const created = await prisma.criticalFinding.create({
    data: {
      imagingOrderId,
      createdById: userContext.userId,
      recipientId,
      findingText: findingText.trim(),
      severity: severity?.trim() || 'CRITICAL',
      status: CriticalFindingStatus.PENDING,
      sentAt: new Date(),
    },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      recipient: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      acknowledgedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Audit event for critical finding creation
  await logAuditEvent({
    userId: userContext.userId,
    action: 'CRITICAL_FINDING_CREATED',
    entityType: 'ImagingOrder',
    entityId: imagingOrderId,
    details: {
      criticalFindingId: created.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      createdById: userContext.userId,
      recipientId,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      severity: created.severity,
      findingText: created.findingText,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return formatCriticalFindingItem(created);
}

/**
 * 2. Get Critical Finding Queue
 */
export async function getCriticalFindingQueue(query: CriticalFindingQueueQuery) {
  const { status, page = 1, limit = 20, userId, userRole } = query;
  const skip = (page - 1) * limit;

  // Build where condition
  const where: any = {};
  if (status) {
    where.status = status;
  }

  // If not admin, restrict to findings where user is recipient OR creator
  if (userRole !== UserRole.ADMIN) {
    where.OR = [
      { recipientId: userId },
      { createdById: userId },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.criticalFinding.findMany({
      where,
      skip,
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        imagingOrder: {
          include: {
            patient: true,
            pacsStudyLink: true,
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        recipient: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        acknowledgedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.criticalFinding.count({ where }),
  ]);

  return {
    items: items.map(formatCriticalFindingItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * 3. Get Critical Finding by ID
 */
export async function getCriticalFindingById(id: string) {
  const finding = await prisma.criticalFinding.findUnique({
    where: { id },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      recipient: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      acknowledgedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!finding) {
    throw AppError.notFound('Critical finding not found');
  }

  return formatCriticalFindingItem(finding);
}

/**
 * 4. Get Order's Latest Critical Finding
 */
export async function getOrderCriticalFinding(imagingOrderId: string) {
  const finding = await prisma.criticalFinding.findFirst({
    where: { imagingOrderId },
    orderBy: { createdAt: 'desc' },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      recipient: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      acknowledgedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!finding) {
    return null;
  }

  return formatCriticalFindingItem(finding);
}

/**
 * 5. Acknowledge Critical Finding
 */
export async function acknowledgeCriticalFinding(input: AcknowledgeCriticalFindingInput) {
  const { id, notes, userContext, userRole } = input;

  const finding = await prisma.criticalFinding.findUnique({
    where: { id },
    include: {
      imagingOrder: {
        include: {
          patient: true,
        },
      },
    },
  });

  if (!finding) {
    throw AppError.notFound('Critical finding not found');
  }

  // Stale state / duplicate acknowledgment protection:
  if (finding.status === CriticalFindingStatus.ACKNOWLEDGED) {
    throw AppError.conflict('Critical finding has already been acknowledged');
  }

  // RBAC validation:
  // Only designated recipient clinician or admin can acknowledge
  if (userRole !== UserRole.ADMIN && finding.recipientId !== userContext.userId) {
    throw AppError.forbidden('You are not authorized to acknowledge this critical finding');
  }

  const updated = await prisma.criticalFinding.update({
    where: { id },
    data: {
      status: CriticalFindingStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedById: userContext.userId,
      acknowledgmentNotes: notes?.trim() || null,
    },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      recipient: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      acknowledgedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Audit event for acknowledgment
  await logAuditEvent({
    userId: userContext.userId,
    action: 'CRITICAL_FINDING_ACKNOWLEDGED',
    entityType: 'ImagingOrder',
    entityId: finding.imagingOrderId,
    details: {
      criticalFindingId: updated.id,
      accessionNumber: finding.imagingOrder.accessionNumber,
      patientId: finding.imagingOrder.patient.patientId,
      recipientId: finding.recipientId,
      acknowledgedById: userContext.userId,
      acknowledgedAt: updated.acknowledgedAt,
      acknowledgmentNotes: updated.acknowledgmentNotes,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return formatCriticalFindingItem(updated);
}

/**
 * 6. Get Active Clinicians for dropdown selector
 */
export async function getActiveClinicians() {
  const clinicians = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [UserRole.RADIOLOGIST, UserRole.ADMIN] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
    orderBy: { lastName: 'asc' },
  });

  return clinicians.map((c) => ({
    id: c.id,
    name: `Dr. ${c.firstName} ${c.lastName}`,
    email: c.email,
    role: c.role,
  }));
}

/**
 * Formatting helper
 */
function formatCriticalFindingItem(finding: any) {
  return {
    id: finding.id,
    imagingOrderId: finding.imagingOrderId,
    order: finding.imagingOrder
      ? {
          id: finding.imagingOrder.id,
          accessionNumber: finding.imagingOrder.accessionNumber,
          modality: finding.imagingOrder.modality,
          bodyPart: finding.imagingOrder.bodyPart,
          examinationName: finding.imagingOrder.examinationName,
          patientId: finding.imagingOrder.patient?.patientId,
          patientName: finding.imagingOrder.patient
            ? `${finding.imagingOrder.patient.lastName}, ${finding.imagingOrder.patient.firstName}`
            : 'Unknown',
        }
      : undefined,
    findingText: finding.findingText,
    status: finding.status,
    severity: finding.severity,
    sentAt: finding.sentAt,
    acknowledgedAt: finding.acknowledgedAt,
    acknowledgmentNotes: finding.acknowledgmentNotes,
    createdBy: {
      id: finding.createdBy?.id,
      name: finding.createdBy ? `Dr. ${finding.createdBy.firstName} ${finding.createdBy.lastName}` : 'Unknown',
      email: finding.createdBy?.email,
    },
    recipient: {
      id: finding.recipient?.id,
      name: finding.recipient ? `Dr. ${finding.recipient.firstName} ${finding.recipient.lastName}` : 'Unknown',
      email: finding.recipient?.email,
    },
    acknowledgedBy: finding.acknowledgedBy
      ? {
          id: finding.acknowledgedBy.id,
          name: `Dr. ${finding.acknowledgedBy.firstName} ${finding.acknowledgedBy.lastName}`,
          email: finding.acknowledgedBy.email,
        }
      : null,
    createdAt: finding.createdAt,
    updatedAt: finding.updatedAt,
  };
}


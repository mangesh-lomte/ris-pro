import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { isOrderEligibleForRadiologist, getEffectivePacsAdapter, formatDraftResponse, UserContext } from './radiologist.service';
import { PeerReviewStatus, UserRole } from '@prisma/client';

export interface RequestPeerReviewInput {
  imagingOrderId: string;
  reviewerId: string;
  reason?: string;
  userContext: UserContext;
  requesterRole: UserRole;
}

export interface PeerReviewQueueQuery {
  status?: PeerReviewStatus;
  type?: 'assigned' | 'requested' | 'all';
  page?: number;
  limit?: number;
}

export interface SubmitPeerReviewInput {
  peerReviewId: string;
  reviewComment: string;
  decision?: string;
  userContext: UserContext;
  role: UserRole;
}

/**
 * 1. Request Peer Review / Second Opinion
 */
export async function requestPeerReview(input: RequestPeerReviewInput) {
  const { imagingOrderId, reviewerId, reason, userContext, requesterRole } = input;

  if (requesterRole !== UserRole.RADIOLOGIST && requesterRole !== UserRole.ADMIN) {
    throw AppError.forbidden('Only radiologists or administrators can request peer review');
  }

  // Prevent requester from reviewing their own case
  if (reviewerId === userContext.userId) {
    throw AppError.badRequest('Requester cannot select themselves as peer reviewer');
  }

  // Validate reviewer exists, is active, and has RADIOLOGIST role
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
  });

  if (!reviewer || !reviewer.isActive || reviewer.role !== UserRole.RADIOLOGIST) {
    throw AppError.badRequest('Selected reviewer is not an eligible active Radiologist');
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
    throw AppError.badRequest('Order is not eligible for peer review (must be quality-accepted and PACS-linked)');
  }

  // Check if an active peer review request already exists for this study
  const existingActive = await prisma.peerReviewRequest.findFirst({
    where: {
      imagingOrderId,
      status: { in: [PeerReviewStatus.PENDING, PeerReviewStatus.IN_REVIEW] },
    },
  });

  if (existingActive) {
    throw AppError.conflict('Peer review already requested for this study');
  }

  // Create Peer Review Request
  const created = await prisma.peerReviewRequest.create({
    data: {
      imagingOrderId,
      requesterId: userContext.userId,
      reviewerId,
      status: PeerReviewStatus.PENDING,
      reason: reason?.trim() || null,
    },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
        },
      },
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      reviewer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  // Audit event
  await logAuditEvent({
    userId: userContext.userId,
    action: 'PEER_REVIEW_REQUESTED',
    entityType: 'ImagingOrder',
    entityId: imagingOrderId,
    details: {
      peerReviewId: created.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      requesterId: userContext.userId,
      reviewerId,
      reason: created.reason,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return created;
}

/**
 * 2. Get Peer Review Queue
 */
export async function getPeerReviewQueue(
  userId: string,
  role: UserRole,
  query: PeerReviewQueueQuery
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const filterType = query.type || 'assigned';

  const where: any = {};

  if (role === UserRole.RADIOLOGIST) {
    if (filterType === 'assigned') {
      where.reviewerId = userId;
    } else if (filterType === 'requested') {
      where.requesterId = userId;
    } else {
      where.OR = [{ reviewerId: userId }, { requesterId: userId }];
    }
  }

  if (query.status) {
    where.status = query.status;
  }

  const [total, items] = await Promise.all([
    prisma.peerReviewRequest.count({ where }),
    prisma.peerReviewRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { requestedAt: 'desc' },
      ],
      include: {
        imagingOrder: {
          include: {
            patient: true,
            pacsStudyLink: true,
          },
        },
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      imagingOrderId: item.imagingOrderId,
      status: item.status,
      reason: item.reason,
      reviewComment: item.reviewComment,
      decision: item.decision,
      requestedAt: item.requestedAt.toISOString(),
      startedAt: item.startedAt?.toISOString() || null,
      completedAt: item.completedAt?.toISOString() || null,
      cancelledAt: item.cancelledAt?.toISOString() || null,
      patient: {
        id: item.imagingOrder.patient.id,
        patientId: item.imagingOrder.patient.patientId,
        name: `${item.imagingOrder.patient.lastName}, ${item.imagingOrder.patient.firstName}`,
        dob: item.imagingOrder.patient.dateOfBirth.toISOString().split('T')[0],
        gender: item.imagingOrder.patient.gender,
      },
      order: {
        id: item.imagingOrder.id,
        accessionNumber: item.imagingOrder.accessionNumber,
        modality: item.imagingOrder.modality,
        procedureName: item.imagingOrder.examinationName,
        bodyPart: item.imagingOrder.bodyPart,
        priority: item.imagingOrder.priority,
        studyInstanceUid: item.imagingOrder.pacsStudyLink?.studyInstanceUid || null,
      },
      requester: {
        id: item.requester.id,
        name: `Dr. ${item.requester.firstName} ${item.requester.lastName}`,
        email: item.requester.email,
      },
      reviewer: {
        id: item.reviewer.id,
        name: `Dr. ${item.reviewer.firstName} ${item.reviewer.lastName}`,
        email: item.reviewer.email,
      },
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 3. Get Peer Review Context
 */
export async function getPeerReviewContext(
  peerReviewId: string,
  userId: string,
  role: UserRole
) {
  const request = await prisma.peerReviewRequest.findUnique({
    where: { id: peerReviewId },
    include: {
      imagingOrder: {
        include: {
          patient: true,
          pacsStudyLink: true,
          reportDraft: true,
        },
      },
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      reviewer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!request) {
    throw AppError.notFound('Peer review request not found');
  }

  // Authorization check: requester, assigned reviewer, or admin
  const isAuthorized =
    role === UserRole.ADMIN ||
    request.reviewerId === userId ||
    request.requesterId === userId;

  if (!isAuthorized) {
    throw AppError.forbidden('Access denied to this peer review record');
  }

  return {
    id: request.id,
    imagingOrderId: request.imagingOrderId,
    status: request.status,
    reason: request.reason,
    reviewComment: request.reviewComment,
    decision: request.decision,
    requestedAt: request.requestedAt.toISOString(),
    startedAt: request.startedAt?.toISOString() || null,
    completedAt: request.completedAt?.toISOString() || null,
    cancelledAt: request.cancelledAt?.toISOString() || null,
    patient: {
      id: request.imagingOrder.patient.id,
      patientId: request.imagingOrder.patient.patientId,
      name: `${request.imagingOrder.patient.lastName}, ${request.imagingOrder.patient.firstName}`,
      dob: request.imagingOrder.patient.dateOfBirth.toISOString().split('T')[0],
      gender: request.imagingOrder.patient.gender,
    },
    order: {
      id: request.imagingOrder.id,
      accessionNumber: request.imagingOrder.accessionNumber,
      modality: request.imagingOrder.modality,
      procedureName: request.imagingOrder.examinationName,
      bodyPart: request.imagingOrder.bodyPart,
      priority: request.imagingOrder.priority,
      studyInstanceUid: request.imagingOrder.pacsStudyLink?.studyInstanceUid || null,
    },
    primaryDraftSummary: request.imagingOrder.reportDraft
      ? {
          templateName: request.imagingOrder.reportDraft.templateName,
          content: formatDraftResponse(request.imagingOrder.reportDraft).content,
          version: request.imagingOrder.reportDraft.version,
          updatedAt: request.imagingOrder.reportDraft.updatedAt.toISOString(),
        }
      : null,
    requester: {
      id: request.requester.id,
      name: `Dr. ${request.requester.firstName} ${request.requester.lastName}`,
      email: request.requester.email,
    },
    reviewer: {
      id: request.reviewer.id,
      name: `Dr. ${request.reviewer.firstName} ${request.reviewer.lastName}`,
      email: request.reviewer.email,
    },
  };
}

/**
 * 4. Claim Peer Review (Reviewer picks up pending review)
 */
export async function claimPeerReview(
  peerReviewId: string,
  userContext: UserContext,
  role: UserRole
) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.peerReviewRequest.findUnique({
      where: { id: peerReviewId },
    });

    if (!request) {
      throw AppError.notFound('Peer review request not found');
    }

    if (role !== UserRole.ADMIN && request.reviewerId !== userContext.userId) {
      throw AppError.forbidden('Only the assigned reviewer can claim this peer review');
    }

    if (request.status === PeerReviewStatus.IN_REVIEW) {
      throw AppError.conflict('PEER_REVIEW_ALREADY_CLAIMED: This peer review request has already been claimed');
    }

    if (request.status === PeerReviewStatus.COMPLETED) {
      throw AppError.conflict('Cannot claim a completed peer review');
    }

    if (request.status === PeerReviewStatus.CANCELLED) {
      throw AppError.conflict('Cannot claim a cancelled peer review');
    }

    const updated = await tx.peerReviewRequest.update({
      where: { id: peerReviewId },
      data: {
        status: PeerReviewStatus.IN_REVIEW,
        startedAt: new Date(),
      },
      include: {
        imagingOrder: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await logAuditEvent({
      userId: userContext.userId,
      action: 'PEER_REVIEW_CLAIMED',
      entityType: 'ImagingOrder',
      entityId: updated.imagingOrderId,
      details: {
        peerReviewId: updated.id,
        reviewerId: userContext.userId,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return updated;
  });
}

/**
 * 5. Submit Peer Review / Second Opinion
 */
export async function submitPeerReview(input: SubmitPeerReviewInput) {
  const { peerReviewId, reviewComment, decision, userContext, role } = input;

  if (!reviewComment || reviewComment.trim().length === 0) {
    throw AppError.badRequest('Reviewer comment / second opinion text is required');
  }

  return await prisma.$transaction(async (tx) => {
    const request = await tx.peerReviewRequest.findUnique({
      where: { id: peerReviewId },
    });

    if (!request) {
      throw AppError.notFound('Peer review request not found');
    }

    if (role !== UserRole.ADMIN && request.reviewerId !== userContext.userId) {
      throw AppError.forbidden('Only the assigned reviewer can submit this second opinion');
    }

    if (request.status === PeerReviewStatus.COMPLETED) {
      throw AppError.conflict('Peer review has already been completed');
    }

    if (request.status === PeerReviewStatus.CANCELLED) {
      throw AppError.conflict('Peer review request was cancelled');
    }

    // Update peer review request to COMPLETED
    const updated = await tx.peerReviewRequest.update({
      where: { id: peerReviewId },
      data: {
        reviewComment: reviewComment.trim(),
        decision: decision?.trim() || 'SECOND_OPINION',
        status: PeerReviewStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        imagingOrder: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Audit log
    await logAuditEvent({
      userId: userContext.userId,
      action: 'PEER_REVIEW_COMPLETED',
      entityType: 'ImagingOrder',
      entityId: updated.imagingOrderId,
      details: {
        peerReviewId: updated.id,
        reviewerId: userContext.userId,
        decision: updated.decision,
      },
      ipAddress: userContext.ipAddress,
      userAgent: userContext.userAgent,
    });

    return updated;
  });
}

/**
 * 6. Cancel Peer Review
 */
export async function cancelPeerReview(
  peerReviewId: string,
  userContext: UserContext,
  role: UserRole
) {
  const request = await prisma.peerReviewRequest.findUnique({
    where: { id: peerReviewId },
  });

  if (!request) {
    throw AppError.notFound('Peer review request not found');
  }

  if (role !== UserRole.ADMIN && request.requesterId !== userContext.userId) {
    throw AppError.forbidden('Only the requester or admin can cancel this peer review');
  }

  if (request.status === PeerReviewStatus.COMPLETED) {
    throw AppError.badRequest('Cannot cancel a completed peer review');
  }

  const updated = await prisma.peerReviewRequest.update({
    where: { id: peerReviewId },
    data: {
      status: PeerReviewStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: userContext.userId,
    action: 'PEER_REVIEW_CANCELLED',
    entityType: 'ImagingOrder',
    entityId: updated.imagingOrderId,
    details: {
      peerReviewId: updated.id,
      cancelledBy: userContext.userId,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return updated;
}

/**
 * 7. Get Peer Review for Order (Primary Radiologist View)
 */
export async function getPeerReviewForOrder(
  imagingOrderId: string,
  userId: string,
  role: UserRole
) {
  const latest = await prisma.peerReviewRequest.findFirst({
    where: {
      imagingOrderId,
      status: { not: PeerReviewStatus.CANCELLED },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!latest) {
    return null;
  }

  // Authorization: requester, reviewer, or admin
  const isAuthorized =
    role === UserRole.ADMIN ||
    latest.reviewerId === userId ||
    latest.requesterId === userId;

  if (!isAuthorized) {
    return null;
  }

  return {
    id: latest.id,
    imagingOrderId: latest.imagingOrderId,
    status: latest.status,
    reason: latest.reason,
    reviewComment: latest.reviewComment,
    decision: latest.decision,
    requestedAt: latest.requestedAt.toISOString(),
    startedAt: latest.startedAt?.toISOString() || null,
    completedAt: latest.completedAt?.toISOString() || null,
    requester: {
      id: latest.requester.id,
      name: `Dr. ${latest.requester.firstName} ${latest.requester.lastName}`,
      email: latest.requester.email,
    },
    reviewer: {
      id: latest.reviewer.id,
      name: `Dr. ${latest.reviewer.firstName} ${latest.reviewer.lastName}`,
      email: latest.reviewer.email,
    },
  };
}

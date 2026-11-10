import jwt, { SignOptions } from 'jsonwebtoken';
import {
  ReportStatus,
  UserRole,
  ReportDeliveryMethod,
  NotificationChannel,
} from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { getReportPdfStream } from './reportPdf.service';

export interface UserContext {
  userId?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Marks a finalized and locked report as ready for front-desk / reception delivery.
 */
export async function sendReportToReception(orderId: string, userContext: UserContext) {
  const order = await prisma.imagingOrder.findUnique({
    where: { id: orderId },
    include: {
      patient: true,
      report: true,
    },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Imaging order or report not found for ID: ${orderId}`);
  }

  const report = order.report;

  // Enforce frozen rule: ONLY finalized and locked reports can be sent to reception
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot send report to reception: Report is in status '${report.status}'. Only finalized and locked reports can be sent to reception.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  if (!report.isLocked) {
    throw AppError.conflict(
      'Cannot send report to reception: Report is not locked.',
      'REPORT_NOT_LOCKED'
    );
  }

  const updatedReport = await prisma.report.update({
    where: { id: report.id },
    data: {
      isReadyForReception: true,
      readyForReceptionAt: new Date(),
      readyForReceptionById: userContext.userId || null,
    },
    include: {
      signedBy: { select: { id: true, firstName: true, lastName: true } },
      readyForReceptionBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Audit event
  await logAuditEvent({
    userId: userContext.userId || undefined,
    action: 'REPORT_SENT_TO_RECEPTION',
    entityType: 'Report',
    entityId: report.id,
    details: {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      version: report.version,
      readyForReceptionAt: updatedReport.readyForReceptionAt,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
    reportId: report.id,
    status: report.status,
    version: report.version,
    isReadyForReception: updatedReport.isReadyForReception,
    readyForReceptionAt: updatedReport.readyForReceptionAt?.toISOString(),
    readyForReceptionBy: updatedReport.readyForReceptionBy
      ? `${updatedReport.readyForReceptionBy.firstName} ${updatedReport.readyForReceptionBy.lastName}`.trim()
      : null,
  };
}

/**
 * Returns all finalized reports marked as ready for front-desk reception collection.
 */
export async function getReceptionReadyReports() {
  const orders = await prisma.imagingOrder.findMany({
    where: {
      report: {
        isReadyForReception: true,
        status: { in: [ReportStatus.FINAL, ReportStatus.ADDENDUM] },
      },
    },
    include: {
      patient: true,
      study: true,
      referringDoctor: true,
      report: {
        include: {
          signedBy: { select: { id: true, firstName: true, lastName: true } },
          readyForReceptionBy: { select: { id: true, firstName: true, lastName: true } },
          deliveries: {
            orderBy: { deliveredAt: 'desc' },
            include: { deliveredByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
          notifications: {
            orderBy: { sentAt: 'desc' },
            include: { sentByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
          reprints: {
            orderBy: { printedAt: 'desc' },
            include: { printedByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
    orderBy: {
      report: {
        readyForReceptionAt: 'desc',
      },
    },
  });

  return orders.map((order) => {
    const report = order.report!;
    const deliveriesCount = report.deliveries.length;
    const isDelivered = deliveriesCount > 0;

    return {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      dateOfBirth: order.patient.dateOfBirth.toISOString().split('T')[0],
      phone: order.patient.phone,
      email: order.patient.email,
      modality: order.modality,
      examinationName: order.examinationName,
      priority: order.priority,
      referringDoctorName: order.referringDoctor?.name || order.referringDoctorText || 'Self-referred',
      reportId: report.id,
      reportStatus: report.status,
      reportVersion: report.version,
      finalizedAt: report.finalizedAt?.toISOString(),
      signedAt: report.signedAt?.toISOString(),
      signedBy: report.signedBy ? `${report.signedBy.firstName} ${report.signedBy.lastName}`.trim() : 'Attending Radiologist',
      hasPdf: !!report.pdfArtifactPath,
      pdfGeneratedAt: report.pdfGeneratedAt?.toISOString(),
      isReadyForReception: report.isReadyForReception,
      readyForReceptionAt: report.readyForReceptionAt?.toISOString(),
      readyForReceptionBy: report.readyForReceptionBy
        ? `${report.readyForReceptionBy.firstName} ${report.readyForReceptionBy.lastName}`.trim()
        : null,
      deliveryStatus: isDelivered ? 'DELIVERED' : 'READY_FOR_PICKUP',
      lastDeliveredAt: report.deliveries[0]?.deliveredAt.toISOString() || null,
      deliveriesCount,
      notificationsCount: report.notifications.length,
      reprintsCount: report.reprints.length,
      deliveries: report.deliveries.map((d) => ({
        id: d.id,
        version: d.version,
        deliveryMethod: d.deliveryMethod,
        recipientName: d.recipientName,
        recipientRole: d.recipientRole,
        deliveredAt: d.deliveredAt.toISOString(),
        deliveredBy: d.deliveredByUser ? `${d.deliveredByUser.firstName} ${d.deliveredByUser.lastName}`.trim() : null,
        status: d.status,
        notes: d.notes,
      })),
      notifications: report.notifications.map((n) => ({
        id: n.id,
        channel: n.channel,
        recipientContact: n.recipientContact,
        messageBody: n.messageBody,
        status: n.status,
        provider: n.provider,
        sentAt: n.sentAt.toISOString(),
        sentBy: n.sentByUser ? `${n.sentByUser.firstName} ${n.sentByUser.lastName}`.trim() : null,
      })),
      reprints: report.reprints.map((r) => ({
        id: r.id,
        version: r.version,
        printedAt: r.printedAt.toISOString(),
        printedBy: `${r.printedByUser.firstName} ${r.printedByUser.lastName}`.trim(),
        reason: r.reason,
        copiesCount: r.copiesCount,
      })),
    };
  });
}

/**
 * Records physical delivery or reception handover acknowledgment.
 */
export async function recordDeliveryAcknowledgment(
  orderId: string,
  params: {
    deliveryMethod: ReportDeliveryMethod;
    recipientName: string;
    recipientRole?: string;
    notes?: string;
  },
  userContext: UserContext
) {
  const order = await prisma.imagingOrder.findUnique({
    where: { id: orderId },
    include: { patient: true, report: true },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Order or report not found for ID: ${orderId}`);
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot record delivery: Report is in status '${report.status}'. Only finalized reports can be delivered.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const delivery = await prisma.reportDelivery.create({
    data: {
      reportId: report.id,
      version: report.version,
      deliveryMethod: params.deliveryMethod,
      recipientName: params.recipientName.trim(),
      recipientRole: params.recipientRole?.trim() || 'PATIENT',
      deliveredById: userContext.userId || null,
      status: 'ACKNOWLEDGED',
      notes: params.notes?.trim() || null,
    },
    include: {
      deliveredByUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Audit event
  await logAuditEvent({
    userId: userContext.userId || undefined,
    action: 'REPORT_DELIVERY_ACKNOWLEDGED',
    entityType: 'ReportDelivery',
    entityId: delivery.id,
    details: {
      orderId: order.id,
      reportId: report.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      deliveryMethod: params.deliveryMethod,
      recipientName: params.recipientName,
      recipientRole: params.recipientRole || 'PATIENT',
      version: report.version,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    deliveryId: delivery.id,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    version: delivery.version,
    deliveryMethod: delivery.deliveryMethod,
    recipientName: delivery.recipientName,
    recipientRole: delivery.recipientRole,
    status: delivery.status,
    deliveredAt: delivery.deliveredAt.toISOString(),
    deliveredBy: delivery.deliveredByUser
      ? `${delivery.deliveredByUser.firstName} ${delivery.deliveredByUser.lastName}`.trim()
      : null,
    notes: delivery.notes,
  };
}

/**
 * Triggers patient SMS or Email notification with non-sensitive availability alert.
 */
export async function sendPatientNotification(
  orderId: string,
  params: {
    channel: NotificationChannel;
    destinationOverride?: string;
  },
  userContext: UserContext
) {
  const order = await prisma.imagingOrder.findUnique({
    where: { id: orderId },
    include: { patient: true, report: true },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Order or report not found for ID: ${orderId}`);
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot send notification: Report is in status '${report.status}'. Only finalized reports can trigger notification alerts.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const recipientContact =
    params.destinationOverride?.trim() ||
    (params.channel === NotificationChannel.SMS
      ? order.patient.phone
      : order.patient.email || `${order.patient.patientId.toLowerCase()}@patientportal.local`);

  // NON-SENSITIVE message: strictly NO Findings, Impression, or diagnoses!
  const messageBody = `RadNexus Diagnostic Imaging Center: Your examination report for Accession ${order.accessionNumber} (${order.examinationName}) is finalized and ready. Please visit the reception desk or log into the patient portal to view your results.`;

  const notification = await prisma.reportNotification.create({
    data: {
      reportId: report.id,
      channel: params.channel,
      recipientContact,
      messageBody,
      status: 'SENT',
      provider: 'LOCAL_DEMO_ADAPTER',
      sentById: userContext.userId || null,
    },
    include: {
      sentByUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Audit event
  await logAuditEvent({
    userId: userContext.userId || undefined,
    action: 'PATIENT_NOTIFICATION_SENT',
    entityType: 'ReportNotification',
    entityId: notification.id,
    details: {
      orderId: order.id,
      reportId: report.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      channel: params.channel,
      recipientContact,
      provider: 'LOCAL_DEMO_ADAPTER',
      version: report.version,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    notificationId: notification.id,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    channel: notification.channel,
    recipientContact: notification.recipientContact,
    messageBody: notification.messageBody,
    status: notification.status,
    provider: notification.provider,
    sentAt: notification.sentAt.toISOString(),
    sentBy: notification.sentByUser
      ? `${notification.sentByUser.firstName} ${notification.sentByUser.lastName}`.trim()
      : null,
  };
}

/**
 * Records a print / reprint event for a finalized report and returns PDF details.
 */
export async function recordReportReprint(
  orderId: string,
  params: {
    reason?: string;
    copiesCount?: number;
  },
  userContext: UserContext
) {
  if (!userContext.userId) {
    throw AppError.unauthorized('User ID required to record reprint event');
  }

  const order = await prisma.imagingOrder.findUnique({
    where: { id: orderId },
    include: { patient: true, report: true },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Order or report not found for ID: ${orderId}`);
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Cannot reprint report: Report is in status '${report.status}'. Only finalized reports can be printed.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const reprint = await prisma.reportReprint.create({
    data: {
      reportId: report.id,
      version: report.version,
      printedById: userContext.userId,
      reason: params.reason?.trim() || 'Patient physical copy request',
      copiesCount: params.copiesCount && params.copiesCount > 0 ? params.copiesCount : 1,
    },
    include: {
      printedByUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Also log delivery acknowledgment for physical print handover
  await prisma.reportDelivery.create({
    data: {
      reportId: report.id,
      version: report.version,
      deliveryMethod: ReportDeliveryMethod.PRINT,
      recipientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      recipientRole: 'PATIENT',
      deliveredById: userContext.userId,
      status: 'ACKNOWLEDGED',
      notes: `Printed ${reprint.copiesCount} copy(ies). Reason: ${reprint.reason}`,
    },
  });

  // Audit event
  await logAuditEvent({
    userId: userContext.userId,
    action: 'REPORT_REPRINTED',
    entityType: 'ReportReprint',
    entityId: reprint.id,
    details: {
      orderId: order.id,
      reportId: report.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      version: report.version,
      reason: reprint.reason,
      copiesCount: reprint.copiesCount,
    },
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  return {
    success: true,
    reprintId: reprint.id,
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    version: reprint.version,
    printedAt: reprint.printedAt.toISOString(),
    printedBy: `${reprint.printedByUser.firstName} ${reprint.printedByUser.lastName}`.trim(),
    reason: reprint.reason,
    copiesCount: reprint.copiesCount,
  };
}

/**
 * Returns complete delivery, notification, and reprint history for an order.
 */
export async function getReportDeliveryHistory(orderId: string) {
  const order = await prisma.imagingOrder.findUnique({
    where: { id: orderId },
    include: {
      patient: true,
      report: {
        include: {
          signedBy: { select: { id: true, firstName: true, lastName: true } },
          readyForReceptionBy: { select: { id: true, firstName: true, lastName: true } },
          deliveries: {
            orderBy: { deliveredAt: 'desc' },
            include: { deliveredByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
          notifications: {
            orderBy: { sentAt: 'desc' },
            include: { sentByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
          reprints: {
            orderBy: { printedAt: 'desc' },
            include: { printedByUser: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Order or report not found for ID: ${orderId}`);
  }

  const report = order.report;

  return {
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
    reportId: report.id,
    reportStatus: report.status,
    reportVersion: report.version,
    finalizedAt: report.finalizedAt?.toISOString() || null,
    signedAt: report.signedAt?.toISOString() || null,
    signedBy: report.signedBy ? `${report.signedBy.firstName} ${report.signedBy.lastName}`.trim() : null,
    isReadyForReception: report.isReadyForReception,
    readyForReceptionAt: report.readyForReceptionAt?.toISOString() || null,
    readyForReceptionBy: report.readyForReceptionBy
      ? `${report.readyForReceptionBy.firstName} ${report.readyForReceptionBy.lastName}`.trim()
      : null,
    deliveries: report.deliveries.map((d) => ({
      id: d.id,
      version: d.version,
      deliveryMethod: d.deliveryMethod,
      recipientName: d.recipientName,
      recipientRole: d.recipientRole,
      deliveredAt: d.deliveredAt.toISOString(),
      deliveredBy: d.deliveredByUser ? `${d.deliveredByUser.firstName} ${d.deliveredByUser.lastName}`.trim() : null,
      status: d.status,
      notes: d.notes,
    })),
    notifications: report.notifications.map((n) => ({
      id: n.id,
      channel: n.channel,
      recipientContact: n.recipientContact,
      messageBody: n.messageBody,
      status: n.status,
      provider: n.provider,
      sentAt: n.sentAt.toISOString(),
      sentBy: n.sentByUser ? `${n.sentByUser.firstName} ${n.sentByUser.lastName}`.trim() : null,
    })),
    reprints: report.reprints.map((r) => ({
      id: r.id,
      version: r.version,
      printedAt: r.printedAt.toISOString(),
      printedBy: `${r.printedByUser.firstName} ${r.printedByUser.lastName}`.trim(),
      reason: r.reason,
      copiesCount: r.copiesCount,
    })),
  };
}

/**
 * Calculates real TAT (Turnaround Time) metrics from database timestamps.
 */
export async function getTatDashboardMetrics() {
  const orders = await prisma.imagingOrder.findMany({
    include: {
      patient: true,
      appointment: true,
      scanLifecycles: {
        orderBy: { attemptNumber: 'desc' },
        take: 1,
      },
      report: {
        include: {
          signedBy: { select: { firstName: true, lastName: true } },
          deliveries: {
            orderBy: { deliveredAt: 'asc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const tatItems: any[] = [];
  let totalReportingTatMinutes = 0;
  let reportingTatCount = 0;
  let totalDeliveryTatMinutes = 0;
  let deliveryTatCount = 0;
  let totalEndToEndTatMinutes = 0;
  let endToEndCount = 0;

  for (const order of orders) {
    const scan = order.scanLifecycles[0];
    const report = order.report;
    const firstDelivery = report?.deliveries[0];

    const orderCreatedAt = order.createdAt;
    const scanStartedAt = scan?.startedAt || null;
    const scanCompletedAt = scan?.completedAt || null;
    const reportFinalizedAt = report?.finalizedAt || report?.signedAt || null;
    const readyForReceptionAt = report?.readyForReceptionAt || null;
    const deliveredAt = firstDelivery?.deliveredAt || null;

    // Reporting TAT: Scan completion -> Report finalization
    let reportingTatMinutes: number | null = null;
    if (scanCompletedAt && reportFinalizedAt) {
      reportingTatMinutes = Math.max(
        0,
        Math.round((reportFinalizedAt.getTime() - scanCompletedAt.getTime()) / 60000)
      );
      totalReportingTatMinutes += reportingTatMinutes;
      reportingTatCount++;
    }

    // Delivery TAT: Report finalization -> Delivery acknowledgment
    let deliveryTatMinutes: number | null = null;
    if (reportFinalizedAt && deliveredAt) {
      deliveryTatMinutes = Math.max(
        0,
        Math.round((deliveredAt.getTime() - reportFinalizedAt.getTime()) / 60000)
      );
      totalDeliveryTatMinutes += deliveryTatMinutes;
      deliveryTatCount++;
    }

    // End-to-End TAT: Order creation -> Delivery
    let endToEndTatMinutes: number | null = null;
    if (orderCreatedAt && deliveredAt) {
      endToEndTatMinutes = Math.max(
        0,
        Math.round((deliveredAt.getTime() - orderCreatedAt.getTime()) / 60000)
      );
      totalEndToEndTatMinutes += endToEndTatMinutes;
      endToEndCount++;
    }

    // Target SLA minutes: STAT = 120m (2h), URGENT = 360m (6h), ROUTINE = 1440m (24h)
    const targetSlaMinutes =
      order.priority === 'STAT' ? 120 : order.priority === 'URGENT' ? 360 : 1440;

    let slaStatus: 'ON_TARGET' | 'DELAYED' | 'IN_PROGRESS' = 'IN_PROGRESS';
    if (reportingTatMinutes !== null) {
      slaStatus = reportingTatMinutes <= targetSlaMinutes ? 'ON_TARGET' : 'DELAYED';
    } else if (scanCompletedAt) {
      const elapsedSinceScan = Math.round((Date.now() - scanCompletedAt.getTime()) / 60000);
      slaStatus = elapsedSinceScan > targetSlaMinutes ? 'DELAYED' : 'IN_PROGRESS';
    }

    tatItems.push({
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      modality: order.modality,
      examinationName: order.examinationName,
      priority: order.priority,
      targetSlaMinutes,
      slaStatus,
      timestamps: {
        orderCreatedAt: orderCreatedAt.toISOString(),
        scanStartedAt: scanStartedAt?.toISOString() || null,
        scanCompletedAt: scanCompletedAt?.toISOString() || null,
        reportFinalizedAt: reportFinalizedAt?.toISOString() || null,
        readyForReceptionAt: readyForReceptionAt?.toISOString() || null,
        deliveredAt: deliveredAt?.toISOString() || null,
      },
      turnaroundMinutes: {
        reportingTatMinutes,
        deliveryTatMinutes,
        endToEndTatMinutes,
      },
      reportStatus: report?.status || 'PENDING_SCAN',
      deliveryStatus: deliveredAt ? 'DELIVERED' : readyForReceptionAt ? 'READY' : 'PENDING',
    });
  }

  const avgReportingTatMinutes =
    reportingTatCount > 0 ? Math.round(totalReportingTatMinutes / reportingTatCount) : 0;
  const avgDeliveryTatMinutes =
    deliveryTatCount > 0 ? Math.round(totalDeliveryTatMinutes / deliveryTatCount) : 0;
  const avgEndToEndTatMinutes =
    endToEndCount > 0 ? Math.round(totalEndToEndTatMinutes / endToEndCount) : 0;

  return {
    summary: {
      totalOrdersTracked: orders.length,
      averageReportingTatMinutes: avgReportingTatMinutes,
      averageDeliveryTatMinutes: avgDeliveryTatMinutes,
      averageEndToEndTatMinutes: avgEndToEndTatMinutes,
      deliveredOrdersCount: deliveryTatCount,
      delayedCasesCount: tatItems.filter((i) => i.slaStatus === 'DELAYED').length,
      onTargetCasesCount: tatItems.filter((i) => i.slaStatus === 'ON_TARGET').length,
    },
    items: tatItems,
  };
}

/**
 * Authenticates a patient using Master Patient ID and Date of Birth (or phone).
 */
export async function loginPatient(params: { patientId: string; dateOfBirth: string }) {
  const normalizedPatientId = params.patientId.trim().toUpperCase();

  const patient = await prisma.patient.findUnique({
    where: { patientId: normalizedPatientId },
  });

  if (!patient || !patient.isActive) {
    throw AppError.unauthorized('Invalid Patient ID or Date of Birth credentials', 'INVALID_CREDENTIALS');
  }

  // Compare DOB (YYYY-MM-DD)
  const patientDobStr = patient.dateOfBirth.toISOString().split('T')[0];
  const inputDobStr = params.dateOfBirth.trim().split('T')[0];

  if (patientDobStr !== inputDobStr) {
    throw AppError.unauthorized('Invalid Patient ID or Date of Birth credentials', 'INVALID_CREDENTIALS');
  }

  const signOptions: SignOptions = { expiresIn: 14400 }; // 4 hours
  const token = jwt.sign(
    {
      patientId: patient.patientId,
      sub: patient.id,
      role: 'PATIENT',
    },
    env.JWT_SECRET,
    signOptions
  );

  await logAuditEvent({
    userId: undefined,
    action: 'PATIENT_LOGIN',
    entityType: 'Patient',
    entityId: patient.id,
    details: { patientId: patient.patientId, name: `${patient.firstName} ${patient.lastName}` },
  });

  return {
    token,
    patient: {
      id: patient.id,
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patientDobStr,
      phone: patient.phone,
      email: patient.email,
    },
  };
}

/**
 * Returns all finalized reports for the authenticated patient.
 */
export async function getPatientReports(patientId: string) {
  const orders = await prisma.imagingOrder.findMany({
    where: {
      patient: { patientId },
      report: {
        status: { in: [ReportStatus.FINAL, ReportStatus.ADDENDUM] },
      },
    },
    include: {
      study: true,
      referringDoctor: true,
      report: {
        include: {
          signedBy: { select: { firstName: true, lastName: true } },
          amendments: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((order) => {
    const report = order.report!;
    return {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId,
      modality: order.modality,
      examinationName: order.examinationName,
      priority: order.priority,
      referringDoctor: order.referringDoctor?.name || 'Self-referred',
      reportId: report.id,
      status: report.status,
      version: report.version,
      finalizedAt: report.finalizedAt?.toISOString(),
      signedBy: report.signedBy ? `${report.signedBy.firstName} ${report.signedBy.lastName}`.trim() : 'Attending Radiologist',
      hasPdf: !!report.pdfArtifactPath,
      pdfGeneratedAt: report.pdfGeneratedAt?.toISOString(),
      amendmentsCount: report.amendments.length,
    };
  });
}

/**
 * Streams the finalized report PDF for the authenticated patient, strictly preventing cross-patient access.
 */
export async function getPatientReportPdf(
  patientId: string,
  accessionNumber: string,
  userContext?: { ipAddress?: string; userAgent?: string }
) {
  const order = await prisma.imagingOrder.findUnique({
    where: { accessionNumber: accessionNumber.trim() },
    include: { patient: true, report: true },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Diagnostic report not found for Accession: ${accessionNumber}`);
  }

  // Cross-patient boundary enforcement: patient can ONLY access their own report!
  if (order.patient.patientId !== patientId) {
    throw AppError.forbidden(
      'Access denied. You cannot access reports belonging to another patient.',
      'CROSS_PATIENT_ACCESS_DENIED'
    );
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Report is in status '${report.status}'. Draft and unfinalized reports cannot be accessed via patient portal.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  // Retrieve PDF stream
  const pdfStream = await getReportPdfStream(order.id, {
    userId: order.patient.id,
    role: UserRole.RECEPTION, // Safe internal context for streamer
    ipAddress: userContext?.ipAddress,
    userAgent: userContext?.userAgent,
  });

  // Record delivery acknowledgment for portal access
  await prisma.reportDelivery.create({
    data: {
      reportId: report.id,
      version: report.version,
      deliveryMethod: ReportDeliveryMethod.PATIENT_PORTAL,
      recipientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      recipientRole: 'PATIENT',
      status: 'ACKNOWLEDGED',
      notes: 'Patient downloaded official finalized report PDF via patient portal',
    },
  });

  // Audit event
  await logAuditEvent({
    userId: undefined,
    action: 'PATIENT_PORTAL_ACCESSED',
    entityType: 'Report',
    entityId: report.id,
    details: {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId,
      version: report.version,
    },
    ipAddress: userContext?.ipAddress,
    userAgent: userContext?.userAgent,
  });

  return pdfStream;
}

/**
 * Authenticates a referring physician using Email and Medical Registration Number.
 */
export async function loginReferringDoctor(params: { email: string; registrationNumber?: string }) {
  const normalizedEmail = params.email.trim().toLowerCase();

  const doctor = await prisma.referringDoctor.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
    },
  });

  if (!doctor || !doctor.isActive) {
    throw AppError.unauthorized('Invalid referring physician credentials', 'INVALID_CREDENTIALS');
  }

  if (params.registrationNumber && doctor.registrationNumber) {
    if (doctor.registrationNumber.trim() !== params.registrationNumber.trim()) {
      throw AppError.unauthorized('Invalid medical registration number', 'INVALID_CREDENTIALS');
    }
  }

  const signOptions: SignOptions = { expiresIn: 14400 }; // 4 hours
  const token = jwt.sign(
    {
      doctorId: doctor.id,
      sub: doctor.id,
      role: 'REFERRING_DOCTOR',
    },
    env.JWT_SECRET,
    signOptions
  );

  await logAuditEvent({
    userId: undefined,
    action: 'REFERRING_DOCTOR_LOGIN',
    entityType: 'ReferringDoctor',
    entityId: doctor.id,
    details: { doctorId: doctor.id, name: doctor.name, email: doctor.email },
  });

  return {
    token,
    doctor: {
      id: doctor.id,
      name: doctor.name,
      organization: doctor.organization,
      phone: doctor.phone,
      email: doctor.email,
      registrationNumber: doctor.registrationNumber,
    },
  };
}

/**
 * Returns all finalized reports authorized for the referring physician.
 */
export async function getReferringDoctorReports(doctorId: string) {
  const orders = await prisma.imagingOrder.findMany({
    where: {
      referringDoctorId: doctorId,
      report: {
        status: { in: [ReportStatus.FINAL, ReportStatus.ADDENDUM] },
      },
    },
    include: {
      patient: true,
      study: true,
      report: {
        include: {
          signedBy: { select: { firstName: true, lastName: true } },
          amendments: { orderBy: { versionNumber: 'desc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((order) => {
    const report = order.report!;
    return {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      dateOfBirth: order.patient.dateOfBirth.toISOString().split('T')[0],
      gender: order.patient.gender,
      modality: order.modality,
      examinationName: order.examinationName,
      priority: order.priority,
      reportId: report.id,
      status: report.status,
      version: report.version,
      finalizedAt: report.finalizedAt?.toISOString(),
      signedBy: report.signedBy ? `${report.signedBy.firstName} ${report.signedBy.lastName}`.trim() : 'Attending Radiologist',
      hasPdf: !!report.pdfArtifactPath,
      pdfGeneratedAt: report.pdfGeneratedAt?.toISOString(),
    };
  });
}

/**
 * Streams the finalized report PDF for the referring physician, strictly preventing unauthorized doctor access.
 */
export async function getReferringDoctorReportPdf(
  doctorId: string,
  accessionNumber: string,
  userContext?: { ipAddress?: string; userAgent?: string }
) {
  const order = await prisma.imagingOrder.findUnique({
    where: { accessionNumber: accessionNumber.trim() },
    include: { patient: true, referringDoctor: true, report: true },
  });

  if (!order || !order.report) {
    throw AppError.notFound(`Diagnostic report not found for Accession: ${accessionNumber}`);
  }

  // Referring doctor authorization check
  if (order.referringDoctorId !== doctorId) {
    throw AppError.forbidden(
      'Access denied. You are not the authorized referring physician for this examination.',
      'UNAUTHORIZED_REFERRING_DOCTOR'
    );
  }

  const report = order.report;
  if (report.status !== ReportStatus.FINAL && report.status !== ReportStatus.ADDENDUM) {
    throw AppError.conflict(
      `Report is in status '${report.status}'. Draft and unfinalized reports cannot be accessed.`,
      'REPORT_NOT_FINALIZED'
    );
  }

  const doctor = order.referringDoctor!;

  // Retrieve PDF stream
  const pdfStream = await getReportPdfStream(order.id, {
    userId: doctor.id,
    role: UserRole.RADIOLOGIST, // Safe internal context for streamer
    ipAddress: userContext?.ipAddress,
    userAgent: userContext?.userAgent,
  });

  // Record delivery acknowledgment for referring doctor access
  await prisma.reportDelivery.create({
    data: {
      reportId: report.id,
      version: report.version,
      deliveryMethod: ReportDeliveryMethod.REFERRING_PHYSICIAN,
      recipientName: doctor.name,
      recipientRole: 'REFERRING_PHYSICIAN',
      status: 'ACKNOWLEDGED',
      notes: `Referring physician ${doctor.name} retrieved official finalized PDF`,
    },
  });

  // Audit event
  await logAuditEvent({
    userId: undefined,
    action: 'REFERRING_DOCTOR_ACCESSED',
    entityType: 'Report',
    entityId: report.id,
    details: {
      orderId: order.id,
      accessionNumber: order.accessionNumber,
      doctorId,
      doctorName: doctor.name,
      version: report.version,
    },
    ipAddress: userContext?.ipAddress,
    userAgent: userContext?.userAgent,
  });

  return pdfStream;
}

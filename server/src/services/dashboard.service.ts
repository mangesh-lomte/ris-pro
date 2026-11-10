import { prisma } from '../config/db';
import {
  UserRole,
  ModalityType,
  Priority,
  OrderStatus,
  AppointmentStatus,
  ScanState,
  ReportStatus,
  CriticalFindingStatus,
  EquipmentStatus,
  PaymentStatus,
} from '@prisma/client';
import { getPacsGateway } from '../integrations/pacs';
import { env } from '../config/env';
import { getHospitalDayBounds } from '../utils/hospitalTime';

export interface TodayOverviewData {
  totalBookings: number;
  completedScans: number;
  pendingReports: number;
  totalRevenue: number;
  acquisitionBacklog: number;
  finalizedReportsToday: number;
}

export interface LivePatientStatusData {
  breakdown: {
    booked: number;
    arrived: number;
    waiting: number;
    scanning: number;
    reporting: number;
    delivered: number;
  };
  activePatients: Array<{
    id: string;
    databasePatientId: string;
    patientId: string;
    patientName: string;
    accessionNumber: string;
    modality: ModalityType;
    examinationName: string;
    priority: Priority;
    status: string;
    stage: 'BOOKED' | 'ARRIVED' | 'WAITING' | 'SCANNING' | 'REPORTING' | 'DELIVERED';
    timeAgoMinutes: number;
  }>;
}

export interface ModalityStatusTile {
  modality: ModalityType;
  name: string;
  totalScanners: number;
  operationalScanners: number;
  status: 'OPERATIONAL' | 'BUSY' | 'MAINTENANCE' | 'OFFLINE';
  todayScheduledCount: number;
  currentlyScanningCount: number;
  utilizationPercent: number;
}

export interface PendingTaskAlert {
  id: string;
  type: 'URGENT_SCAN' | 'UNSIGNED_REPORT' | 'DELAYED_APPOINTMENT' | 'CRITICAL_FINDING';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  accessionNumber?: string;
  patientId?: string;
  orderId?: string;
  targetUrl: string;
  timestamp: string;
}

export interface DailyAnalyticsData {
  scanVolumeToday: number;
  averageReportingTatMinutes: number;
  averageDeliveryTatMinutes: number;
  noShowCountToday: number;
  cancelledCountToday: number;
  completionRatePercent: number;
}

export interface DashboardNotificationItem {
  id: string;
  channel: string;
  type: 'CRITICAL_FINDING' | 'APPOINTMENT_CHANGE' | 'SYSTEM_STATUS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardOverviewResponse {
  todayOverview: TodayOverviewData;
  livePatientStatus: LivePatientStatusData;
  modalityTiles: ModalityStatusTile[];
  pendingTaskAlerts: PendingTaskAlert[];
  dailyAnalytics: DailyAnalyticsData;
  notifications: DashboardNotificationItem[];
  roleCapabilities: {
    role: UserRole;
    allowedActions: string[];
  };
}

export interface SearchResultItem {
  type: 'PATIENT' | 'ORDER';
  patientId: string;
  patientName: string;
  phone?: string;
  accessionNumber?: string;
  examinationName?: string;
  modality?: ModalityType;
  status: string;
  targetUrl: string;
}

/**
 * Returns complete today overview, role-based metrics, live pipeline, modality tiles,
 * pending alerts, daily analytics, and system notifications.
 */
export function calculateCapacityUtilization(scheduledMinutes: number, operationalScanners: number): number {
  // Dashboard operating window is 08:00–18:00: 600 available minutes per operational scanner.
  if (operationalScanners <= 0 || scheduledMinutes <= 0) return 0;
  return Math.min(100, Math.round((scheduledMinutes / (operationalScanners * 600)) * 100));
}

export function getDashboardAlertTarget(userRole: UserRole, type: PendingTaskAlert['type'], accessionNumber?: string) {
  if (type === 'URGENT_SCAN') {
    if (userRole === UserRole.TECHNOLOGIST || userRole === UserRole.ADMIN) return '/technologist/worklist';
    if (userRole === UserRole.RADIOLOGIST) return '/radiologist/worklist';
    return '/reception';
  }
  if (type === 'DELAYED_APPOINTMENT') {
    if (userRole === UserRole.RECEPTION || userRole === UserRole.ADMIN) return '/reception';
    if (userRole === UserRole.TECHNOLOGIST) return '/technologist/worklist';
  }
  if ((type === 'UNSIGNED_REPORT' || type === 'CRITICAL_FINDING') &&
      (userRole === UserRole.RADIOLOGIST || userRole === UserRole.ADMIN)) {
    return '/radiologist/worklist';
  }
  return accessionNumber ? `/orders?search=${encodeURIComponent(accessionNumber)}` : '/orders';
}

function averageMinutes(intervals: Array<{ start: Date | null; end: Date | null }>): number {
  const valid = intervals
    .filter((item): item is { start: Date; end: Date } => Boolean(item.start && item.end && item.end >= item.start))
    .map((item) => (item.end.getTime() - item.start.getTime()) / 60000);
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

export async function getDashboardOverview(userRole: UserRole): Promise<DashboardOverviewResponse> {
  const now = new Date();
  const { start, end } = getHospitalDayBounds(now);
  const todayRange = { gte: start, lt: end };

  const [
    appointmentsToday,
    completedScans,
    pendingReportsCount,
    paymentsToday,
    finalizedReportsToday,
    deliveriesToday,
    cancelledAppointments,
    noShows,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { scheduledStart: todayRange },
      include: { patient: true, imagingOrder: true },
    }),
    prisma.scanLifecycle.findMany({
      where: { state: ScanState.COMPLETED, completedAt: todayRange },
      select: { imagingOrderId: true, completedAt: true },
    }),
    prisma.report.count({ where: { status: { in: [ReportStatus.DRAFT, ReportStatus.PRELIMINARY] } } }),
    prisma.payment.findMany({
      where: { paymentStatus: PaymentStatus.COMPLETED, paidAt: todayRange },
      select: { amount: true },
    }),
    prisma.report.findMany({
      where: {
        status: ReportStatus.FINAL,
        OR: [{ finalizedAt: todayRange }, { signedAt: todayRange }],
      },
      include: {
        order: {
          include: {
            scanLifecycles: {
              where: { completedAt: { not: null } },
              orderBy: { completedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.reportDelivery.findMany({
      where: { deliveredAt: todayRange },
      include: { report: true },
    }),
    prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: todayRange,
      },
      include: { patient: true },
      orderBy: { cancelledAt: 'desc' },
    }),
    prisma.appointment.count({
      where: { status: AppointmentStatus.NO_SHOW, updatedAt: todayRange },
    }),
  ]);

  const totalBookings = appointmentsToday.length;
  const completedScansCount = completedScans.length;
  const totalRevenue = paymentsToday.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const finalizedReportsCount = finalizedReportsToday.length;

  const acquisitionStatuses: OrderStatus[] = [
    OrderStatus.ARRIVED,
    OrderStatus.READY_FOR_TECH,
    OrderStatus.SAFETY_REVIEW,
    OrderStatus.SAFETY_CLEARED,
    OrderStatus.PREPARATION_IN_PROGRESS,
    OrderStatus.PREPARED,
    OrderStatus.READY_FOR_SCAN,
    OrderStatus.SCAN_IN_PROGRESS,
    OrderStatus.SCAN_INTERRUPTED,
    OrderStatus.REPEAT_REQUIRED,
    OrderStatus.IMAGE_QA_PENDING,
    OrderStatus.IMAGE_REJECTED,
  ];
  const acquisitionBacklog = await prisma.imagingOrder.count({
    where: { orderStatus: { in: acquisitionStatuses } },
  });

  const currentOrders = await prisma.imagingOrder.findMany({
    where: {
      OR: [
        { appointment: { scheduledStart: todayRange } },
        { appointment: { checkedInAt: todayRange } },
        { scanLifecycles: { some: { updatedAt: todayRange } } },
        { orderStatus: OrderStatus.SCAN_IN_PROGRESS },
        {
          orderStatus: {
            in: [
              OrderStatus.READY_FOR_TECH,
              OrderStatus.SAFETY_REVIEW,
              OrderStatus.SAFETY_CLEARED,
              OrderStatus.PREPARATION_IN_PROGRESS,
              OrderStatus.PREPARED,
              OrderStatus.READY_FOR_SCAN,
              OrderStatus.SCAN_INTERRUPTED,
              OrderStatus.REPEAT_REQUIRED,
            ],
          },
          updatedAt: todayRange,
        },
        {
          orderStatus: {
            in: [
              OrderStatus.SCAN_COMPLETED,
              OrderStatus.IMAGE_QA_PENDING,
              OrderStatus.IMAGE_ACCEPTED,
              OrderStatus.PACS_READY,
              OrderStatus.PACS_HANDOFF_PENDING,
              OrderStatus.PACS_HANDOFF_FAILED,
            ],
          },
          OR: [
            { updatedAt: todayRange },
            { report: { is: { status: { in: [ReportStatus.DRAFT, ReportStatus.PRELIMINARY] } } } },
          ],
        },
        { report: { is: { deliveries: { some: { deliveredAt: todayRange } } } } },
      ],
      NOT: [
        { orderStatus: { in: [OrderStatus.CANCELLED, OrderStatus.SCAN_CANCELLED] } },
        { appointment: { is: { status: AppointmentStatus.CANCELLED } } },
      ],
    },
    include: {
      patient: true,
      appointment: true,
      report: { include: { deliveries: { orderBy: { deliveredAt: 'desc' }, take: 1 } } },
      scanLifecycles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        include: { events: { orderBy: { timestamp: 'desc' }, take: 1 } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const breakdown = { booked: 0, arrived: 0, waiting: 0, scanning: 0, reporting: 0, delivered: 0 };
  const activePatients: LivePatientStatusData['activePatients'] = [];

  for (const order of currentOrders) {
    const latestScan = order.scanLifecycles[0];
    const latestDelivery = order.report?.deliveries[0];
    const deliveredToday = Boolean(latestDelivery && latestDelivery.deliveredAt >= start && latestDelivery.deliveredAt < end);
    let stage: LivePatientStatusData['activePatients'][0]['stage'];

    if (deliveredToday || order.orderStatus === OrderStatus.COMPLETED) stage = 'DELIVERED';
    else if (order.report || ([OrderStatus.SCAN_COMPLETED, OrderStatus.IMAGE_QA_PENDING, OrderStatus.IMAGE_ACCEPTED, OrderStatus.PACS_READY, OrderStatus.PACS_HANDOFF_PENDING, OrderStatus.PACS_HANDOFF_FAILED] as OrderStatus[]).includes(order.orderStatus)) stage = 'REPORTING';
    else if (latestScan?.state === ScanState.IN_PROGRESS || order.orderStatus === OrderStatus.SCAN_IN_PROGRESS) stage = 'SCANNING';
    else if (order.appointment?.status === AppointmentStatus.CHECKED_IN || ([OrderStatus.READY_FOR_TECH, OrderStatus.SAFETY_REVIEW, OrderStatus.SAFETY_CLEARED, OrderStatus.PREPARATION_IN_PROGRESS, OrderStatus.PREPARED, OrderStatus.READY_FOR_SCAN, OrderStatus.SCAN_INTERRUPTED, OrderStatus.REPEAT_REQUIRED, OrderStatus.IMAGE_REJECTED] as OrderStatus[]).includes(order.orderStatus)) stage = 'WAITING';
    else if (order.orderStatus === OrderStatus.ARRIVED || order.appointment?.status === AppointmentStatus.ARRIVED) stage = 'ARRIVED';
    else stage = 'BOOKED';

    breakdown[stage.toLowerCase() as keyof typeof breakdown]++;
    if (activePatients.length < 10) {
      let stageTransition: Date;
      switch (stage) {
        case 'DELIVERED':
          stageTransition = latestDelivery?.deliveredAt || order.updatedAt;
          break;
        case 'REPORTING':
          stageTransition = order.report?.updatedAt || latestScan?.completedAt || order.updatedAt;
          break;
        case 'SCANNING':
          stageTransition = latestScan?.startedAt || latestScan?.updatedAt || order.updatedAt;
          break;
        case 'WAITING':
          stageTransition = order.appointment?.checkedInAt || order.updatedAt;
          break;
        case 'ARRIVED':
          stageTransition = order.appointment?.checkedInAt || order.appointment?.updatedAt || order.updatedAt;
          break;
        case 'BOOKED':
        default:
          stageTransition = order.appointment?.scheduledStart || order.createdAt;
          break;
      }
      activePatients.push({
        id: order.id,
        databasePatientId: order.patient.id,
        patientId: order.patient.patientId,
        patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
        accessionNumber: order.accessionNumber,
        modality: order.modality,
        examinationName: order.examinationName,
        priority: order.priority,
        status: order.orderStatus,
        stage,
        timeAgoMinutes: Math.max(0, Math.floor((now.getTime() - stageTransition.getTime()) / 60000)),
      });
    }
  }

  const equipmentRecords = await prisma.equipment.findMany({
    where: { active: true, assetCategory: 'SCANNER' },
  });
  const modalityTypes: ModalityType[] = [ModalityType.CT, ModalityType.MRI, ModalityType.XRAY];
  const modalityTiles: ModalityStatusTile[] = modalityTypes.map((modality) => {
    const equipment = equipmentRecords.filter((item) => item.modality === modality);
    const operational = equipment.filter((item) =>
      ([EquipmentStatus.AVAILABLE, EquipmentStatus.OPERATIONAL, EquipmentStatus.BUSY] as EquipmentStatus[]).includes(item.status)
    );
    const appointments = appointmentsToday.filter((item) => item.modality === modality);
    const scheduledMinutes = appointments
      .filter((item) => !([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] as AppointmentStatus[]).includes(item.status))
      .reduce((sum, item) => sum + item.durationMinutes, 0);
    const currentlyScanning = currentOrders.filter((item) =>
      item.modality === modality &&
      (item.orderStatus === OrderStatus.SCAN_IN_PROGRESS || item.scanLifecycles[0]?.state === ScanState.IN_PROGRESS)
    ).length;

    return {
      modality,
      name: modality === ModalityType.CT ? 'Computed Tomography (CT)' : modality === ModalityType.MRI ? 'Magnetic Resonance (MRI)' : 'Digital Radiography (X-Ray)',
      totalScanners: equipment.length,
      operationalScanners: operational.length,
      status: equipment.length === 0 ? 'OFFLINE' : operational.length === 0 ? 'MAINTENANCE' : currentlyScanning > 0 ? 'BUSY' : 'OPERATIONAL',
      todayScheduledCount: appointments.length,
      currentlyScanningCount: currentlyScanning,
      utilizationPercent: calculateCapacityUtilization(scheduledMinutes, operational.length),
    };
  });

  const pendingTaskAlerts: PendingTaskAlert[] = [];
  const urgentOrders = currentOrders.filter((order) => order.priority === Priority.STAT || order.priority === Priority.URGENT);
  for (const order of urgentOrders.slice(0, 3)) {
    pendingTaskAlerts.push({
      id: `urgent-${order.id}`,
      type: 'URGENT_SCAN',
      severity: order.priority === Priority.STAT ? 'CRITICAL' : 'WARNING',
      title: `${order.priority} Scan Acquisition Required`,
      description: `${order.patient.firstName} ${order.patient.lastName} — ${order.examinationName} (${order.accessionNumber}) awaiting immediate processing.`,
      accessionNumber: order.accessionNumber,
      patientId: order.patient.patientId,
      orderId: order.id,
      targetUrl: getDashboardAlertTarget(userRole, 'URGENT_SCAN', order.accessionNumber),
      timestamp: order.updatedAt.toISOString(),
    });
  }

  const delayedBefore = new Date(now.getTime() - env.DASHBOARD_DELAYED_PATIENT_MINUTES * 60000);
  const delayedAppointments = await prisma.appointment.findMany({
    where: {
      scheduledStart: { gte: start, lt: delayedBefore < end ? delayedBefore : end },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      checkedInAt: null,
    },
    include: { patient: true, imagingOrder: true },
    orderBy: { scheduledStart: 'asc' },
    take: 3,
  });
  for (const appointment of delayedAppointments) {
    const accession = appointment.imagingOrder?.accessionNumber;
    pendingTaskAlerts.push({
      id: `delayed-${appointment.id}`,
      type: 'DELAYED_APPOINTMENT',
      severity: 'WARNING',
      title: 'Scheduled Patient Has Not Arrived',
      description: `${appointment.patient.firstName} ${appointment.patient.lastName} is more than ${env.DASHBOARD_DELAYED_PATIENT_MINUTES} minutes past the scheduled arrival time.`,
      accessionNumber: accession,
      patientId: appointment.patient.patientId,
      orderId: appointment.imagingOrderId || undefined,
      targetUrl: getDashboardAlertTarget(userRole, 'DELAYED_APPOINTMENT', accession),
      timestamp: appointment.scheduledStart.toISOString(),
    });
  }

  // Delayed waiting queue alert (>30m since arrival check-in without scan dispatch)
  const delayedWaitingThreshold = new Date(now.getTime() - 30 * 60000);
  const delayedWaitingAppts = await prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.CHECKED_IN,
      checkedInAt: { gte: start, lt: delayedWaitingThreshold },
      imagingOrder: {
        orderStatus: { in: [OrderStatus.READY_FOR_TECH, OrderStatus.SAFETY_REVIEW, OrderStatus.PREPARATION_IN_PROGRESS] },
      },
    },
    include: { patient: true, imagingOrder: true },
    orderBy: { checkedInAt: 'asc' },
    take: 2,
  });
  for (const appt of delayedWaitingAppts) {
    const accession = appt.imagingOrder?.accessionNumber;
    pendingTaskAlerts.push({
      id: `delayed-waiting-${appt.id}`,
      type: 'DELAYED_APPOINTMENT',
      severity: 'WARNING',
      title: 'Waiting Room Delay (>30m)',
      description: `${appt.patient.firstName} ${appt.patient.lastName} (${appt.tokenNumber || appt.modality}) has been waiting over 30 minutes for scanner dispatch.`,
      accessionNumber: accession,
      patientId: appt.patient.patientId,
      orderId: appt.imagingOrderId || undefined,
      targetUrl: getDashboardAlertTarget(userRole, 'DELAYED_APPOINTMENT', accession),
      timestamp: (appt.checkedInAt || appt.scheduledStart).toISOString(),
    });
  }

  const unsignedReports = await prisma.report.findMany({
    where: { isSigned: false, status: { in: [ReportStatus.DRAFT, ReportStatus.PRELIMINARY] } },
    include: { order: { include: { patient: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 3,
  });
  for (const report of unsignedReports) {
    pendingTaskAlerts.push({
      id: `unsigned-${report.id}`,
      type: 'UNSIGNED_REPORT',
      severity: 'WARNING',
      title: 'Diagnostic Report Awaiting Final Sign & Lock',
      description: `Accession ${report.order.accessionNumber} (${report.order.examinationName}) is in draft and requires radiologist attestation.`,
      accessionNumber: report.order.accessionNumber,
      patientId: report.order.patient.patientId,
      orderId: report.order.id,
      targetUrl: getDashboardAlertTarget(userRole, 'UNSIGNED_REPORT', report.order.accessionNumber),
      timestamp: report.updatedAt.toISOString(),
    });
  }

  const openCriticalFindings = await prisma.criticalFinding.findMany({
    where: { status: CriticalFindingStatus.PENDING },
    include: { imagingOrder: { include: { patient: true } } },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  for (const finding of openCriticalFindings) {
    pendingTaskAlerts.push({
      id: `cf-${finding.id}`,
      type: 'CRITICAL_FINDING',
      severity: 'CRITICAL',
      title: `Critical Finding: ${finding.findingText.slice(0, 30)}...`,
      description: `${finding.imagingOrder.patient.firstName} ${finding.imagingOrder.patient.lastName} — Urgent notification sent; awaiting clinician acknowledgment.`,
      accessionNumber: finding.imagingOrder.accessionNumber,
      patientId: finding.imagingOrder.patient.patientId,
      orderId: finding.imagingOrder.id,
      targetUrl: getDashboardAlertTarget(userRole, 'CRITICAL_FINDING', finding.imagingOrder.accessionNumber),
      timestamp: finding.createdAt.toISOString(),
    });
  }

  const reportingTat = averageMinutes(finalizedReportsToday.map((report) => ({
    start: report.order.scanLifecycles[0]?.completedAt || null,
    end: report.finalizedAt || report.signedAt,
  })));
  const deliveryTat = averageMinutes(deliveriesToday.map((delivery) => ({
    start: delivery.report.finalizedAt || delivery.report.signedAt,
    end: delivery.deliveredAt,
  })));
  const completionRate = totalBookings > 0 ? Math.min(100, Math.round((completedScansCount / totalBookings) * 100)) : 0;
  const dailyAnalytics: DailyAnalyticsData = {
    scanVolumeToday: completedScansCount,
    averageReportingTatMinutes: reportingTat,
    averageDeliveryTatMinutes: deliveryTat,
    noShowCountToday: noShows,
    cancelledCountToday: cancelledAppointments.length,
    completionRatePercent: completionRate,
  };

  const notifications: DashboardNotificationItem[] = [];
  for (const finding of openCriticalFindings) {
    notifications.push({
      id: `notif-cf-${finding.id}`,
      channel: 'IN_APP',
      type: 'CRITICAL_FINDING',
      severity: 'CRITICAL',
      title: 'Critical Red Alert',
      message: `${finding.imagingOrder.patient.firstName} ${finding.imagingOrder.patient.lastName} (${finding.imagingOrder.accessionNumber}): ${finding.findingText}`,
      timestamp: finding.createdAt.toISOString(),
      metadata: { accessionNumber: finding.imagingOrder.accessionNumber },
    });
  }

  if (cancelledAppointments.length > 0) {
    const latestCancelled = cancelledAppointments[0];
    notifications.push({
      id: 'notif-appt-cancelled-summary',
      channel: 'IN_APP',
      type: 'APPOINTMENT_CHANGE',
      severity: 'INFO',
      title: 'Appointment Status Change',
      message: `${cancelledAppointments.length} appointment(s) cancelled today. Latest: ${latestCancelled.patient.firstName} ${latestCancelled.patient.lastName} — ${latestCancelled.examination} (${latestCancelled.appointmentNumber}). Slot released.`,
      timestamp: (latestCancelled.cancelledAt || latestCancelled.updatedAt).toISOString(),
      metadata: {
        cancelledCountToday: cancelledAppointments.length,
        latestAppointmentNumber: latestCancelled.appointmentNumber,
      },
    });
  }

  // System status notification
  const pacsGateway = getPacsGateway();
  const pacsCaps = await pacsGateway.getCapabilities();
  const pacsHealth = await pacsGateway.checkHealth();
  notifications.push({
    id: 'notif-pacs-status',
    channel: 'SYSTEM',
    type: 'SYSTEM_STATUS',
    severity: pacsHealth.connected ? 'INFO' : 'WARNING',
    title: `PACS Connectivity: ${pacsCaps.adapter.toUpperCase()}`,
    message: pacsHealth.connected
      ? `PACS DICOM-Web archive connected and operational (${pacsHealth.serverName || 'Orthanc'}).`
      : 'PACS service temporarily unavailable. Examination metadata preserved in PostgreSQL.',
    timestamp: now.toISOString(),
  });

  // 7. Role-specific capabilities
  const roleCapabilitiesMap: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: ['NEW_PATIENT', 'BOOK_SCAN', 'COLLECT_PAYMENT', 'OPEN_WORKLIST', 'MANAGE_USERS', 'VIEW_ANALYTICS', 'SYSTEM_HEALTH'],
    [UserRole.RECEPTION]: ['NEW_PATIENT', 'BOOK_SCAN', 'COLLECT_PAYMENT', 'OPEN_WORKLIST', 'REPORT_HANDOVER', 'PATIENT_PORTAL'],
    [UserRole.TECHNOLOGIST]: ['OPEN_WORKLIST', 'START_SCAN', 'IMAGE_QUALITY', 'PACS_HANDOFF', 'EQUIPMENT_STATUS'],
    [UserRole.RADIOLOGIST]: ['OPEN_WORKLIST', 'VIEW_IMAGES', 'DICTATE_REPORT', 'SIGN_LOCK_REPORT', 'CRITICAL_FINDINGS'],
    [UserRole.ENGINEER]: ['EQUIPMENT_REGISTER', 'PM_SCHEDULES', 'QC_CHECKS', 'SERVICE_TICKETS', 'MACHINE_DOWNTIME', 'PARTS_INVENTORY', 'CALIBRATION_CERTS'],
  };

  return {
    todayOverview: {
      totalBookings,
      completedScans: completedScansCount,
      pendingReports: pendingReportsCount,
      totalRevenue,
      acquisitionBacklog,
      finalizedReportsToday: finalizedReportsCount,
    },
    livePatientStatus: {
      breakdown,
      activePatients,
    },
    modalityTiles,
    pendingTaskAlerts,
    dailyAnalytics,
    notifications,
    roleCapabilities: {
      role: userRole,
      allowedActions: roleCapabilitiesMap[userRole] || ['OPEN_WORKLIST'],
    },
  };
}

/**
 * Global search across patients and orders by name, phone, patientId, and accessionNumber.
 */
export async function searchDashboard(query: string, userRole: UserRole): Promise<SearchResultItem[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const results: SearchResultItem[] = [];

  // Search Patients by Name, Phone, or Patient ID
  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { patientId: { contains: normalizedQuery, mode: 'insensitive' } },
        { firstName: { contains: normalizedQuery, mode: 'insensitive' } },
        { lastName: { contains: normalizedQuery, mode: 'insensitive' } },
        { phone: { contains: normalizedQuery } },
      ],
    },
    take: 5,
    include: { imagingOrders: { take: 1, orderBy: { createdAt: 'desc' } } },
  });

  for (const p of patients) {
    const latestOrder = p.imagingOrders[0];
    results.push({
      type: 'PATIENT',
      patientId: p.patientId,
      patientName: `${p.firstName} ${p.lastName}`.trim(),
      phone: p.phone,
      accessionNumber: latestOrder?.accessionNumber,
      examinationName: latestOrder?.examinationName,
      modality: latestOrder?.modality,
      status: latestOrder?.orderStatus || 'REGISTERED',
      targetUrl: `/patients/${p.id}`,
    });
  }

  // Search Orders by Accession Number
  const orders = await prisma.imagingOrder.findMany({
    where: {
      accessionNumber: { contains: normalizedQuery, mode: 'insensitive' },
    },
    take: 5,
    include: { patient: true },
  });

  for (const o of orders) {
    // Avoid duplicate if already matched by patient
    if (!results.some((r) => r.accessionNumber === o.accessionNumber)) {
      results.push({
        type: 'ORDER',
        patientId: o.patient.patientId,
        patientName: `${o.patient.firstName} ${o.patient.lastName}`.trim(),
        phone: o.patient.phone,
        accessionNumber: o.accessionNumber,
        examinationName: o.examinationName,
        modality: o.modality,
        status: o.orderStatus,
        targetUrl: userRole === UserRole.RADIOLOGIST ? '/radiologist/worklist' : userRole === UserRole.TECHNOLOGIST ? '/technologist/worklist' : `/orders`,
      });
    }
  }

  return results;
}

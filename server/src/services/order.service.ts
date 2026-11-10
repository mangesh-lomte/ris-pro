import { prisma } from '../config/db';
import { generateUniqueAccessionNumber, generateUniquePatientId } from '../utils/identifierGenerator';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  ModalityType,
  OrderStatus,
  Priority,
  AuthorizationStatus,
  PayerType,
  Prisma,
} from '@prisma/client';

export interface HisOrderImportPayload {
  externalSystem: string;
  externalOrderId: string;
  patient: {
    mrn?: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone: string;
    email?: string;
    address?: string;
  };
  order: {
    modality: ModalityType;
    bodyPart: string;
    examinationName: string;
    clinicalIndication: string;
    priority?: Priority;
    contrastRequired?: boolean;
    referringDoctorName?: string;
    referringDoctorHospital?: string;
    insuranceNotes?: string;
    authorizationCode?: string;
  };
}

export interface CreateOrderInput {
  patientId: string;
  modality: ModalityType;
  bodyPart: string;
  examinationName: string;
  clinicalIndication: string;
  referringDoctorId?: string;
  referringDoctorText?: string;
  contrastRequired?: boolean;
  priority?: Priority;
  payerType?: PayerType;
  payerName?: string;
  memberId?: string;
  authorizationRequired?: boolean;
  authorizationStatus?: AuthorizationStatus;
  authorizationCode?: string;
  insuranceNotes?: string;
}

export interface UpdateOrderInput {
  bodyPart?: string;
  examinationName?: string;
  clinicalIndication?: string;
  referringDoctorId?: string;
  referringDoctorText?: string;
  contrastRequired?: boolean;
  priority?: Priority;
  orderStatus?: OrderStatus;
  payerType?: PayerType;
  payerName?: string;
  memberId?: string;
  authorizationRequired?: boolean;
  authorizationStatus?: AuthorizationStatus;
  authorizationCode?: string;
  insuranceNotes?: string;
}

export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  patientId?: string;
  accessionNumber?: string;
  modality?: ModalityType;
  priority?: Priority;
  status?: OrderStatus;
  orderStatus?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

export async function createOrder(
  input: CreateOrderInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  // 1. Verify patient exists and is active
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: input.patientId }, { patientId: input.patientId }],
    },
  });

  if (!patient) {
    throw AppError.notFound(`Patient not found with identifier: ${input.patientId}`);
  }

  if (!patient.isActive) {
    throw AppError.badRequest('Cannot create imaging orders for a deactivated patient record');
  }

  // 2. Verify referring doctor if provided
  if (input.referringDoctorId) {
    const doc = await prisma.referringDoctor.findUnique({
      where: { id: input.referringDoctorId },
    });
    if (!doc) {
      throw AppError.badRequest(`Referring doctor with ID ${input.referringDoctorId} not found`);
    }
  }

  // 3. Database transaction generating collision-safe Accession Number
  return prisma.$transaction(async (tx) => {
    const accessionNumber = await generateUniqueAccessionNumber(tx, input.modality);

    const order = await tx.imagingOrder.create({
      data: {
        accessionNumber,
        patientId: patient.id,
        modality: input.modality,
        bodyPart: input.bodyPart.trim(),
        examinationName: input.examinationName.trim(),
        clinicalIndication: input.clinicalIndication.trim(),
        referringDoctorId: input.referringDoctorId || null,
        referringDoctorText: input.referringDoctorText?.trim() || null,
        contrastRequired: input.contrastRequired || false,
        priority: input.priority || Priority.ROUTINE,
        orderStatus: OrderStatus.CREATED,
        payerType: input.payerType || PayerType.SELF_PAY,
        payerName: input.payerName?.trim() || null,
        memberId: input.memberId?.trim() || null,
        authorizationRequired: input.authorizationRequired || false,
        authorizationStatus: input.authorizationStatus || AuthorizationStatus.NOT_REQUIRED,
        authorizationCode: input.authorizationCode?.trim() || null,
        insuranceNotes: input.insuranceNotes?.trim() || null,
        createdById: context?.userId || null,
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
            phone: true,
          },
        },
        referringDoctor: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'ORDER_CREATED',
      entityType: 'ImagingOrder',
      entityId: order.accessionNumber,
      details: {
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        modality: order.modality,
        examination: order.examinationName,
        priority: order.priority,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return order;
  });
}

export async function getOrderById(id: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id }, { accessionNumber: id }],
    },
    include: {
      patient: true,
      referringDoctor: true,
      appointment: {
        include: {
          equipment: true,
          examDefinition: true,
        },
      },
      study: true,
      report: true,
      invoice: {
        include: {
          payments: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found with ID/Accession: ${id}`);
  }

  return order;
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id }, { accessionNumber: id }] },
  });

  if (!existing) {
    throw AppError.notFound(`Imaging order not found with ID/Accession: ${id}`);
  }

  if (existing.orderStatus === OrderStatus.COMPLETED) {
    throw AppError.badRequest('Cannot modify an imaging order that is already completed');
  }

  const updated = await prisma.imagingOrder.update({
    where: { id: existing.id },
    data: {
      ...(input.bodyPart !== undefined ? { bodyPart: input.bodyPart.trim() } : {}),
      ...(input.examinationName !== undefined ? { examinationName: input.examinationName.trim() } : {}),
      ...(input.clinicalIndication !== undefined ? { clinicalIndication: input.clinicalIndication.trim() } : {}),
      ...(input.referringDoctorId !== undefined ? { referringDoctorId: input.referringDoctorId || null } : {}),
      ...(input.referringDoctorText !== undefined ? { referringDoctorText: input.referringDoctorText ? input.referringDoctorText.trim() : null } : {}),
      ...(input.contrastRequired !== undefined ? { contrastRequired: input.contrastRequired } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.orderStatus !== undefined ? { orderStatus: input.orderStatus } : {}),
      ...(input.payerType !== undefined ? { payerType: input.payerType } : {}),
      ...(input.payerName !== undefined ? { payerName: input.payerName ? input.payerName.trim() : null } : {}),
      ...(input.memberId !== undefined ? { memberId: input.memberId ? input.memberId.trim() : null } : {}),
      ...(input.authorizationRequired !== undefined ? { authorizationRequired: input.authorizationRequired } : {}),
      ...(input.authorizationStatus !== undefined ? { authorizationStatus: input.authorizationStatus } : {}),
      ...(input.authorizationCode !== undefined ? { authorizationCode: input.authorizationCode ? input.authorizationCode.trim() : null } : {}),
      ...(input.insuranceNotes !== undefined ? { insuranceNotes: input.insuranceNotes ? input.insuranceNotes.trim() : null } : {}),
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'ORDER_UPDATED',
    entityType: 'ImagingOrder',
    entityId: updated.accessionNumber,
    details: {
      accessionNumber: updated.accessionNumber,
      updatedFields: Object.keys(input),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

export async function listOrders(params: ListOrdersQuery) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(500, Math.max(1, params.pageSize || params.limit || 20));
  const skip = (page - 1) * pageSize;

  const status = params.orderStatus || params.status;
  const search = params.search?.trim();

  const where: Prisma.ImagingOrderWhereInput = {
    ...(params.modality ? { modality: params.modality } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(status ? { orderStatus: status } : {}),
    ...(params.accessionNumber ? { accessionNumber: { contains: params.accessionNumber, mode: 'insensitive' } } : {}),
    ...(params.patientId
      ? {
          OR: [{ patientId: params.patientId }, { patient: { patientId: params.patientId } }],
        }
      : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { accessionNumber: { contains: search, mode: 'insensitive' } },
            { examinationName: { contains: search, mode: 'insensitive' } },
            { clinicalIndication: { contains: search, mode: 'insensitive' } },
            { patient: { firstName: { contains: search, mode: 'insensitive' } } },
            { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            { patient: { patientId: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.imagingOrder.count({ where }),
    prisma.imagingOrder.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
          },
        },
        referringDoctor: {
          select: { id: true, name: true, organization: true },
        },
        appointment: {
          select: {
            id: true,
            appointmentNumber: true,
            scheduledStart: true,
            scheduledEnd: true,
            status: true,
            tokenNumber: true,
            location: true,
          },
        },
        study: {
          select: { id: true, studyStatus: true, pacsStatus: true, instanceCount: true },
        },
        report: {
          select: { id: true, status: true, finalizedAt: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getOrderTimeline(idOrAccession: string) {
  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: idOrAccession }, { accessionNumber: idOrAccession }] },
    include: {
      patient: true,
      appointment: { include: { equipment: true } },
      study: true,
      report: { include: { signedBy: true } },
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found with ID/Accession: ${idOrAccession}`);
  }

  const milestones = [
    {
      stage: 'PLACED',
      label: 'Order Placed & Registered',
      completed: true,
      timestamp: order.createdAt.toISOString(),
      details: `${order.examinationName} (${order.modality})`,
    },
    {
      stage: 'SCHEDULED',
      label: 'Appointment Scheduled',
      completed: !!order.appointment,
      timestamp: order.appointment?.createdAt.toISOString() || null,
      details: order.appointment
        ? `Appointment ${order.appointment.appointmentNumber} scheduled for ${order.appointment.scheduledStart.toISOString()}`
        : 'Awaiting scheduling',
    },
    {
      stage: 'ARRIVED',
      label: 'Patient Arrived & Checked In',
      completed: !!order.appointment?.checkedInAt,
      timestamp: order.appointment?.checkedInAt?.toISOString() || null,
      details: order.appointment?.tokenNumber
        ? `Checked in with Token #${order.appointment.tokenNumber}`
        : 'Pending arrival',
    },
    {
      stage: 'SCANNED',
      label: 'Imaging Acquisition Completed',
      completed:
        order.study?.studyStatus === 'READY_FOR_REPORTING' ||
        order.study?.studyStatus === 'REPORTED' ||
        order.orderStatus === OrderStatus.COMPLETED ||
        order.orderStatus === OrderStatus.SCAN_COMPLETED,
      timestamp: order.study?.updatedAt?.toISOString() || null,
      details: order.study
        ? `Study acquired: ${order.study.instanceCount || 0} instances linked`
        : 'Pending scan acquisition',
    },
    {
      stage: 'REPORTED',
      label: 'Diagnostic Report Finalized & Signed',
      completed: !!order.report && order.report.status === 'FINAL',
      timestamp: order.report?.finalizedAt?.toISOString() || null,
      details: order.report?.signedBy
        ? `Signed by Dr. ${order.report.signedBy.firstName} ${order.report.signedBy.lastName}`
        : 'Pending reporting',
    },
    {
      stage: 'DISPATCHED',
      label: 'Report Delivered & Dispatched',
      completed: !!order.report?.readyForReceptionAt,
      timestamp: order.report?.readyForReceptionAt?.toISOString() || null,
      details: order.report?.readyForReceptionAt
        ? 'Report delivered and verified at Reception Desk'
        : 'Pending delivery handover',
    },
  ];

  return {
    orderId: order.id,
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.firstName} ${order.patient.lastName}`,
    currentStatus: order.orderStatus,
    modality: order.modality,
    milestones,
  };
}

export async function syncOrderToModalityWorklist(
  idOrAccession: string,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const order = await prisma.imagingOrder.findFirst({
    where: { OR: [{ id: idOrAccession }, { accessionNumber: idOrAccession }] },
    include: {
      patient: true,
      appointment: { include: { equipment: true } },
      study: true,
    },
  });

  if (!order) {
    throw AppError.notFound(`Imaging order not found with ID/Accession: ${idOrAccession}`);
  }

  const stationAETitle =
    order.appointment?.equipment?.name?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 16) ||
    `${order.modality}_STATION_01`;

  const mwlRecord = {
    specificCharacterSet: 'ISO_IR 100',
    accessionNumber: order.accessionNumber,
    patientId: order.patient.patientId,
    patientName: `${order.patient.lastName}^${order.patient.firstName}`,
    patientBirthDate: order.patient.dateOfBirth.toISOString().split('T')[0].replace(/-/g, ''),
    patientSex: order.patient.gender === 'MALE' ? 'M' : order.patient.gender === 'FEMALE' ? 'F' : 'O',
    modality: order.modality,
    scheduledStationAETitle: stationAETitle,
    scheduledProcedureStepStartDate: order.appointment
      ? order.appointment.scheduledStart.toISOString().split('T')[0].replace(/-/g, '')
      : new Date().toISOString().split('T')[0].replace(/-/g, ''),
    scheduledProcedureStepStartTime: order.appointment
      ? order.appointment.scheduledStart.toTimeString().split(' ')[0].replace(/:/g, '')
      : '090000',
    scheduledPerformingPhysicianName: 'TECH^ON_DUTY',
    scheduledProcedureStepDescription: order.examinationName,
    scheduledProcedureStepId: `SPS-${order.accessionNumber}`,
    requestedProcedureDescription: order.examinationName,
    requestedProcedureId: `RP-${order.accessionNumber}`,
    studyInstanceUid: order.study?.studyInstanceUid || `1.2.826.0.1.3680043.8.498.${Date.now()}`,
  };

  await logAuditEvent({
    userId: context?.userId,
    action: 'MWL_SYNC_COMPLETED',
    entityType: 'ImagingOrder',
    entityId: order.accessionNumber,
    details: {
      accessionNumber: order.accessionNumber,
      stationAETitle,
      modality: order.modality,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    success: true,
    accessionNumber: order.accessionNumber,
    mwlRecord,
    syncedAt: new Date().toISOString(),
  };
}

export async function importHisOrder(
  payload: HisOrderImportPayload,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  if (!payload.externalSystem?.trim() || !payload.externalOrderId?.trim()) {
    throw AppError.badRequest('externalSystem and externalOrderId are required');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Locate or create Patient
    let patient = null;
    if (payload.patient.mrn) {
      patient = await tx.patient.findFirst({
        where: { patientId: payload.patient.mrn },
      });
    }

    if (!patient && payload.patient.phone) {
      patient = await tx.patient.findFirst({
        where: { phone: payload.patient.phone },
      });
    }

    if (!patient) {
      const patientId = await generateUniquePatientId(tx);
      const dob = new Date(payload.patient.dateOfBirth);
      patient = await tx.patient.create({
        data: {
          patientId,
          firstName: payload.patient.firstName.trim(),
          lastName: payload.patient.lastName.trim(),
          dateOfBirth: isNaN(dob.getTime()) ? new Date('1990-01-01') : dob,
          gender: payload.patient.gender as any,
          phone: payload.patient.phone.trim(),
          email: payload.patient.email?.trim() || null,
          addressLine1: payload.patient.address?.trim() || null,
        },
      });
    }

    // 2. Generate Accession Number
    const accessionNumber = await generateUniqueAccessionNumber(tx, payload.order.modality);

    // 3. Create Order
    const clinicalNotes = `[Imported from ${payload.externalSystem} Order #${payload.externalOrderId}] ${payload.order.clinicalIndication}`.trim();

    const order = await tx.imagingOrder.create({
      data: {
        accessionNumber,
        patientId: patient.id,
        modality: payload.order.modality,
        bodyPart: payload.order.bodyPart.trim(),
        examinationName: payload.order.examinationName.trim(),
        clinicalIndication: clinicalNotes,
        referringDoctorText: payload.order.referringDoctorName
          ? `${payload.order.referringDoctorName} (${payload.order.referringDoctorHospital || payload.externalSystem})`
          : payload.externalSystem,
        contrastRequired: payload.order.contrastRequired || false,
        priority: payload.order.priority || Priority.ROUTINE,
        orderStatus: OrderStatus.CREATED,
        insuranceNotes: payload.order.insuranceNotes || null,
        authorizationCode: payload.order.authorizationCode || null,
        authorizationStatus: payload.order.authorizationCode ? AuthorizationStatus.APPROVED : AuthorizationStatus.NOT_REQUIRED,
        createdById: context?.userId || null,
      },
      include: {
        patient: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'HIS_ORDER_IMPORTED',
      entityType: 'ImagingOrder',
      entityId: order.accessionNumber,
      details: {
        accessionNumber: order.accessionNumber,
        externalSystem: payload.externalSystem,
        externalOrderId: payload.externalOrderId,
        patientId: patient.patientId,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      success: true,
      externalSystem: payload.externalSystem,
      externalOrderId: payload.externalOrderId,
      accessionNumber: order.accessionNumber,
      order,
    };
  });
}

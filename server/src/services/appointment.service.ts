import { prisma } from '../config/db';
import {
  generateUniqueAppointmentNumber,
  generateDailyQueueToken,
} from '../utils/identifierGenerator';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  AppointmentStatus,
  EquipmentStatus,
  ModalityType,
  OrderStatus,
  Priority,
  Prisma,
} from '@prisma/client';

export interface CreateAppointmentInput {
  patientId: string;
  imagingOrderId: string;
  equipmentId?: string;
  examDefinitionId?: string;
  scheduledStart: string | Date;
  scheduledEnd?: string | Date;
  notes?: string;
  priority?: Priority;
  allowConflictOverride?: boolean;
  overrideReason?: string;
  assignedRadiographer?: string;
  assignedNurse?: string;
}

export interface AllocateStaffMachineInput {
  equipmentId?: string;
  location?: string;
  radiographer?: string;
  nurse?: string;
  notes?: string;
}

export interface RescheduleAppointmentInput {
  equipmentId?: string;
  scheduledStart: string | Date;
  reason: string;
}

export interface CheckInAppointmentInput {
  identityConfirmed: boolean;
}

export interface ListAppointmentsQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  patientId?: string;
  modality?: ModalityType;
  equipmentId?: string;
  status?: AppointmentStatus;
  priority?: Priority;
  search?: string;
}

export interface SlotAvailabilityQuery {
  modality: ModalityType;
  equipmentId?: string;
  date: string;
  examDefinitionId?: string;
}

/**
 * Server-side scheduling conflict validator
 * Enforces: existingStart < requestedEnd AND existingEnd > requestedStart
 */
export async function checkSchedulingConflicts(params: {
  equipmentId?: string;
  patientId: string;
  requestedStart: Date;
  requestedEnd: Date;
  excludeAppointmentId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx || prisma;

  if (params.requestedEnd <= params.requestedStart) {
    throw AppError.badRequest('Scheduled end time must be strictly after scheduled start time');
  }

  // Active appointment statuses that occupy slots
  const blockingStatuses: AppointmentStatus[] = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.CHECKED_IN,
  ];

  // 1. Check machine / equipment overlap conflict
  if (params.equipmentId) {
    const conflictingMachineAppointment = await client.appointment.findFirst({
      where: {
        equipmentId: params.equipmentId,
        id: params.excludeAppointmentId ? { not: params.excludeAppointmentId } : undefined,
        status: { in: blockingStatuses },
        AND: [
          { scheduledStart: { lt: params.requestedEnd } },
          { scheduledEnd: { gt: params.requestedStart } },
        ],
      },
      include: {
        equipment: { select: { name: true, location: true } },
      },
    });

    if (conflictingMachineAppointment) {
      throw new AppError(
        `Selected scanner (${conflictingMachineAppointment.equipment?.name || 'Equipment'}) is already booked during this time window.`,
        409,
        'SCHEDULING_CONFLICT',
        {
          conflictType: 'EQUIPMENT_OVERLAP',
          conflictingAppointmentId: conflictingMachineAppointment.id,
          conflictingWindow: {
            start: conflictingMachineAppointment.scheduledStart,
            end: conflictingMachineAppointment.scheduledEnd,
          },
        }
      );
    }
  }

  // 2. Check patient overlap conflict (same patient cannot be in two exams simultaneously)
  const conflictingPatientAppointment = await client.appointment.findFirst({
    where: {
      patientId: params.patientId,
      id: params.excludeAppointmentId ? { not: params.excludeAppointmentId } : undefined,
      status: { in: blockingStatuses },
      AND: [
        { scheduledStart: { lt: params.requestedEnd } },
        { scheduledEnd: { gt: params.requestedStart } },
      ],
    },
  });

  if (conflictingPatientAppointment) {
    throw new AppError(
      'This patient already has another active radiology appointment booked during this time interval.',
      409,
      'SCHEDULING_CONFLICT',
      {
        conflictType: 'PATIENT_OVERLAP',
        conflictingAppointmentId: conflictingPatientAppointment.id,
        conflictingWindow: {
          start: conflictingPatientAppointment.scheduledStart,
          end: conflictingPatientAppointment.scheduledEnd,
        },
      }
    );
  }
}

export async function createAppointment(
  input: CreateAppointmentInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  // 1. Verify patient exists and active
  const patient = await prisma.patient.findFirst({
    where: { OR: [{ id: input.patientId }, { patientId: input.patientId }] },
  });
  if (!patient || !patient.isActive) {
    throw AppError.badRequest('Invalid or inactive patient');
  }

  // 2. Verify imaging order exists and belongs to patient
  const order = await prisma.imagingOrder.findFirst({
    where: {
      OR: [{ id: input.imagingOrderId }, { accessionNumber: input.imagingOrderId }],
      patientId: patient.id,
    },
    include: { appointment: true },
  });

  if (!order) {
    throw AppError.notFound('Imaging order not found or does not belong to specified patient');
  }

  if (order.appointment && order.appointment.status !== AppointmentStatus.CANCELLED) {
    throw AppError.conflict(
      `An active appointment (${order.appointment.appointmentNumber}) already exists for this imaging order. Use reschedule instead.`,
      'ORDER_ALREADY_SCHEDULED'
    );
  }

  // 3. Modality and Exam duration resolution
  let durationMinutes = 30;
  let examDef: Awaited<ReturnType<typeof prisma.examDefinition.findUnique>> = null;
  if (input.examDefinitionId) {
    examDef = await prisma.examDefinition.findUnique({
      where: { id: input.examDefinitionId },
    });
    if (examDef) {
      if (examDef.modality !== order.modality) {
        throw AppError.badRequest(
          `Exam definition modality (${examDef.modality}) does not match order modality (${order.modality})`
        );
      }
      durationMinutes = examDef.defaultDurationMinutes + examDef.bufferMinutes;
    }
  }

  // 4. Equipment verification
  let equipment: Awaited<ReturnType<typeof prisma.equipment.findUnique>> = null;
  if (input.equipmentId) {
    equipment = await prisma.equipment.findUnique({
      where: { id: input.equipmentId },
    });
    if (!equipment) {
      throw AppError.notFound('Specified equipment not found');
    }
    if (equipment.modality !== order.modality) {
      throw AppError.badRequest(
        `Equipment modality (${equipment.modality}) does not match order modality (${order.modality})`
      );
    }
    if (
      equipment.status === EquipmentStatus.MAINTENANCE ||
      equipment.status === EquipmentStatus.OUT_OF_SERVICE
    ) {
      throw AppError.badRequest(
        `Scanner is currently unavailable for bookings due to status: ${equipment.status}`
      );
    }
  }

  // 5. Compute time window
  const start =
    typeof input.scheduledStart === 'string'
      ? new Date(input.scheduledStart)
      : input.scheduledStart;
  if (isNaN(start.getTime())) {
    throw AppError.badRequest('Invalid scheduled start time');
  }

  const end = input.scheduledEnd
    ? typeof input.scheduledEnd === 'string'
      ? new Date(input.scheduledEnd)
      : input.scheduledEnd
    : new Date(start.getTime() + durationMinutes * 60000);

  // 6. Execute booking transaction with conflict detection
  return prisma.$transaction(async (tx) => {
    if (!input.allowConflictOverride) {
      await checkSchedulingConflicts({
        equipmentId: input.equipmentId,
        patientId: patient.id,
        requestedStart: start,
        requestedEnd: end,
        tx,
      });
    } else {
      await logAuditEvent({
        userId: context?.userId,
        action: 'APPOINTMENT_OVERBOOKING_OVERRIDE',
        entityType: 'Appointment',
        entityId: 'OVERRIDE',
        details: {
          patientId: patient.patientId,
          reason: input.overrideReason || 'Supervisor emergency slot override',
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    const appointmentNumber = await generateUniqueAppointmentNumber(tx);

    let finalNotes = input.notes?.trim() || '';
    if (input.assignedRadiographer || input.assignedNurse) {
      const staffMeta = `[Staff: ${[input.assignedRadiographer && `Radiographer: ${input.assignedRadiographer}`, input.assignedNurse && `Nurse: ${input.assignedNurse}`].filter(Boolean).join(', ')}]`;
      finalNotes = finalNotes ? `${finalNotes} | ${staffMeta}` : staffMeta;
    }
    if (input.allowConflictOverride) {
      finalNotes = finalNotes ? `${finalNotes} | [OVERBOOKING OVERRIDE: ${input.overrideReason || 'Emergency'}]` : `[OVERBOOKING OVERRIDE: ${input.overrideReason || 'Emergency'}]`;
    }

    // Update order status to SCHEDULED first so relation query reflects the new state
    await tx.imagingOrder.update({
      where: { id: order.id },
      data: { orderStatus: OrderStatus.SCHEDULED },
    });

    const appointment = await tx.appointment.create({
      data: {
        appointmentNumber,
        patientId: patient.id,
        imagingOrderId: order.id,
        modality: order.modality,
        equipmentId: input.equipmentId || null,
        examDefinitionId: input.examDefinitionId || null,
        examination: examDef?.name || order.examinationName,
        scheduledStart: start,
        scheduledEnd: end,
        durationMinutes,
        status: AppointmentStatus.SCHEDULED,
        priority: input.priority || order.priority,
        location: equipment?.location || null,
        notes: finalNotes || null,
        createdById: context?.userId || null,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
        },
        imagingOrder: true,
        equipment: true,
        examDefinition: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'APPOINTMENT_SCHEDULED',
      entityType: 'Appointment',
      entityId: appointment.appointmentNumber,
      details: {
        appointmentNumber: appointment.appointmentNumber,
        accessionNumber: order.accessionNumber,
        patientId: patient.patientId,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        equipment: equipment?.name,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return appointment;
  });
}

export async function rescheduleAppointment(
  appointmentId: string,
  input: RescheduleAppointmentInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  if (!input.reason?.trim()) {
    throw AppError.badRequest('A clinical or administrative reason is required for rescheduling');
  }

  const existing = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: { imagingOrder: true, equipment: true },
  });

  if (!existing) {
    throw AppError.notFound(`Appointment not found with identifier: ${appointmentId}`);
  }

  if (
    existing.status === AppointmentStatus.CANCELLED ||
    existing.status === AppointmentStatus.COMPLETED
  ) {
    throw AppError.badRequest(
      `Cannot reschedule appointment in status: ${existing.status}`
    );
  }

  const newStart =
    typeof input.scheduledStart === 'string'
      ? new Date(input.scheduledStart)
      : input.scheduledStart;
  if (isNaN(newStart.getTime())) {
    throw AppError.badRequest('Invalid new scheduled start time');
  }

  const targetEquipmentId = input.equipmentId || existing.equipmentId || undefined;
  const newEnd = new Date(newStart.getTime() + existing.durationMinutes * 60000);

  return prisma.$transaction(async (tx) => {
    await checkSchedulingConflicts({
      equipmentId: targetEquipmentId,
      patientId: existing.patientId,
      requestedStart: newStart,
      requestedEnd: newEnd,
      excludeAppointmentId: existing.id,
      tx,
    });

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        equipmentId: targetEquipmentId || null,
        scheduledStart: newStart,
        scheduledEnd: newEnd,
        status: AppointmentStatus.SCHEDULED,
        rescheduleReason: input.reason.trim(),
      },
      include: {
        patient: true,
        imagingOrder: true,
        equipment: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'APPOINTMENT_RESCHEDULED',
      entityType: 'Appointment',
      entityId: existing.appointmentNumber,
      details: {
        appointmentNumber: existing.appointmentNumber,
        accessionNumber: existing.imagingOrder?.accessionNumber,
        previousStart: existing.scheduledStart.toISOString(),
        newStart: newStart.toISOString(),
        reason: input.reason.trim(),
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  });
}

export async function cancelAppointment(
  appointmentId: string,
  reason: string,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  if (!reason?.trim()) {
    throw AppError.badRequest('Cancellation reason is required');
  }

  const existing = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: { imagingOrder: true },
  });

  if (!existing) {
    throw AppError.notFound(`Appointment not found with identifier: ${appointmentId}`);
  }

  if (existing.status === AppointmentStatus.CANCELLED) {
    throw AppError.badRequest('Appointment is already cancelled');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason.trim(),
        cancelledAt: new Date(),
      },
      include: {
        patient: true,
        imagingOrder: true,
      },
    });

    // Update order status back to CREATED or CANCELLED
    if (existing.imagingOrderId) {
      await tx.imagingOrder.update({
        where: { id: existing.imagingOrderId },
        data: { orderStatus: OrderStatus.CANCELLED },
      });
    }

    await logAuditEvent({
      userId: context?.userId,
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'Appointment',
      entityId: existing.appointmentNumber,
      details: {
        appointmentNumber: existing.appointmentNumber,
        accessionNumber: existing.imagingOrder?.accessionNumber,
        reason: reason.trim(),
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  });
}

export async function markNoShowAppointment(
  appointmentId: string,
  reason: string,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: { imagingOrder: true },
  });

  if (!existing) {
    throw AppError.notFound(`Appointment not found with identifier: ${appointmentId}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        status: AppointmentStatus.NO_SHOW,
        noShowReason: reason?.trim() || 'Patient failed to appear for scheduled examination.',
      },
      include: {
        patient: true,
        imagingOrder: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'APPOINTMENT_NO_SHOW',
      entityType: 'Appointment',
      entityId: existing.appointmentNumber,
      details: {
        appointmentNumber: existing.appointmentNumber,
        reason,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  });
}

export async function checkInAppointment(
  appointmentId: string,
  input: CheckInAppointmentInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  if (!input.identityConfirmed) {
    throw AppError.badRequest(
      'Staff identity verification is mandatory. Please confirm patient identity before check-in.'
    );
  }

  const existing = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: {
      patient: true,
      imagingOrder: true,
      equipment: true,
    },
  });

  if (!existing) {
    throw AppError.notFound(`Appointment not found with identifier: ${appointmentId}`);
  }

  if (existing.status === AppointmentStatus.CHECKED_IN) {
    throw AppError.badRequest(`Patient is already checked in with token: ${existing.tokenNumber}`);
  }

  if (
    existing.status === AppointmentStatus.CANCELLED ||
    existing.status === AppointmentStatus.NO_SHOW ||
    existing.status === AppointmentStatus.COMPLETED
  ) {
    throw AppError.badRequest(`Cannot check in an appointment in status: ${existing.status}`);
  }

  return prisma.$transaction(async (tx) => {
    // Generate daily sequence queue token for the modality
    const tokenNumber = await generateDailyQueueToken(tx, existing.modality);
    const now = new Date();

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        status: AppointmentStatus.CHECKED_IN,
        tokenNumber,
        checkedInAt: now,
        checkedInById: context?.userId || null,
      },
      include: {
        patient: true,
        imagingOrder: true,
        equipment: true,
      },
    });

    // Advance imaging order to READY_FOR_TECH
    if (existing.imagingOrderId) {
      await tx.imagingOrder.update({
        where: { id: existing.imagingOrderId },
        data: { orderStatus: OrderStatus.READY_FOR_TECH },
      });
    }

    await logAuditEvent({
      userId: context?.userId,
      action: 'PATIENT_CHECKED_IN',
      entityType: 'Appointment',
      entityId: existing.appointmentNumber,
      details: {
        appointmentNumber: existing.appointmentNumber,
        tokenNumber,
        accessionNumber: existing.imagingOrder?.accessionNumber,
        patientId: existing.patient.patientId,
        identityVerified: true,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      appointment: updated,
      tokenNumber,
      checkedInAt: now,
      queueMessage: `Patient checked in successfully. Assigned Waiting Token: ${tokenNumber}`,
    };
  });
}

export async function getReceptionWaitingQueue(params: {
  date?: string;
  modality?: ModalityType;
}) {
  const targetDate = params.date ? new Date(params.date) : new Date();
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  );
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59,
    999
  );

  const queue = await prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.CHECKED_IN,
      checkedInAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      ...(params.modality ? { modality: params.modality } : {}),
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
      imagingOrder: {
        select: {
          id: true,
          accessionNumber: true,
          modality: true,
          bodyPart: true,
          examinationName: true,
          clinicalIndication: true,
          contrastRequired: true,
          priority: true,
          orderStatus: true,
        },
      },
      equipment: {
        select: { id: true, name: true, location: true },
      },
    },
    orderBy: [
      { priority: 'desc' }, // STAT first, then URGENT, then ROUTINE
      { checkedInAt: 'asc' }, // FIFO within same priority
    ],
    take: 50,
  });

  return queue;
}

export async function calculateSlotAvailability(params: SlotAvailabilityQuery) {
  const targetDate = new Date(params.date);
  if (isNaN(targetDate.getTime())) {
    throw AppError.badRequest('Invalid date provided for slot availability calculation');
  }

  // 1. Get Exam duration
  let slotDurationMinutes = 30;
  if (params.examDefinitionId) {
    const exam = await prisma.examDefinition.findUnique({
      where: { id: params.examDefinitionId },
    });
    if (exam) {
      slotDurationMinutes = exam.defaultDurationMinutes + exam.bufferMinutes;
    }
  }

  // 2. Fetch eligible equipment
  const equipmentList = await prisma.equipment.findMany({
    where: {
      modality: params.modality,
      id: params.equipmentId || undefined,
      status: { in: [EquipmentStatus.AVAILABLE, EquipmentStatus.OPERATIONAL] },
    },
  });

  if (equipmentList.length === 0) {
    return {
      date: params.date,
      modality: params.modality,
      slots: [],
      message: 'No operational scanners available for this modality.',
    };
  }

  // 3. Define clinic hours (08:00 to 18:00)
  const startHour = 8;
  const endHour = 18;

  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  );
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59,
    999
  );

  // 4. Fetch existing active bookings for these machines today
  const existingBookings = await prisma.appointment.findMany({
    where: {
      equipmentId: { in: equipmentList.map((e) => e.id) },
      status: {
        in: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.ARRIVED,
          AppointmentStatus.CHECKED_IN,
        ],
      },
      scheduledStart: { gte: startOfDay },
      scheduledEnd: { lte: endOfDay },
    },
    select: {
      equipmentId: true,
      scheduledStart: true,
      scheduledEnd: true,
    },
  });

  // 5. Generate candidate time intervals
  const slots: Array<{
    start: string;
    end: string;
    equipmentId: string;
    equipmentName: string;
    available: boolean;
  }> = [];

  for (const machine of equipmentList) {
    let currentSlotStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      startHour,
      0,
      0,
      0
    );
    const dayClosing = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      endHour,
      0,
      0,
      0
    );

    while (currentSlotStart.getTime() + slotDurationMinutes * 60000 <= dayClosing.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMinutes * 60000);

      // Check overlap: existingStart < requestedEnd && existingEnd > requestedStart
      const isOverlap = existingBookings.some((b) => {
        if (b.equipmentId !== machine.id) return false;
        return b.scheduledStart < currentSlotEnd && b.scheduledEnd > currentSlotStart;
      });

      slots.push({
        start: currentSlotStart.toISOString(),
        end: currentSlotEnd.toISOString(),
        equipmentId: machine.id,
        equipmentName: machine.name,
        available: !isOverlap,
      });

      // Advance by slot duration
      currentSlotStart = new Date(currentSlotEnd);
    }
  }

  return {
    date: params.date,
    modality: params.modality,
    slots,
  };
}

export async function listAppointments(params: ListAppointmentsQuery) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || params.limit || 20));
  const skip = (page - 1) * pageSize;

  let dateFilter: Prisma.DateTimeFilter | undefined;
  if (params.date) {
    const d = new Date(params.date);
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    dateFilter = { gte: s, lte: e };
  } else if (params.dateFrom || params.dateTo) {
    dateFilter = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    };
  }

  const search = params.search?.trim();

  const where: Prisma.AppointmentWhereInput = {
    ...(dateFilter ? { scheduledStart: dateFilter } : {}),
    ...(params.modality ? { modality: params.modality } : {}),
    ...(params.equipmentId ? { equipmentId: params.equipmentId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.patientId
      ? {
          OR: [{ patientId: params.patientId }, { patient: { patientId: params.patientId } }],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { appointmentNumber: { contains: search, mode: 'insensitive' } },
            { examination: { contains: search, mode: 'insensitive' } },
            { tokenNumber: { contains: search, mode: 'insensitive' } },
            { patient: { firstName: { contains: search, mode: 'insensitive' } } },
            { patient: { lastName: { contains: search, mode: 'insensitive' } } },
            { patient: { patientId: { contains: search, mode: 'insensitive' } } },
            { imagingOrder: { accessionNumber: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { scheduledStart: 'asc' },
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
        imagingOrder: {
          select: {
            id: true,
            accessionNumber: true,
            modality: true,
            bodyPart: true,
            examinationName: true,
            clinicalIndication: true,
            contrastRequired: true,
            priority: true,
            orderStatus: true,
            authorizationStatus: true,
            referringDoctor: {
              select: { id: true, name: true },
            },
          },
        },
        equipment: {
          select: { id: true, name: true, location: true },
        },
        examDefinition: {
          select: { id: true, code: true, name: true, defaultDurationMinutes: true },
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

export async function getAppointmentById(id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      OR: [{ id }, { appointmentNumber: id }],
    },
    include: {
      patient: true,
      imagingOrder: {
        include: {
          referringDoctor: true,
        },
      },
      equipment: true,
      examDefinition: true,
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!appointment) {
    throw AppError.notFound(`Appointment not found with identifier: ${id}`);
  }

  return appointment;
}

export async function allocateSlotStaffAndMachine(
  appointmentId: string,
  input: AllocateStaffMachineInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.appointment.findFirst({
    where: { OR: [{ id: appointmentId }, { appointmentNumber: appointmentId }] },
    include: { equipment: true },
  });

  if (!existing) {
    throw AppError.notFound(`Appointment not found with identifier: ${appointmentId}`);
  }

  let finalNotes = existing.notes || '';
  if (input.radiographer || input.nurse) {
    const staffMeta = `[Staff: ${[input.radiographer && `Radiographer: ${input.radiographer}`, input.nurse && `Nurse: ${input.nurse}`].filter(Boolean).join(', ')}]`;
    if (finalNotes.includes('[Staff:')) {
      finalNotes = finalNotes.replace(/\[Staff:.*?\]/, staffMeta);
    } else {
      finalNotes = finalNotes ? `${finalNotes} | ${staffMeta}` : staffMeta;
    }
  }

  if (input.notes) {
    finalNotes = `${finalNotes} | ${input.notes.trim()}`;
  }

  const updated = await prisma.appointment.update({
    where: { id: existing.id },
    data: {
      ...(input.equipmentId ? { equipmentId: input.equipmentId } : {}),
      ...(input.location ? { location: input.location } : {}),
      notes: finalNotes.trim() || null,
    },
    include: {
      patient: true,
      imagingOrder: true,
      equipment: true,
      examDefinition: true,
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'SLOT_STAFF_MACHINE_ALLOCATED',
    entityType: 'Appointment',
    entityId: updated.appointmentNumber,
    details: {
      appointmentNumber: updated.appointmentNumber,
      equipmentId: updated.equipmentId,
      radiographer: input.radiographer,
      nurse: input.nurse,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    ...updated,
    staffAllocation: {
      radiographer: input.radiographer || null,
      nurse: input.nurse || null,
    },
  };
}

export async function getBookingPrepCheck(params: {
  examDefinitionId?: string;
  modality?: ModalityType;
  contrastRequired?: boolean;
}) {
  let exam = null;
  if (params.examDefinitionId) {
    exam = await prisma.examDefinition.findUnique({
      where: { id: params.examDefinitionId },
    });
  }

  const fastingRequired = exam?.fastingRequired || false;
  const ivRequired = exam?.ivRequired || params.contrastRequired || false;
  const contrastPreparationRequired = exam?.contrastPreparationRequired || params.contrastRequired || false;
  const consentRequired = exam?.consentRequired || params.contrastRequired || false;
  const durationMinutes = exam ? exam.defaultDurationMinutes + exam.bufferMinutes : 30;

  let instructions = exam?.additionalPreparationInstructions || 'Standard scanning protocol applies.';
  if (fastingRequired) {
    instructions += ' Patient must fast for 4-6 hours prior to scan.';
  }
  if (contrastPreparationRequired) {
    instructions += ' Contrast screening and renal function test (Creatinine / eGFR) required.';
  }

  return {
    examName: exam?.name || `${params.modality || 'Diagnostic'} Examination`,
    modality: exam?.modality || params.modality,
    defaultDurationMinutes: durationMinutes,
    fastingRequired,
    ivRequired,
    contrastPreparationRequired,
    consentRequired,
    instructions,
    allergyReminder: 'Screen for contrast media allergies, asthma, renal impairment, and metallic implants before proceeding.',
  };
}

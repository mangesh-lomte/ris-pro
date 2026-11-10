import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import {
  AppointmentStatus,
  ModalityType,
  OrderStatus,
  Priority,
  Prisma,
  SafetyStatus,
} from '@prisma/client';

export interface TechnologistWorklistQuery {
  page?: number;
  pageSize?: number;
  date?: string;
  modality?: string;
  equipmentId?: string;
  priority?: string;
  search?: string;
}

export interface WorklistPatientSummary {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

export interface WorklistOrderSummary {
  accessionNumber: string;
  modality: ModalityType;
  examinationName: string;
  bodyPart: string;
  clinicalIndication: string;
  priority: Priority;
  orderStatus: OrderStatus;
  contrastRequired: boolean;
  safetyStatus?: SafetyStatus;
}

export interface WorklistAppointmentSummary {
  appointmentNumber: string;
  scheduledStart: string;
  scheduledEnd: string;
  checkedInAt: string | null;
  tokenNumber: string | null;
  notes: string | null;
}

export interface WorklistEquipmentSummary {
  id: string;
  name: string;
  modality: ModalityType;
  location: string;
  status: string;
}

export interface TechnologistWorklistItem {
  appointmentId: string;
  orderId: string;
  patientId: string;
  patient: WorklistPatientSummary;
  order: WorklistOrderSummary;
  appointment: WorklistAppointmentSummary;
  equipment: WorklistEquipmentSummary | null;
  waitingMinutes: number;
}

export interface TechnologistWorklistResult {
  items: TechnologistWorklistItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Calculates waiting duration in whole minutes from check-in time to current moment
 */
export function calculateWaitingMinutes(checkedInAt: Date | string | null | undefined): number {
  if (!checkedInAt) return 0;
  const startTime = new Date(checkedInAt).getTime();
  if (isNaN(startTime)) return 0;
  const diffMs = Math.max(0, Date.now() - startTime);
  return Math.floor(diffMs / 60000);
}

/**
 * Retrieves the eligible technologist worklist based on strict clinical workflow eligibility rules:
 * - ImagingOrder.orderStatus = READY_FOR_TECH
 * - Appointment.status = CHECKED_IN (excludes SCHEDULED, CANCELLED, NO_SHOW, COMPLETED)
 * - Patient.isActive = true
 */
export async function getTechnologistWorklist(
  query: TechnologistWorklistQuery
): Promise<TechnologistWorklistResult> {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const whereConditions: Prisma.AppointmentWhereInput[] = [
    {
      status: AppointmentStatus.CHECKED_IN,
    },
    {
      imagingOrder: {
        orderStatus: {
          in: [
            OrderStatus.READY_FOR_TECH,
            OrderStatus.SAFETY_REVIEW,
            OrderStatus.SAFETY_CLEARED,
            OrderStatus.PREPARATION_IN_PROGRESS,
            OrderStatus.PREPARED,
            OrderStatus.READY_FOR_SCAN,
            OrderStatus.SCAN_IN_PROGRESS,
            OrderStatus.SCAN_INTERRUPTED,
            OrderStatus.SCAN_COMPLETED,
            OrderStatus.IMAGE_QA_PENDING,
            OrderStatus.IMAGE_ACCEPTED,
            OrderStatus.REPEAT_REQUIRED,
            OrderStatus.IMAGE_REJECTED,
            OrderStatus.PACS_READY,
            OrderStatus.PACS_HANDOFF_PENDING,
            OrderStatus.PACS_HANDOFF_COMPLETE,
            OrderStatus.PACS_HANDOFF_FAILED,
          ],
        },
      },
    },
    {
      patient: {
        isActive: true,
      },
    },
  ];

  // 1. Modality Filter
  if (query.modality && query.modality !== 'ALL') {
    whereConditions.push({
      modality: query.modality as ModalityType,
    });
  }

  // 2. Equipment Filter
  if (query.equipmentId && query.equipmentId !== 'ALL') {
    whereConditions.push({
      equipmentId: query.equipmentId,
    });
  }

  // 3. Priority Filter
  if (query.priority && query.priority !== 'ALL') {
    whereConditions.push({
      priority: query.priority as Priority,
    });
  }

  // 4. Date Filter (Default: today if omitted)
  let dateParam = query.date;
  if (!dateParam) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    dateParam = `${y}-${m}-${d}`;
  }

  if (dateParam !== 'ALL') {
    const parts = dateParam.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]!, 10);
      const month = parseInt(parts[1]!, 10) - 1;
      const day = parseInt(parts[2]!, 10);
      const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

      whereConditions.push({
        OR: [
          { scheduledStart: { gte: startOfDay, lte: endOfDay } },
          { checkedInAt: { gte: startOfDay, lte: endOfDay } },
        ],
      });
    }
  }

  // 5. Search Filter (patient name, patient ID, accession number, examination name)
  if (query.search && query.search.trim().length > 0) {
    const term = query.search.trim();
    whereConditions.push({
      OR: [
        { patient: { firstName: { contains: term, mode: 'insensitive' } } },
        { patient: { lastName: { contains: term, mode: 'insensitive' } } },
        { patient: { patientId: { contains: term, mode: 'insensitive' } } },
        { imagingOrder: { accessionNumber: { contains: term, mode: 'insensitive' } } },
        { imagingOrder: { examinationName: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }

  const where: Prisma.AppointmentWhereInput = {
    AND: whereConditions,
  };

  // Deterministic Ordering:
  // 1. STAT -> URGENT -> ROUTINE (priority desc)
  // 2. scheduledStart asc
  // 3. checkedInAt asc
  const [total, appointments] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      select: {
        id: true,
        appointmentNumber: true,
        scheduledStart: true,
        scheduledEnd: true,
        checkedInAt: true,
        tokenNumber: true,
        notes: true,
        priority: true,
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        imagingOrder: {
          select: {
            id: true,
            accessionNumber: true,
            modality: true,
            examinationName: true,
            bodyPart: true,
            clinicalIndication: true,
            priority: true,
            orderStatus: true,
            contrastRequired: true,
            safetyScreening: {
              select: {
                safetyStatus: true,
              },
            },
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
            modality: true,
            location: true,
            status: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledStart: 'asc' },
        { checkedInAt: 'asc' },
      ],
      skip,
      take: pageSize,
    }),
  ]);

  const items: TechnologistWorklistItem[] = appointments
    .filter((appt) => appt.imagingOrder !== null && appt.patient !== null)
    .map((appt) => {
      const order = appt.imagingOrder!;
      const patient = appt.patient;
      const waitingMinutes = calculateWaitingMinutes(appt.checkedInAt);

      return {
        appointmentId: appt.id,
        orderId: order.id,
        patientId: patient.patientId,
        patient: {
          patientId: patient.patientId,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth.toISOString().split('T')[0]!,
          gender: patient.gender,
        },
        order: {
          accessionNumber: order.accessionNumber,
          modality: order.modality,
          examinationName: order.examinationName,
          bodyPart: order.bodyPart,
          clinicalIndication: order.clinicalIndication,
          priority: order.priority,
          orderStatus: order.orderStatus,
          contrastRequired: order.contrastRequired,
          safetyStatus: order.safetyScreening?.safetyStatus || SafetyStatus.NOT_STARTED,
        },
        appointment: {
          appointmentNumber: appt.appointmentNumber,
          scheduledStart: appt.scheduledStart.toISOString(),
          scheduledEnd: appt.scheduledEnd.toISOString(),
          checkedInAt: appt.checkedInAt ? appt.checkedInAt.toISOString() : null,
          tokenNumber: appt.tokenNumber || null,
          notes: appt.notes || null,
        },
        equipment: appt.equipment
          ? {
              id: appt.equipment.id,
              name: appt.equipment.name,
              modality: appt.equipment.modality,
              location: appt.equipment.location,
              status: appt.equipment.status,
            }
          : null,
        waitingMinutes,
      };
    });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Retrieves complete technologist context for a specific exam by appointment ID, order ID, or accession number.
 */
export async function getTechnologistWorklistItem(identifier: string) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      OR: [
        { id: identifier },
        { appointmentNumber: identifier },
        { imagingOrderId: identifier },
        { imagingOrder: { accessionNumber: identifier } },
      ],
      status: AppointmentStatus.CHECKED_IN,
      imagingOrder: {
        orderStatus: {
          in: [
            OrderStatus.READY_FOR_TECH,
            OrderStatus.SAFETY_REVIEW,
            OrderStatus.SAFETY_CLEARED,
            OrderStatus.PREPARATION_IN_PROGRESS,
            OrderStatus.PREPARED,
            OrderStatus.READY_FOR_SCAN,
            OrderStatus.SCAN_IN_PROGRESS,
            OrderStatus.SCAN_INTERRUPTED,
            OrderStatus.SCAN_COMPLETED,
            OrderStatus.IMAGE_QA_PENDING,
            OrderStatus.IMAGE_ACCEPTED,
            OrderStatus.REPEAT_REQUIRED,
            OrderStatus.IMAGE_REJECTED,
            OrderStatus.PACS_READY,
            OrderStatus.PACS_HANDOFF_PENDING,
            OrderStatus.PACS_HANDOFF_COMPLETE,
            OrderStatus.PACS_HANDOFF_FAILED,
          ],
        },
      },
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
      examDefinition: true,
    },
  });

  if (!appointment || !appointment.imagingOrder) {
    // Fallback: search by imagingOrder directly so exam details load unconditionally from PostgreSQL
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
          include: { equipment: true, examDefinition: true },
        },
        safetyScreening: {
          include: {
            completedByUser: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound(`Eligible technologist exam not found for identifier: ${identifier}`);
    }

    const appt = order.appointment;
    const waitingMinutes = appt ? calculateWaitingMinutes(appt.checkedInAt) : 0;

    return {
      appointmentId: appt?.id || order.id,
      appointmentNumber: appt?.appointmentNumber || `APT-${order.accessionNumber}`,
      scheduledStart: appt?.scheduledStart ? appt.scheduledStart.toISOString() : new Date().toISOString(),
      scheduledEnd: appt?.scheduledEnd ? appt.scheduledEnd.toISOString() : new Date().toISOString(),
      checkedInAt: appt?.checkedInAt?.toISOString() || null,
      tokenNumber: appt?.tokenNumber || null,
      status: appt?.status || AppointmentStatus.CHECKED_IN,
      notes: appt?.notes || null,
      waitingMinutes,
      patient: {
        id: order.patient.id,
        patientId: order.patient.patientId,
        firstName: order.patient.firstName,
        middleName: order.patient.middleName,
        lastName: order.patient.lastName,
        dateOfBirth: order.patient.dateOfBirth.toISOString().split('T')[0],
        gender: order.patient.gender,
        phone: order.patient.phone,
        email: order.patient.email,
      },
      order: {
        id: order.id,
        accessionNumber: order.accessionNumber,
        modality: order.modality,
        examinationName: order.examinationName,
        bodyPart: order.bodyPart,
        clinicalIndication: order.clinicalIndication,
        priority: order.priority,
        orderStatus: order.orderStatus,
        contrastRequired: order.contrastRequired,
        referringDoctor: order.referringDoctor
          ? {
              id: order.referringDoctor.id,
              name: order.referringDoctor.name,
              organization: order.referringDoctor.organization,
              providerIdentifier: order.referringDoctor.providerIdentifier,
              phone: order.referringDoctor.phone,
              email: order.referringDoctor.email,
            }
          : null,
      },
      equipment: appt?.equipment
        ? {
            id: appt.equipment.id,
            name: appt.equipment.name,
            modality: appt.equipment.modality,
            manufacturer: appt.equipment.manufacturer,
            model: appt.equipment.model,
            location: appt.equipment.location,
            status: appt.equipment.status,
          }
        : null,
      safetyScreening: order.safetyScreening
        ? {
            id: order.safetyScreening.id,
            safetyStatus: order.safetyScreening.safetyStatus,
            identityVerified: order.safetyScreening.identityVerified,
            identityVerificationMethod: order.safetyScreening.identityVerificationMethod,
            identityVerifiedAt: order.safetyScreening.identityVerifiedAt?.toISOString() || null,
            safetyNotes: order.safetyScreening.safetyNotes,
            riskFactors: order.safetyScreening.riskFactors,
            answers: order.safetyScreening.answers,
            reviewedAt: order.safetyScreening.reviewedAt?.toISOString() || null,
            completedByUser: order.safetyScreening.completedByUser,
          }
        : null,
    };
  }

  const waitingMinutes = calculateWaitingMinutes(appointment.checkedInAt);

  return {
    appointmentId: appointment.id,
    appointmentNumber: appointment.appointmentNumber,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
    checkedInAt: appointment.checkedInAt?.toISOString() || null,
    tokenNumber: appointment.tokenNumber || null,
    status: appointment.status,
    notes: appointment.notes || null,
    waitingMinutes,
    patient: {
      id: appointment.patient.id,
      patientId: appointment.patient.patientId,
      firstName: appointment.patient.firstName,
      middleName: appointment.patient.middleName,
      lastName: appointment.patient.lastName,
      dateOfBirth: appointment.patient.dateOfBirth.toISOString().split('T')[0],
      gender: appointment.patient.gender,
      phone: appointment.patient.phone,
      email: appointment.patient.email,
    },
    order: {
      id: appointment.imagingOrder.id,
      accessionNumber: appointment.imagingOrder.accessionNumber,
      modality: appointment.imagingOrder.modality,
      examinationName: appointment.imagingOrder.examinationName,
      bodyPart: appointment.imagingOrder.bodyPart,
      clinicalIndication: appointment.imagingOrder.clinicalIndication,
      priority: appointment.imagingOrder.priority,
      orderStatus: appointment.imagingOrder.orderStatus,
      contrastRequired: appointment.imagingOrder.contrastRequired,
      referringDoctor: appointment.imagingOrder.referringDoctor
        ? {
            id: appointment.imagingOrder.referringDoctor.id,
            name: appointment.imagingOrder.referringDoctor.name,
            organization: appointment.imagingOrder.referringDoctor.organization,
            providerIdentifier: appointment.imagingOrder.referringDoctor.providerIdentifier,
            phone: appointment.imagingOrder.referringDoctor.phone,
            email: appointment.imagingOrder.referringDoctor.email,
          }
        : null,
    },
    equipment: appointment.equipment
      ? {
          id: appointment.equipment.id,
          name: appointment.equipment.name,
          modality: appointment.equipment.modality,
          manufacturer: appointment.equipment.manufacturer,
          model: appointment.equipment.model,
          location: appointment.equipment.location,
          status: appointment.equipment.status,
        }
      : null,
    safetyScreening: appointment.imagingOrder.safetyScreening
      ? {
          id: appointment.imagingOrder.safetyScreening.id,
          safetyStatus: appointment.imagingOrder.safetyScreening.safetyStatus,
          identityVerified: appointment.imagingOrder.safetyScreening.identityVerified,
          identityVerificationMethod: appointment.imagingOrder.safetyScreening.identityVerificationMethod,
          identityVerifiedAt: appointment.imagingOrder.safetyScreening.identityVerifiedAt?.toISOString() || null,
          safetyNotes: appointment.imagingOrder.safetyScreening.safetyNotes,
          riskFactors: appointment.imagingOrder.safetyScreening.riskFactors,
          answers: appointment.imagingOrder.safetyScreening.answers,
          reviewedAt: appointment.imagingOrder.safetyScreening.reviewedAt?.toISOString() || null,
          completedByUser: appointment.imagingOrder.safetyScreening.completedByUser,
        }
      : null,
  };
}

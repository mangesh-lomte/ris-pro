import { prisma } from '../config/db';
import { generateUniquePatientId } from '../utils/identifierGenerator';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import { Gender, Prisma } from '@prisma/client';

export interface CreatePatientInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string | Date;
  gender: Gender;
  phone: string;
  alternatePhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bypassDuplicateWarning?: boolean;
}

export interface UpdatePatientInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string | Date;
  gender?: Gender;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  isActive?: boolean;
}

export interface ListPatientsQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function findDuplicatePatients(data: {
  phone: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
}) {
  const normalizedPhone = data.phone.trim();
  const normalizedFirst = data.firstName.trim();
  const normalizedLast = data.lastName.trim();

  const candidates = await prisma.patient.findMany({
    where: {
      OR: [
        { phone: normalizedPhone },
        {
          AND: [
            { firstName: { equals: normalizedFirst, mode: 'insensitive' } },
            { lastName: { equals: normalizedLast, mode: 'insensitive' } },
            { dateOfBirth: data.dateOfBirth },
          ],
        },
      ],
    },
    select: {
      id: true,
      patientId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      email: true,
      city: true,
      createdAt: true,
    },
  });

  return candidates.map((c) => {
    const reasons: string[] = [];
    if (c.phone === normalizedPhone) reasons.push('matching phone');
    if (
      c.firstName.toLowerCase() === normalizedFirst.toLowerCase() &&
      c.lastName.toLowerCase() === normalizedLast.toLowerCase()
    ) {
      reasons.push('matching name and DOB');
    }
    return {
      ...c,
      matchReason: reasons.join(' and ') || 'demographic match',
    };
  });
}

export async function createPatient(
  input: CreatePatientInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const dob = typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : input.dateOfBirth;

  if (isNaN(dob.getTime())) {
    throw AppError.badRequest('Invalid date of birth provided');
  }

  if (dob > new Date()) {
    throw AppError.badRequest('Date of birth cannot be in the future');
  }

  // 1. Check for duplicates before creation
  let overriddenCandidates: Awaited<ReturnType<typeof findDuplicatePatients>> = [];
  if (!input.bypassDuplicateWarning) {
    const duplicates = await findDuplicatePatients({
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: dob,
    });

    if (duplicates.length > 0) {
      throw new AppError(
        'Possible existing patient found with matching phone or name and date of birth',
        409,
        'POSSIBLE_DUPLICATE_PATIENT',
        { candidates: duplicates }
      );
    }
  } else {
    // If warning was overridden, capture duplicate candidates for compliance audit trail
    overriddenCandidates = await findDuplicatePatients({
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: dob,
    });
  }

  // 2. Format legacy string address/emergency contact for backward compatibility
  const composedAddress = [input.addressLine1, input.addressLine2, input.city, input.state, input.postalCode]
    .filter(Boolean)
    .join(', ');

  const composedEmergency = input.emergencyContactName
    ? `${input.emergencyContactName}${input.emergencyContactRelation ? ` (${input.emergencyContactRelation})` : ''} - ${input.emergencyContactPhone || 'No Phone'}`
    : undefined;

  // 3. Database transaction with collision-safe patientId generator
  return prisma.$transaction(async (tx) => {
    const patientId = await generateUniquePatientId(tx);

    const patient = await tx.patient.create({
      data: {
        patientId,
        firstName: input.firstName.trim(),
        middleName: input.middleName?.trim() || null,
        lastName: input.lastName.trim(),
        dateOfBirth: dob,
        gender: input.gender,
        phone: input.phone.trim(),
        alternatePhone: input.alternatePhone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        addressLine1: input.addressLine1?.trim() || null,
        addressLine2: input.addressLine2?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        postalCode: input.postalCode?.trim() || null,
        emergencyContactName: input.emergencyContactName?.trim() || null,
        emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
        emergencyContactRelation: input.emergencyContactRelation?.trim() || null,
        address: composedAddress || null,
        emergencyContact: composedEmergency || null,
        isActive: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId,
      action: 'PATIENT_CREATED',
      entityType: 'Patient',
      entityId: patient.patientId,
      details: {
        internalId: patient.id,
        patientId: patient.patientId,
        fullName: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // Record audit event when duplicate warning is explicitly overridden
    if (input.bypassDuplicateWarning && overriddenCandidates.length > 0) {
      await logAuditEvent({
        userId: context?.userId,
        action: 'PATIENT_DUPLICATE_OVERRIDDEN',
        entityType: 'Patient',
        entityId: patient.patientId,
        details: {
          patientId: patient.patientId,
          matchedCandidateCount: overriddenCandidates.length,
          matchedCandidateMRNs: overriddenCandidates.map((c) => c.patientId),
          overrideConfirmation: 'Staff explicitly confirmed this is a distinct individual and bypassed duplicate warning',
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    return patient;
  });
}

export async function getPatientById(id: string) {
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id }, { patientId: id }],
    },
    include: {
      appointments: {
        take: 10,
        orderBy: { scheduledStart: 'desc' },
        include: {
          equipment: {
            select: { id: true, name: true, location: true },
          },
          imagingOrder: {
            select: { id: true, accessionNumber: true, orderStatus: true, examinationName: true },
          },
        },
      },
      imagingOrders: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          referringDoctor: {
            select: { id: true, name: true, organization: true },
          },
          appointment: {
            select: { id: true, scheduledStart: true, status: true, tokenNumber: true },
          },
        },
      },
    },
  });

  if (!patient) {
    throw AppError.notFound(`Patient not found with ID: ${id}`);
  }

  return patient;
}

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
  context?: { userId?: string; ipAddress?: string; userAgent?: string }
) {
  const existing = await prisma.patient.findFirst({
    where: { OR: [{ id }, { patientId: id }] },
  });

  if (!existing) {
    throw AppError.notFound(`Patient not found with ID: ${id}`);
  }

  let dob: Date | undefined;
  if (input.dateOfBirth) {
    dob = typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : input.dateOfBirth;
    if (isNaN(dob.getTime())) {
      throw AppError.badRequest('Invalid date of birth provided');
    }
    if (dob > new Date()) {
      throw AppError.badRequest('Date of birth cannot be in the future');
    }
  }

  const composedAddress =
    input.addressLine1 !== undefined || input.city !== undefined || input.state !== undefined
      ? [
          input.addressLine1 ?? existing.addressLine1,
          input.addressLine2 ?? existing.addressLine2,
          input.city ?? existing.city,
          input.state ?? existing.state,
          input.postalCode ?? existing.postalCode,
        ]
          .filter(Boolean)
          .join(', ')
      : undefined;

  const updated = await prisma.patient.update({
    where: { id: existing.id },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.middleName !== undefined ? { middleName: input.middleName ? input.middleName.trim() : null } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(dob ? { dateOfBirth: dob } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.alternatePhone !== undefined ? { alternatePhone: input.alternatePhone ? input.alternatePhone.trim() : null } : {}),
      ...(input.email !== undefined ? { email: input.email ? input.email.trim().toLowerCase() : null } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
      ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
      ...(input.emergencyContactRelation !== undefined ? { emergencyContactRelation: input.emergencyContactRelation } : {}),
      ...(composedAddress ? { address: composedAddress } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'PATIENT_UPDATED',
    entityType: 'Patient',
    entityId: updated.patientId,
    details: {
      patientId: updated.patientId,
      updatedFields: Object.keys(input),
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

export async function listPatients(params: ListPatientsQuery) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const search = params.search?.trim();
  const where: Prisma.PatientWhereInput = search
    ? {
        OR: [
          { patientId: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const sortBy = params.sortBy === 'lastName' || params.sortBy === 'firstName' || params.sortBy === 'createdAt'
    ? params.sortBy
    : 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, items] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            appointments: true,
            imagingOrders: true,
          },
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

import { prisma } from '../config/db';
import { generateAccessionNumber } from '../utils/identifierGenerator';
import { PaginationMeta } from '../types/api.types';
import { ModalityType, OrderStatus } from '@prisma/client';

export interface GetOrdersQuery {
  page?: number;
  limit?: number;
  modality?: ModalityType;
  status?: OrderStatus;
  search?: string;
}

export async function listOrders(params: GetOrdersQuery) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const where = {
    ...(params.modality ? { modality: params.modality } : {}),
    ...(params.status ? { orderStatus: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { accessionNumber: { contains: params.search, mode: 'insensitive' as const } },
            { patient: { firstName: { contains: params.search, mode: 'insensitive' as const } } },
            { patient: { lastName: { contains: params.search, mode: 'insensitive' as const } } },
            { patient: { patientId: { contains: params.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.imagingOrder.count({ where }),
    prisma.imagingOrder.findMany({
      where,
      skip,
      take: limit,
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
          },
        },
        appointment: {
          select: {
            id: true,
            appointmentNumber: true,
            scheduledStartTime: true,
            status: true,
            location: true,
          },
        },
        study: {
          select: {
            id: true,
            studyStatus: true,
            pacsStatus: true,
            instanceCount: true,
          },
        },
        report: {
          select: {
            id: true,
            status: true,
            finalizedAt: true,
          },
        },
      },
    }),
  ]);

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };

  return { orders, meta };
}

export function previewNextAccessionNumber(): string {
  return generateAccessionNumber();
}

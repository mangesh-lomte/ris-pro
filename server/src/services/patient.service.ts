import { prisma } from '../config/db';
import { generatePatientId } from '../utils/identifierGenerator';
import { PaginationMeta } from '../types/api.types';

export interface GetPatientsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export async function listPatients(params: GetPatientsQuery) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const where = params.search
    ? {
        OR: [
          { patientId: { contains: params.search, mode: 'insensitive' as const } },
          { firstName: { contains: params.search, mode: 'insensitive' as const } },
          { lastName: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search } },
        ],
      }
    : {};

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
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

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };

  return { patients, meta };
}

export function previewNextPatientId(): string {
  return generatePatientId();
}

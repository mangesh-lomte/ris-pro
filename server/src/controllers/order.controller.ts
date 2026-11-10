import { Request, Response } from 'express';
import { z } from 'zod';
import {
  ModalityType,
  OrderStatus,
  Priority,
  AuthorizationStatus,
  PayerType,
} from '@prisma/client';
import {
  createOrder,
  getOrderById,
  updateOrder,
  listOrders,
  getOrderTimeline,
  syncOrderToModalityWorklist,
  importHisOrder,
} from '../services/order.service';
import { generateAccessionNumber } from '../utils/identifierGenerator';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const orderQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  modality: z.nativeEnum(ModalityType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  orderStatus: z.nativeEnum(OrderStatus).optional(),
  patientId: z.string().optional(),
  accessionNumber: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const createOrderSchema = z.object({
  patientId: z.string().min(1, 'Patient identifier is required'),
  modality: z.nativeEnum(ModalityType, {
    errorMap: () => ({ message: 'Valid modality is required (CT, MRI, XRAY)' }),
  }),
  bodyPart: z.string().trim().min(1, 'Body part is required'),
  examinationName: z
    .string()
    .trim()
    .min(2, 'Examination name must be 2-150 characters')
    .max(150, 'Examination name cannot exceed 150 characters'),
  clinicalIndication: z
    .string()
    .trim()
    .min(3, 'Clinical indication must be at least 3 characters')
    .max(2000, 'Clinical indication cannot exceed 2000 characters'),
  referringDoctorId: z.string().optional(),
  referringDoctorText: z.string().trim().optional(),
  contrastRequired: z.boolean().default(false),
  priority: z.nativeEnum(Priority).default(Priority.ROUTINE),
  payerType: z.nativeEnum(PayerType).optional(),
  payerName: z.string().trim().optional(),
  memberId: z.string().trim().optional(),
  authorizationRequired: z.boolean().optional(),
  authorizationStatus: z.nativeEnum(AuthorizationStatus).optional(),
  authorizationCode: z.string().trim().optional(),
  insuranceNotes: z.string().trim().optional(),
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  orderStatus: z.nativeEnum(OrderStatus).optional(),
});

export async function getOrders(req: Request, res: Response): Promise<Response> {
  const page = typeof req.query.page === 'number' ? req.query.page : 1;
  const pageSize =
    typeof req.query.pageSize === 'number'
      ? req.query.pageSize
      : typeof req.query.limit === 'number'
      ? req.query.limit
      : 20;

  const result = await listOrders({
    page,
    pageSize,
    modality: req.query.modality as ModalityType | undefined,
    priority: req.query.priority as Priority | undefined,
    status: (req.query.status || req.query.orderStatus) as OrderStatus | undefined,
    patientId: req.query.patientId as string | undefined,
    accessionNumber: req.query.accessionNumber as string | undefined,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });

  return sendSuccess(res, result, 'Imaging orders retrieved successfully');
}

export async function getOrder(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Order ID or Accession Number is required');

  const order = await getOrderById(id);
  return sendSuccess(res, order, 'Imaging order retrieved successfully');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const order = await createOrder(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, order, 'Imaging order created with unique accession number', 201);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Order ID parameter is required');

  const order = await updateOrder(id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, order, 'Imaging order updated successfully');
}

export async function generateAccessionPreview(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as string | undefined;
  const accessionNumber = generateAccessionNumber(modality);
  return sendSuccess(
    res,
    {
      accessionNumber,
      format: 'ACC-YYYYMMDD-[MOD]-XXXX',
      description: 'Unique Accession Number maintaining DICOM, PACS and diagnostic report traceability',
    },
    'Generated unique Accession Number'
  );
}

export async function trackOrder(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Order ID or Accession Number is required');

  const timeline = await getOrderTimeline(id);
  return sendSuccess(res, timeline, 'Order status tracking timeline retrieved');
}

export async function syncMwl(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Order ID or Accession Number is required');

  const result = await syncOrderToModalityWorklist(id, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Order synchronized to DICOM Modality Worklist (MWL)');
}

export async function importHis(req: Request, res: Response): Promise<Response> {
  const result = await importHisOrder(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'HIS / EMR order ingested successfully', 201);
}

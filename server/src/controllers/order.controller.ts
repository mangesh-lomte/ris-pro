import { Request, Response } from 'express';
import { z } from 'zod';
import { ModalityType, OrderStatus } from '@prisma/client';
import { listOrders, previewNextAccessionNumber } from '../services/order.service';
import { sendSuccess } from '../utils/apiResponse';

export const orderQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  modality: z.nativeEnum(ModalityType).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().optional(),
});

export async function getOrders(req: Request, res: Response): Promise<Response> {
  const page = typeof req.query.page === 'number' ? req.query.page : 1;
  const limit = typeof req.query.limit === 'number' ? req.query.limit : 10;
  const modality = req.query.modality as ModalityType | undefined;
  const status = req.query.status as OrderStatus | undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const { orders, meta } = await listOrders({ page, limit, modality, status, search });
  return sendSuccess(res, orders, 'Imaging orders retrieved successfully', 200, meta);
}

export async function generateAccessionPreview(_req: Request, res: Response): Promise<Response> {
  const accessionNumber = previewNextAccessionNumber();
  return sendSuccess(
    res,
    {
      accessionNumber,
      format: 'ACC-YYYYMMDD-XXXX',
      description: 'Unique Accession Number maintaining DICOM, PACS and diagnostic report traceability',
    },
    'Generated unique Accession Number'
  );
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { listPatients, previewNextPatientId } from '../services/patient.service';
import { sendSuccess } from '../utils/apiResponse';

export const patientQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
});

export async function getPatients(req: Request, res: Response): Promise<Response> {
  const page = typeof req.query.page === 'number' ? req.query.page : 1;
  const limit = typeof req.query.limit === 'number' ? req.query.limit : 10;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const { patients, meta } = await listPatients({ page, limit, search });
  return sendSuccess(res, patients, 'Patients retrieved successfully', 200, meta);
}

export async function generateIdPreview(_req: Request, res: Response): Promise<Response> {
  const patientId = previewNextPatientId();
  return sendSuccess(
    res,
    { patientId, format: 'PAT-YYYY-XXXXX', description: 'Persistent Master Patient Index identifier' },
    'Generated persistent Patient ID'
  );
}

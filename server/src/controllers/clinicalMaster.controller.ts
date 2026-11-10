import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ModalityType } from '@prisma/client';
import { sendSuccess } from '../utils/apiResponse';

export async function getReferringDoctors(req: Request, res: Response): Promise<Response> {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  const doctors = await prisma.referringDoctor.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { organization: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  return sendSuccess(res, doctors, 'Referring doctors retrieved');
}

export async function getExamDefinitions(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as ModalityType | undefined;

  const exams = await prisma.examDefinition.findMany({
    where: {
      isActive: true,
      ...(modality ? { modality } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return sendSuccess(res, exams, 'Exam definitions retrieved');
}

export async function getEquipment(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as ModalityType | undefined;

  const equipment = await prisma.equipment.findMany({
    where: {
      ...(modality ? { modality } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return sendSuccess(res, equipment, 'Equipment list retrieved');
}


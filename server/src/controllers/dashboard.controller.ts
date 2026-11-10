import { Request, Response } from 'express';
import { getDashboardOverview, searchDashboard } from '../services/dashboard.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { UserRole } from '@prisma/client';

export async function getDashboardOverviewHandler(req: Request, res: Response): Promise<Response> {
  const userRole = (req.user?.role as UserRole) || UserRole.RECEPTION;
  const overview = await getDashboardOverview(userRole);
  return sendSuccess(res, overview, 'Dashboard overview retrieved successfully');
}

export async function searchDashboardHandler(req: Request, res: Response): Promise<Response> {
  const query = req.query.q as string;
  if (!query || typeof query !== 'string') {
    throw AppError.badRequest('Search query "q" parameter is required');
  }

  const userRole = (req.user?.role as UserRole) || UserRole.RECEPTION;
  const results = await searchDashboard(query, userRole);
  return sendSuccess(res, results, 'Search results retrieved successfully');
}


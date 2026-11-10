import { Request, Response } from 'express';
import { checkSystemHealth } from '../services/health.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getHealth(_req: Request, res: Response): Promise<Response> {
  const healthData = await checkSystemHealth();
  const statusCode = healthData.status === 'healthy' ? 200 : 503;
  return sendSuccess(res, healthData, 'System health check completed successfully', statusCode);
}


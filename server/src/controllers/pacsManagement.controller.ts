import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  getReceivedStudiesWorklist,
  getDicomViewerLaunchContext,
  getAutoMatchedPriorStudies,
  applyDicomRoutingRules,
  getPacsStorageTiers,
  getPacsStorageCapacityMonitor,
  importExternalDicomMedia,
  exportAnonymizedDicomStudy,
  verifyStudyCompleteness,
  getPacsNodesConnectivityMonitor,
} from '../services/pacsManagement.service';

/**
 * 1. Received studies worklist
 */
export async function getReceivedStudies(req: Request, res: Response): Promise<Response> {
  const result = await getReceivedStudiesWorklist({
    modality: req.query.modality as any,
    date: req.query.date as string,
  });
  return sendSuccess(res, result, 'Received studies worklist retrieved');
}

/**
 * 2. DICOM viewer launch context
 */
export async function getViewerLaunch(req: Request, res: Response): Promise<Response> {
  const { studyUid } = req.params;
  if (!studyUid) throw AppError.badRequest('studyUid is required');

  const result = await getDicomViewerLaunchContext(studyUid);
  return sendSuccess(res, result, 'DICOM viewer launch context retrieved');
}

/**
 * 3. Prior study auto-matching
 */
export async function getPriorStudies(req: Request, res: Response): Promise<Response> {
  const { identifier } = req.params;
  if (!identifier) throw AppError.badRequest('Patient ID or Accession is required');

  const result = await getAutoMatchedPriorStudies(identifier);
  return sendSuccess(res, result, 'Prior studies auto-matched for comparison');
}

/**
 * 4. DICOM routing rules
 */
export async function routeStudy(req: Request, res: Response): Promise<Response> {
  const { identifier } = req.params;
  if (!identifier) throw AppError.badRequest('Accession number or study UID is required');

  const result = await applyDicomRoutingRules(identifier, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'DICOM routing rules evaluated and specialist worklist assigned');
}

/**
 * 5. Storage & archive status (hot, nearline, cold)
 */
export async function getStorageTiers(_req: Request, res: Response): Promise<Response> {
  const tiers = await getPacsStorageTiers();
  return sendSuccess(res, tiers, 'PACS storage archive tiers telemetry retrieved');
}

/**
 * 6. Storage capacity monitor
 */
export async function getCapacityMonitor(_req: Request, res: Response): Promise<Response> {
  const capacity = await getPacsStorageCapacityMonitor();
  return sendSuccess(res, capacity, 'PACS disk capacity and volume health retrieved');
}

/**
 * 7. DICOM import from external media
 */
export async function importExternalMedia(req: Request, res: Response): Promise<Response> {
  const result = await importExternalDicomMedia(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'External DICOM media successfully ingested', 201);
}

/**
 * 8. DICOM export / anonymize
 */
export async function exportStudy(req: Request, res: Response): Promise<Response> {
  const { studyUid } = req.params;
  if (!studyUid) throw AppError.badRequest('studyUid is required');

  const result = await exportAnonymizedDicomStudy(studyUid, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'DICOM export package prepared');
}

/**
 * 9. Study integrity / completeness verification
 */
export async function checkCompleteness(req: Request, res: Response): Promise<Response> {
  const { studyUid } = req.params;
  if (!studyUid) throw AppError.badRequest('studyUid is required');

  const result = await verifyStudyCompleteness(studyUid);
  return sendSuccess(res, result, 'DICOM study integrity and completeness verified');
}

/**
 * 10. PACS server connectivity monitor
 */
export async function getNodesMonitor(_req: Request, res: Response): Promise<Response> {
  const monitor = await getPacsNodesConnectivityMonitor();
  return sendSuccess(res, monitor, 'PACS network nodes connectivity status retrieved');
}


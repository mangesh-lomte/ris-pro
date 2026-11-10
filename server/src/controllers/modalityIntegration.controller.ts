import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  queryModalityWorklist,
  getModalityConfigs,
  saveModalityConfig,
  receiveCStoreDicom,
  processMppsEvent,
  verifyStorageCommitment,
  matchStudyToOrder,
  getFailedTransfersQueue,
  retryFailedTransfer,
  getScannerStatusMonitor,
  captureRadiationDose,
  getOrderDoseSummary,
  reconcileUnscheduledEmergencyScan,
  queryDicomWebStudies,
  getDicomWebStudyInstances,
  processHl7Message,
  exportFhirImagingStudy,
} from '../services/modalityIntegration.service';

/**
 * 1. Modality Worklist (MWL)
 */
export async function getMwl(req: Request, res: Response): Promise<Response> {
  const result = await queryModalityWorklist({
    modality: req.query.modality as any,
    date: req.query.date as string,
    stationAETitle: req.query.stationAETitle as string,
  });
  return sendSuccess(res, result, 'Modality Worklist (MWL) dataset retrieved');
}

/**
 * 2. AE Title / IP / Port config
 */
export async function getConfigs(_req: Request, res: Response): Promise<Response> {
  const configs = await getModalityConfigs();
  return sendSuccess(res, configs, 'DICOM modality configuration nodes retrieved');
}

export async function saveConfig(req: Request, res: Response): Promise<Response> {
  const config = await saveModalityConfig(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, config, 'DICOM modality node configured successfully', 201);
}

/**
 * 3. C-STORE image receive
 */
export async function receiveCStore(req: Request, res: Response): Promise<Response> {
  const result = await receiveCStoreDicom(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'C-STORE DICOM instances received and associated with accession', 201);
}

/**
 * 4. MPPS
 */
export async function mppsUpdate(req: Request, res: Response): Promise<Response> {
  const result = await processMppsEvent(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'MPPS procedure step state processed');
}

/**
 * 5. Storage Commitment
 */
export async function storageCommitment(req: Request, res: Response): Promise<Response> {
  const result = await verifyStorageCommitment(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'DICOM Storage Commitment verification completed');
}

/**
 * 6. Study / accession matching
 */
export async function matchStudy(req: Request, res: Response): Promise<Response> {
  const { accessionNumber, studyInstanceUid } = req.body;
  if (!accessionNumber || !studyInstanceUid) {
    throw AppError.badRequest('accessionNumber and studyInstanceUid are required');
  }

  const result = await matchStudyToOrder(accessionNumber, studyInstanceUid, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'DICOM study matched and linked to order accession');
}

/**
 * 7. Failed-transfer retry queue
 */
export async function getFailedTransfers(_req: Request, res: Response): Promise<Response> {
  const queue = await getFailedTransfersQueue();
  return sendSuccess(res, queue, 'Failed-transfer retry queue retrieved');
}

export async function retryTransfer(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Transfer ID is required');

  const result = await retryFailedTransfer(id, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Transfer re-queued and re-transmitted');
}

/**
 * 8. Scanner status monitor
 */
export async function getScannerMonitor(_req: Request, res: Response): Promise<Response> {
  const status = await getScannerStatusMonitor();
  return sendSuccess(res, status, 'Live scanner operational telemetry retrieved');
}

/**
 * 9. Radiation dose capture (RDSR)
 */
export async function captureDose(req: Request, res: Response): Promise<Response> {
  const result = await captureRadiationDose(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Radiation dose (RDSR) captured and logged', 201);
}

export async function getDoseSummary(req: Request, res: Response): Promise<Response> {
  const { accession } = req.params;
  if (!accession) throw AppError.badRequest('Accession number is required');

  const result = await getOrderDoseSummary(accession);
  return sendSuccess(res, result, 'Radiation dose metrics retrieved');
}

/**
 * 10. Unscheduled / emergency scan match
 */
export async function reconcileUnscheduled(req: Request, res: Response): Promise<Response> {
  const result = await reconcileUnscheduledEmergencyScan(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'Unscheduled emergency scan auto-reconciled with Accession Number', 201);
}

/**
 * 11. DICOMweb query (QIDO-RS / WADO-RS)
 */
export async function dicomWebStudies(req: Request, res: Response): Promise<Response> {
  const result = await queryDicomWebStudies(req.query as any);
  return res.status(200).json(result);
}

export async function dicomWebInstances(req: Request, res: Response): Promise<Response> {
  const { studyUid } = req.params;
  if (!studyUid) throw AppError.badRequest('studyUid is required');

  const result = await getDicomWebStudyInstances(studyUid);
  return sendSuccess(res, result, 'DICOMweb WADO-RS instances metadata retrieved');
}

/**
 * 12. HL7 / FHIR order adapter
 */
export async function handleHl7Message(req: Request, res: Response): Promise<Response> {
  const rawHl7 = req.body?.rawMessage || req.body?.message || (typeof req.body === 'string' ? req.body : '');
  if (!rawHl7) throw AppError.badRequest('Raw HL7 message string is required');

  const result = await processHl7Message(rawHl7, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return sendSuccess(res, result, 'HL7 message processed successfully', 201);
}

export async function getFhirImagingStudy(req: Request, res: Response): Promise<Response> {
  const { accession } = req.params;
  if (!accession) throw AppError.badRequest('Accession number is required');

  const result = await exportFhirImagingStudy(accession);
  return res.status(200).json(result);
}

import { Request, Response } from 'express';
import { ExternalShareService } from '../services/externalShare.service';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/appError';

export class ExternalShareController {
  /**
   * POST /api/v1/external-shares
   * Create a new secure time-limited share
   */
  static createShare = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const {
      orderId,
      shareType,
      recipientName,
      recipientEmail,
      recipientPhone,
      recipientRole,
      institutionName,
      durationDays,
      includeDicom,
      includeReportPdf,
      includeWebViewer,
      requiresOtp,
      consentPurpose,
      consentedBy,
      consentedByRelation,
      consentNotes,
    } = req.body;

    if (!orderId || !recipientName) {
      throw AppError.badRequest('orderId and recipientName are required parameters.');
    }

    const share = await ExternalShareService.createShare(
      {
        orderId,
        shareType: shareType || 'PATIENT_LINK',
        recipientName,
        recipientEmail,
        recipientPhone,
        recipientRole,
        institutionName,
        durationDays: durationDays ? Number(durationDays) : 7,
        includeDicom,
        includeReportPdf,
        includeWebViewer,
        requiresOtp,
        consentPurpose,
        consentedBy,
        consentedByRelation,
        consentNotes,
      },
      actorId,
      req.ip,
      req.headers['user-agent']
    );

    sendSuccess(res, share, 'External share created successfully', 201);
  });

  /**
   * POST /api/v1/external-shares/:token/verify-otp
   * Recipient OTP verification
   */
  static verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const shareToken = req.params.token;
    const { otpCode } = req.body;

    if (!otpCode) {
      throw AppError.badRequest('otpCode is required.');
    }

    const result = await ExternalShareService.verifyOtp({
      shareToken,
      otpCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, result, result.message, 200);
  });

  /**
   * GET /api/v1/external-shares/:token/context
   * Get shared study metadata and capabilities
   */
  static getSharedContext = asyncHandler(async (req: Request, res: Response) => {
    const shareToken = req.params.token;
    const context = await ExternalShareService.getSharedStudyContext(
      shareToken,
      req.ip,
      req.headers['user-agent']
    );

    sendSuccess(res, context, 'Shared study context retrieved', 200);
  });

  /**
   * GET /api/v1/external-shares/:token/report-pdf
   * Download finalized report PDF
   */
  static getSharedReportPdf = asyncHandler(async (req: Request, res: Response) => {
    const shareToken = req.params.token;
    const { pdfBuffer, filename } = await ExternalShareService.getSharedReportPdf(
      shareToken,
      req.ip,
      req.headers['user-agent']
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  /**
   * GET /api/v1/external-shares/:token/dicom-package
   * Download authenticated DICOM archive
   */
  static getSharedDicomPackage = asyncHandler(async (req: Request, res: Response) => {
    const shareToken = req.params.token;
    const { zipBuffer, filename } = await ExternalShareService.getSharedDicomPackage(
      shareToken,
      req.ip,
      req.headers['user-agent']
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  });

  /**
   * POST /api/v1/external-shares/:id/revoke
   * Manually revoke an active share
   */
  static revokeShare = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const shareIdOrToken = req.params.id;
    const { reason } = req.body;

    const revoked = await ExternalShareService.revokeShare(
      shareIdOrToken,
      reason,
      actorId,
      req.ip,
      req.headers['user-agent']
    );

    sendSuccess(res, revoked, 'External share revoked successfully', 200);
  });

  /**
   * POST /api/v1/external-shares/:id/consent
   * Record patient consent for share
   */
  static recordConsent = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const { purpose, consentedBy, consentedByRelation, notes } = req.body;

    const share = await ExternalShareService.createShare(
      {
        orderId: req.body.orderId,
        shareType: 'PATIENT_LINK',
        recipientName: consentedBy || 'Self',
        consentPurpose: purpose,
        consentedBy,
        consentedByRelation,
        consentNotes: notes,
      },
      actorId,
      req.ip,
      req.headers['user-agent']
    );

    sendSuccess(res, share, 'Patient consent recorded successfully', 200);
  });

  /**
   * POST /api/v1/external-shares/transfers
   * Queue large file transfer
   */
  static initiateTransfer = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const { orderId, shareId, destination, packageType, totalFiles, totalBytes, simulateFailure } = req.body;

    if (!orderId || !destination) {
      throw AppError.badRequest('orderId and destination are required.');
    }

    const transfer = await ExternalShareService.initiateLargeFileTransfer(
      { orderId, shareId, destination, packageType, totalFiles, totalBytes, simulateFailure },
      actorId
    );

    sendSuccess(res, transfer, 'Large file transfer initiated', 201);
  });

  /**
   * POST /api/v1/external-shares/transfers/:id/retry
   * Retry failed file transfer
   */
  static retryTransfer = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const transferId = req.params.id;

    const retried = await ExternalShareService.retryLargeFileTransfer(transferId, actorId);
    sendSuccess(res, retried, 'Transfer retry initiated', 200);
  });

  /**
   * POST /api/v1/external-shares/imports
   * Receive external DICOM study
   */
  static receiveImport = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const {
      sourceInstitution,
      modality,
      studyDate,
      studyDescription,
      patientNameRaw,
      patientIdRaw,
      patientDobRaw,
      patientGenderRaw,
      accessionRaw,
      studyInstanceUid,
      numberOfInstances,
      fileSize,
    } = req.body;

    if (!sourceInstitution || !modality || !patientNameRaw || !studyInstanceUid) {
      throw AppError.badRequest('sourceInstitution, modality, patientNameRaw, and studyInstanceUid are required.');
    }

    const imported = await ExternalShareService.receiveOutsideDicomImport(
      {
        sourceInstitution,
        modality,
        studyDate,
        studyDescription,
        patientNameRaw,
        patientIdRaw,
        patientDobRaw,
        patientGenderRaw,
        accessionRaw,
        studyInstanceUid,
        numberOfInstances,
        fileSize,
      },
      actorId
    );

    sendSuccess(res, imported, 'Outside DICOM study imported successfully', 201);
  });

  /**
   * POST /api/v1/external-shares/imports/:id/reconcile
   * Reconcile or reject external study
   */
  static reconcileImport = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id || 'admin-seed-id';
    const importId = req.params.id;
    const { matchedPatientId, matchedOrderId, reconciliationNotes, reject } = req.body;

    if (!reject && !matchedPatientId) {
      throw AppError.badRequest('matchedPatientId is required to reconcile external study.');
    }

    const reconciled = await ExternalShareService.reconcileOutsideStudyImport(
      importId,
      { matchedPatientId, matchedOrderId, reconciliationNotes, reject: Boolean(reject) },
      actorId
    );

    sendSuccess(res, reconciled, reject ? 'Import rejected' : 'Import reconciled successfully', 200);
  });

  /**
   * GET /api/v1/external-shares
   * List all shares
   */
  static listShares = asyncHandler(async (req: Request, res: Response) => {
    const { status, patientId, search } = req.query;
    const shares = await ExternalShareService.listShares({
      status: status as string,
      patientId: patientId as string,
      search: search as string,
    });

    sendSuccess(res, shares, 'External shares retrieved', 200);
  });

  /**
   * GET /api/v1/external-shares/imports
   * List outside imports
   */
  static listImports = asyncHandler(async (_req: Request, res: Response) => {
    const imports = await ExternalShareService.listImports();
    sendSuccess(res, imports, 'Outside imports retrieved', 200);
  });

  /**
   * GET /api/v1/external-shares/transfers
   * List large file transfers
   */
  static listTransfers = asyncHandler(async (_req: Request, res: Response) => {
    const transfers = await ExternalShareService.listTransfers();
    sendSuccess(res, transfers, 'Large file transfers retrieved', 200);
  });

  /**
   * GET /api/v1/external-shares/:id/logs
   * Get access logs for audit
   */
  static getShareLogs = asyncHandler(async (req: Request, res: Response) => {
    const shareId = req.params.id;
    const logs = await ExternalShareService.getShareLogs(shareId);
    sendSuccess(res, logs, 'Share access logs retrieved', 200);
  });
}

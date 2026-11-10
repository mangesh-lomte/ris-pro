import { apiClient } from '../lib/api';

export interface ExternalShareRecord {
  id: string;
  shareNumber: string;
  shareToken: string;
  shareType: 'PATIENT_PORTAL' | 'REFERRING_DOCTOR' | 'OUTSIDE_HOSPITAL' | 'LEGAL_AUDIT';
  orderId: string;
  accessionNumber: string;
  patientId: string;
  studyInstanceUid?: string | null;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientRole?: string | null;
  institutionName?: string | null;
  status: 'ACTIVE' | 'ACCESSED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  requiresOtp: boolean;
  otpCode?: string | null;
  otpVerified: boolean;
  includeDicom: boolean;
  includeReportPdf: boolean;
  includeWebViewer: boolean;
  viewCount: number;
  downloadCount: number;
  lastAccessedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    accessionNumber: string;
    modality: string;
    examinationName: string;
    bodyPart?: string | null;
    patient?: {
      firstName: string;
      lastName: string;
      patientId: string;
      gender?: string | null;
      dateOfBirth?: string | null;
    };
    report?: {
      id: string;
      status: string;
      isLocked: boolean;
      finalizedAt?: string | null;
    } | null;
  };
  consent?: {
    id: string;
    purpose: string;
    consentedBy: string;
    relationToPatient: string;
    consentDate: string;
    status: string;
  } | null;
}

export interface LargeFileTransferRecord {
  id: string;
  transferNumber: string;
  imagingOrderId: string;
  accessionNumber: string;
  studyInstanceUid?: string | null;
  targetSystem: string;
  transferProtocol: 'DICOM_DIR' | 'C_STORE' | 'TLS_HTTPS' | 'WADO_RS';
  totalSizeBytes?: number | null;
  transferredBytes?: number | null;
  progressPercent: number;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  retryCount: number;
  maxRetries: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    accessionNumber: string;
    modality: string;
    examinationName: string;
    patient?: {
      firstName: string;
      lastName: string;
      patientId: string;
    };
  };
}

export interface OutsideStudyImportRecord {
  id: string;
  importNumber: string;
  studyInstanceUid: string;
  patientName: string;
  patientIdOutside?: string | null;
  accessionOutside?: string | null;
  modality: string;
  studyDescription?: string | null;
  studyDate?: string | null;
  seriesCount?: number | null;
  instancesCount?: number | null;
  sourceFacility: string;
  status: 'RECEIVED' | 'MATCHED' | 'UNMATCHED' | 'RECONCILED' | 'REJECTED';
  matchedPatientId?: string | null;
  reconciledOrderId?: string | null;
  reconciledByUserId?: string | null;
  reconciledAt?: string | null;
  rejectionReason?: string | null;
  storagePath?: string | null;
  createdAt: string;
  updatedAt: string;
  matchedPatient?: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
  } | null;
  reconciledOrder?: {
    id: string;
    accessionNumber: string;
    examinationName: string;
  } | null;
}

export interface ShareAccessLogRecord {
  id: string;
  shareId: string;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  failureReason?: string | null;
  createdAt: string;
}

export interface CreateSharePayload {
  orderId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientRole?: string;
  institutionName?: string;
  shareType?: 'PATIENT_PORTAL' | 'REFERRING_DOCTOR' | 'OUTSIDE_HOSPITAL' | 'LEGAL_AUDIT';
  durationDays?: number;
  requiresOtp?: boolean;
  includeDicom?: boolean;
  includeReportPdf?: boolean;
  includeWebViewer?: boolean;
  notes?: string;
  consentPurpose?: string;
  consentedBy?: string;
  relationToPatient?: string;
}

export interface SharedStudyPublicContext {
  requiresVerification: boolean;
  shareNumber: string;
  shareType: string;
  recipientName: string;
  recipientRole?: string | null;
  institutionName?: string | null;
  expiresAt: string;
  message?: string;
  patient?: {
    name: string;
    patientId: string;
    gender?: string | null;
    dateOfBirth?: string | null;
  };
  examination?: {
    accessionNumber: string;
    modality: string;
    examinationName: string;
    bodyPart?: string | null;
    clinicalIndication?: string | null;
    studyInstanceUid?: string | null;
  };
  capabilities?: {
    includeDicom: boolean;
    includeReportPdf: boolean;
    includeWebViewer: boolean;
  };
  webViewerUrl?: string | null;
  reportSummary?: {
    reportNumber: string;
    status: string;
    finalizedAt?: string | null;
    signedBy?: string | null;
    findings?: string | null;
    impression?: string | null;
  } | null;
  consent?: {
    purpose: string;
    consentedBy: string;
    consentDate: string;
  } | null;
}

export const externalShareService = {
  // 1. List active shares with filters
  async listShares(params?: {
    status?: string;
    shareType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ExternalShareRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.shareType) query.append('shareType', params.shareType);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await apiClient<{ items: ExternalShareRecord[]; total: number }>(
      `/external-shares?${query.toString()}`
    );
    return res.data;
  },

  // 2. Create new secure external share
  async createShare(payload: CreateSharePayload): Promise<ExternalShareRecord> {
    const res = await apiClient<ExternalShareRecord>('/external-shares', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  // 3. Revoke active share
  async revokeShare(id: string, reason: string): Promise<ExternalShareRecord> {
    const res = await apiClient<ExternalShareRecord>(`/external-shares/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },

  // 4. Public recipient context resolution
  async getSharedStudyContext(token: string): Promise<SharedStudyPublicContext> {
    const res = await apiClient<SharedStudyPublicContext>(`/external-shares/${token}/context`);
    return res.data;
  },

  // 5. Public recipient OTP verification
  async verifyOtp(token: string, otpCode: string): Promise<{ verified: boolean; message: string }> {
    const res = await apiClient<{ verified: boolean; message: string }>(
      `/external-shares/${token}/verify-otp`,
      {
        method: 'POST',
        body: JSON.stringify({ otpCode }),
      }
    );
    return res.data;
  },

  // 6. Direct download links
  getSharedReportPdfUrl(token: string): string {
    return `/api/v1/external-shares/${token}/report-pdf`;
  },

  getSharedDicomPackageUrl(token: string): string {
    return `/api/v1/external-shares/${token}/dicom-package`;
  },

  // 7. Large File Transfers
  async listTransfers(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: LargeFileTransferRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await apiClient<{ items: LargeFileTransferRecord[]; total: number }>(
      `/external-shares/transfers?${query.toString()}`
    );
    return res.data;
  },

  async initiateTransfer(payload: {
    orderId: string;
    targetSystem: string;
    transferProtocol: 'DICOM_DIR' | 'C_STORE' | 'TLS_HTTPS' | 'WADO_RS';
    simulateFailure?: boolean;
  }): Promise<LargeFileTransferRecord> {
    const res = await apiClient<LargeFileTransferRecord>('/external-shares/transfers/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async retryTransfer(id: string): Promise<LargeFileTransferRecord> {
    const res = await apiClient<LargeFileTransferRecord>(`/external-shares/transfers/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data;
  },

  // 8. Outside DICOM Imports
  async listImports(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: OutsideStudyImportRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await apiClient<{ items: OutsideStudyImportRecord[]; total: number }>(
      `/external-shares/imports?${query.toString()}`
    );
    return res.data;
  },

  async receiveImport(payload: {
    patientName: string;
    patientIdOutside?: string;
    accessionOutside?: string;
    modality: string;
    studyDescription?: string;
    studyDate?: string;
    sourceFacility: string;
    studyInstanceUid?: string;
    seriesCount?: number;
    instancesCount?: number;
  }): Promise<OutsideStudyImportRecord> {
    const res = await apiClient<OutsideStudyImportRecord>('/external-shares/imports/receive', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async reconcileImport(
    id: string,
    payload: {
      action: 'ATTACH_TO_PATIENT' | 'REJECT';
      patientId?: string;
      notes?: string;
      rejectionReason?: string;
    }
  ): Promise<OutsideStudyImportRecord> {
    const res = await apiClient<OutsideStudyImportRecord>(
      `/external-shares/imports/${id}/reconcile`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  // 9. Audit Logs
  async listAuditLogs(params?: {
    shareId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ShareAccessLogRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.shareId) query.append('shareId', params.shareId);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await apiClient<{ items: ShareAccessLogRecord[]; total: number }>(
      `/external-shares/logs?${query.toString()}`
    );
    return res.data;
  },
};

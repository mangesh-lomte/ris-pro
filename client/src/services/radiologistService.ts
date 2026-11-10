import { apiClient } from '../lib/api';
import {
  RadiologistWorklistData,
  RadiologistWorklistFilters,
  RadiologistStudyContext,
  RadiologistUserOption,
  PriorStudySummary,
  PriorReportDetail,
  ReportWorkspaceData,
  ReportDraftDetail,
  CreateReportDraftPayload,
  SaveReportDraftPayload,
  StudyInstancesResult,
  PeerReviewQueueResponse,
  PeerReviewContextData,
  PeerReviewItem,
  OrderPeerReviewSummary,
  CriticalFindingItem,
  CriticalFindingQueueResponse,
  ClinicianItem,
  CriticalFindingStatus,
} from '../types';

export const radiologistService = {
  /**
   * Fetches the Radiologist Worklist with filtering, sorting, and pagination.
   */
  async getWorklist(filters: RadiologistWorklistFilters = {}): Promise<RadiologistWorklistData> {
    const query = new URLSearchParams();

    if (filters.page) query.append('page', filters.page.toString());
    if (filters.limit) query.append('limit', filters.limit.toString());
    if (filters.modality) query.append('modality', filters.modality);
    if (filters.priority) query.append('priority', filters.priority);
    if (filters.date) query.append('date', filters.date);
    if (filters.assignmentStatus && filters.assignmentStatus !== 'ALL') {
      query.append('assignmentStatus', filters.assignmentStatus);
    }
    if (filters.assignedTo) query.append('assignedTo', filters.assignedTo);
    if (filters.search && filters.search.trim().length > 0) {
      query.append('search', filters.search.trim());
    }

    const endpoint = `/radiologist/worklist${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient<RadiologistWorklistData>(endpoint);
    return response.data;
  },

  /**
   * Fetches comprehensive study context for radiologist worklist modal / review.
   */
  async getStudyContext(identifier: string): Promise<RadiologistStudyContext> {
    const response = await apiClient<RadiologistStudyContext>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}`
    );
    return response.data;
  },

  /**
   * Claims an unassigned study for the current radiologist.
   */
  async claimStudy(identifier: string) {
    const response = await apiClient<{
      orderId: string;
      accessionNumber: string;
      assignment: {
        id: string;
        radiologistUserId: string;
        radiologistName: string;
        assignedAt: string;
        status: string;
      };
    }>(`/radiologist/worklist/${encodeURIComponent(identifier)}/claim`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Admin assigns a study to a specific active radiologist.
   */
  async assignStudy(identifier: string, radiologistUserId: string) {
    const response = await apiClient<{
      orderId: string;
      accessionNumber: string;
      assignment: {
        id: string;
        radiologistUserId: string;
        radiologistName: string;
        assignedBy: string;
        assignedAt: string;
        status: string;
      };
    }>(`/radiologist/worklist/${encodeURIComponent(identifier)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ radiologistUserId }),
    });
    return response.data;
  },

  /**
   * Releases an active assignment.
   */
  async releaseStudy(identifier: string) {
    const response = await apiClient<{
      orderId: string;
      accessionNumber: string;
      assignment: {
        id: string;
        radiologistUserId: string;
        radiologistName: string;
        status: string;
        releasedAt: string | null;
      };
    }>(`/radiologist/worklist/${encodeURIComponent(identifier)}/release`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Fetches active radiologists for assignment dropdown.
   */
  async getActiveRadiologists(): Promise<RadiologistUserOption[]> {
    const response = await apiClient<RadiologistUserOption[]>('/radiologist/radiologists');
    return response.data;
  },

  /**
   * Generates authorized OHIF viewer launch configuration using StudyInstanceUID.
   * Supports optional multi-study comparison with a selected prior study.
   */
  async getViewerLaunch(identifier: string, priorId?: string) {
    const url = priorId
      ? `/radiologist/worklist/${encodeURIComponent(identifier)}/viewer-launch?priorId=${encodeURIComponent(priorId)}`
      : `/radiologist/worklist/${encodeURIComponent(identifier)}/viewer-launch`;
    const response = await apiClient<{
      imagingOrderId: string;
      accessionNumber: string;
      patientId: string;
      studyInstanceUid: string;
      priorOrderId?: string;
      priorAccessionNumber?: string;
      priorStudyInstanceUid?: string;
      viewerUrl: string;
      isMultiStudy?: boolean;
    }>(url);
    return response.data;
  },

  /**
   * Fetches prior studies for an imaging order.
   */
  async getPriorStudies(identifier: string): Promise<PriorStudySummary[]> {
    const response = await apiClient<PriorStudySummary[]>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/priors`
    );
    return response.data;
  },

  /**
   * Fetches read-only factual prior report context for an imaging order.
   */
  async getPriorReport(identifier: string, priorId: string): Promise<PriorReportDetail> {
    const response = await apiClient<PriorReportDetail>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/priors/${encodeURIComponent(priorId)}/report`
    );
    return response.data;
  },

  /**
   * Fetches reporting workspace context (order, templates, existing draft).
   */
  async getReportWorkspace(identifier: string): Promise<ReportWorkspaceData> {
    const response = await apiClient<ReportWorkspaceData>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/report`
    );
    return response.data;
  },

  /**
   * Creates an initial draft from a selected template.
   */
  async createReportDraft(
    identifier: string,
    payload: CreateReportDraftPayload
  ): Promise<{ draft: ReportDraftDetail }> {
    const response = await apiClient<{ draft: ReportDraftDetail }>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/report/draft`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Manually saves an existing report draft with concurrency version check.
   */
  async saveReportDraft(
    identifier: string,
    payload: SaveReportDraftPayload
  ): Promise<{ draft: ReportDraftDetail }> {
    const response = await apiClient<{ draft: ReportDraftDetail }>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/report/draft`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Autosaves an existing report draft.
   */
  async autosaveReportDraft(
    identifier: string,
    payload: SaveReportDraftPayload
  ): Promise<{ draft: ReportDraftDetail }> {
    const response = await apiClient<{ draft: ReportDraftDetail }>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/report/draft/autosave`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Phase 4.4 — Dictation Session Lifecycle Audit
   * Records start and stop events for dictation sessions without transmitting audio or transcript.
   */
  async recordDictationSession(
    identifier: string,
    payload: { action: 'START' | 'COMPLETE'; section?: string }
  ): Promise<{ success: boolean; action: string; orderId: string }> {
    const response = await apiClient<{ success: boolean; action: string; orderId: string }>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/report/dictation/session`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Phase 4.5 — Fetches verified DICOM series and instances for current study.
   */
  async getStudyInstances(identifier: string): Promise<StudyInstancesResult> {
    const response = await apiClient<StudyInstancesResult>(
      `/radiologist/worklist/${encodeURIComponent(identifier)}/study-instances`
    );
    return response.data;
  },

  // ==========================================
  // Phase 4.6 — Peer Review / Second Opinion
  // ==========================================

  /**
   * Requests a peer review / second opinion for an eligible study.
   */
  async requestPeerReview(payload: {
    imagingOrderId: string;
    reviewerId: string;
    reason?: string;
  }): Promise<{ id: string }> {
    const response = await apiClient<{ id: string }>(
      '/radiologist/peer-reviews',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Fetches peer review queue for the radiologist.
   */
  async getPeerReviewQueue(filters: {
    status?: string;
    type?: 'assigned' | 'requested' | 'all';
    page?: number;
    limit?: number;
  } = {}): Promise<PeerReviewQueueResponse> {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.type) query.append('type', filters.type);
    if (filters.page) query.append('page', filters.page.toString());
    if (filters.limit) query.append('limit', filters.limit.toString());

    const endpoint = `/radiologist/peer-reviews${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient<PeerReviewQueueResponse>(endpoint);
    return response.data;
  },

  /**
   * Fetches full peer review context for a specific request.
   */
  async getPeerReviewContext(id: string): Promise<PeerReviewContextData> {
    const response = await apiClient<PeerReviewContextData>(
      `/radiologist/peer-reviews/${encodeURIComponent(id)}`
    );
    return response.data;
  },

  /**
   * Reviewer claims a pending peer review request.
   */
  async claimPeerReview(id: string): Promise<PeerReviewItem> {
    const response = await apiClient<PeerReviewItem>(
      `/radiologist/peer-reviews/${encodeURIComponent(id)}/claim`,
      { method: 'POST' }
    );
    return response.data;
  },

  /**
   * Reviewer submits their concise second-opinion response.
   */
  async submitPeerReview(
    id: string,
    payload: { reviewComment: string; decision?: string }
  ): Promise<PeerReviewItem> {
    const response = await apiClient<PeerReviewItem>(
      `/radiologist/peer-reviews/${encodeURIComponent(id)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Requester or admin cancels a pending peer review.
   */
  async cancelPeerReview(id: string): Promise<{ id: string; status: string }> {
    const response = await apiClient<{ id: string; status: string }>(
      `/radiologist/peer-reviews/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' }
    );
    return response.data;
  },

  /**
   * Fetches latest peer review for a study if one exists.
   */
  async getOrderPeerReview(imagingOrderId: string): Promise<OrderPeerReviewSummary | null> {
    const response = await apiClient<OrderPeerReviewSummary | null>(
      `/radiologist/worklist/${encodeURIComponent(imagingOrderId)}/peer-review`
    );
    return response.data;
  },

  // ==========================================
  // Phase 4.7 — Critical Findings Alerts
  // ==========================================

  /**
   * Fetches active clinicians eligible to receive critical finding alerts.
   */
  async getActiveClinicians(): Promise<ClinicianItem[]> {
    const response = await apiClient<ClinicianItem[]>('/radiologist/clinicians');
    return response.data;
  },

  /**
   * Creates and dispatches a critical finding alert.
   */
  async createCriticalFinding(payload: {
    imagingOrderId: string;
    recipientId: string;
    findingText: string;
    severity?: string;
  }): Promise<CriticalFindingItem> {
    const response = await apiClient<CriticalFindingItem>(
      '/radiologist/critical-findings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Fetches critical findings queue / inbox.
   */
  async getCriticalFindingQueue(filters: {
    status?: CriticalFindingStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<CriticalFindingQueueResponse> {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.page) query.append('page', filters.page.toString());
    if (filters.limit) query.append('limit', filters.limit.toString());

    const endpoint = `/radiologist/critical-findings${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient<CriticalFindingQueueResponse>(endpoint);
    return response.data;
  },

  /**
   * Fetches critical finding details by ID.
   */
  async getCriticalFindingById(id: string): Promise<CriticalFindingItem> {
    const response = await apiClient<CriticalFindingItem>(
      `/radiologist/critical-findings/${encodeURIComponent(id)}`
    );
    return response.data;
  },

  /**
   * Acknowledges a critical finding alert.
   */
  async acknowledgeCriticalFinding(id: string, notes?: string): Promise<CriticalFindingItem> {
    const response = await apiClient<CriticalFindingItem>(
      `/radiologist/critical-findings/${encodeURIComponent(id)}/acknowledge`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    );
    return response.data;
  },

  /**
   * Fetches the latest critical finding for an imaging order.
   */
  async getOrderCriticalFinding(imagingOrderId: string): Promise<CriticalFindingItem | null> {
    const response = await apiClient<CriticalFindingItem | null>(
      `/radiologist/worklist/${encodeURIComponent(imagingOrderId)}/critical-finding`
    );
    return response.data;
  },

  // ==========================================
  // Phase 4.8 — Report Corrections & Addenda
  // ==========================================

  /**
   * Phase 4.8 — Fetches immutable version history for a finalized report.
   */
  async getReportVersionHistory(orderId: string): Promise<ReportVersionHistoryResponse> {
    const response = await apiClient<ReportVersionHistoryResponse>(
      `/radiologist/worklist/${encodeURIComponent(orderId)}/report/version-history`
    );
    return response.data;
  },

  /**
   * Phase 4.8 — Creates an auditable correction or addendum for a finalized report.
   */
  async createReportAmendment(
    orderId: string,
    payload: CreateReportAmendmentPayload
  ): Promise<{
    success: boolean;
    amendment: ReportVersionItem;
    currentVersion: number;
    reportStatus: string;
  }> {
    const response = await apiClient<{
      success: boolean;
      amendment: ReportVersionItem;
      currentVersion: number;
      reportStatus: string;
    }>(
      `/radiologist/worklist/${encodeURIComponent(orderId)}/report/amendments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Phase 4.9 — Retrieves report review summary and completeness check.
   */
  async getReportReviewSummary(orderId: string): Promise<ReportReviewSummaryResponse> {
    const response = await apiClient<ReportReviewSummaryResponse>(
      `/radiologist/worklist/${encodeURIComponent(orderId)}/report/review`
    );
    return response.data;
  },

  /**
   * Phase 4.9 — Authorizes, digitally signs, locks, and finalizes a diagnostic report.
   */
  async finalizeAndSignReport(
    orderId: string,
    payload: FinalizeReportPayload
  ): Promise<FinalizeReportResponse> {
    const response = await apiClient<FinalizeReportResponse>(
      `/radiologist/worklist/${encodeURIComponent(orderId)}/report/finalize`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  },

  /**
   * Phase 4.10: Generates an authoritative clinical PDF for a finalized report.
   */
  async generateReportPdf(orderId: string): Promise<GeneratedReportPdfResponse> {
    const response = await apiClient<GeneratedReportPdfResponse>(
      `/radiologist/worklist/${encodeURIComponent(orderId)}/report/pdf`,
      {
        method: 'POST',
      }
    );
    return response.data;
  },

  /**
   * Phase 4.10: Retrieves the clinical PDF blob for download.
   */
  async downloadReportPdf(orderId: string, filename?: string): Promise<void> {
    const token = localStorage.getItem('ris_auth_token') || localStorage.getItem('token');
    const url = `/api/v1/radiologist/worklist/${encodeURIComponent(orderId)}/report/pdf`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to download report PDF (${res.status} ${res.statusText})`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || `Report_${orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};

export interface ReportVersionItem {
  versionNumber: number;
  amendmentType: 'FINAL' | 'CORRECTION' | 'ADDENDUM';
  label: string;
  reason: string;
  findings?: string | null;
  impression?: string | null;
  content?: string | null;
  author: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  isOriginal: boolean;
}

export interface ReportVersionHistoryResponse {
  reportId: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  currentVersion: number;
  reportStatus: string;
  isFinalized: boolean;
  originalFinalizedAt: string | null;
  versions: ReportVersionItem[];
  latestEffectiveContent: {
    findings?: string | null;
    impression?: string | null;
  };
}

export interface CreateReportAmendmentPayload {
  amendmentType: 'CORRECTION' | 'ADDENDUM';
  reason: string;
  content?: string;
  findings?: string;
  impression?: string;
  targetVersion: number;
}

export interface ReportReviewSummaryResponse {
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientDob: string | null;
  patientGender: string;
  modality: string;
  bodyPart: string;
  examinationName: string;
  studyInstanceUid: string | null;
  isFinalized: boolean;
  isLocked: boolean;
  draftVersion: number;
  content: {
    clinicalIndication: string;
    comparison: string;
    findings: string;
    impression: string;
    measurements: any[];
    keyImages: any[];
  };
  completeness: {
    hasFindings: boolean;
    hasImpression: boolean;
    isComplete: boolean;
    missingFields: string[];
  };
  signerPreview: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  legalStatement: string;
}

export interface FinalizeReportPayload {
  draftVersion?: number;
  findings: string;
  impression: string;
  approved: boolean;
  signatureStatement?: string;
}

export interface FinalizeReportResponse {
  reportId: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  status: string;
  version: number;
  findings: string;
  impression: string;
  finalizedAt: string;
  signedAt: string;
  signer: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  isSigned: boolean;
  isLocked: boolean;
  signatureHash: string;
  digitalSignature: any;
}

export interface GeneratedReportPdfResponse {
  success: boolean;
  reportId: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  version: number;
  filename: string;
  fileSizeBytes: number;
  pdfArtifactPath: string;
  generatedAt: string;
  facility: {
    name: string;
    department: string;
    address: string;
    phone: string;
  };
}



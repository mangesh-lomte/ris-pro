import { apiClient } from '../lib/api';
import {
  TechnologistWorklistData,
  TechnologistWorklistFilters,
  TechnologistExamDetail,
  SafetyScreeningContext,
  SaveSafetyScreeningPayload,
  TechnologistSafetyScreening,
  OrderStatus,
  PreparationContext,
  SavePreparationPayload,
  TechnologistPreparation,
  PreparationStatus,
  ConfirmProtocolResult,
  ScanLifecycleContext,
  InterruptScanPayload,
  CancelScanPayload,
  ContrastContext,
  ContrastAdministrationData,
  RecordContrastPayload,
  TechnologistIncidentData,
  RecordIncidentPayload,
  ImageQualityContext,
  AcceptImageQualityPayload,
  ImageQualityDecisionPayload,
  PacsHandoffContext,
  PacsStatusData,
  PacsStudyLookupResponse,
  OrderDocumentData,
  UploadDocumentPayload,
} from '../types';

export const technologistService = {
  /**
   * Fetches the clinical technologist worklist with optional filtering & pagination
   */
  async getWorklist(filters: TechnologistWorklistFilters = {}): Promise<TechnologistWorklistData> {
    const query = new URLSearchParams();

    if (filters.page) query.append('page', filters.page.toString());
    if (filters.pageSize) query.append('pageSize', filters.pageSize.toString());
    if (filters.date) query.append('date', filters.date);
    if (filters.modality && filters.modality !== 'ALL') query.append('modality', filters.modality);
    if (filters.equipmentId && filters.equipmentId !== 'ALL') query.append('equipmentId', filters.equipmentId);
    if (filters.priority && filters.priority !== 'ALL') query.append('priority', filters.priority);
    if (filters.search && filters.search.trim().length > 0) query.append('search', filters.search.trim());

    const queryString = query.toString();
    const endpoint = `/technologist/worklist${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient<TechnologistWorklistData>(endpoint);
    return response.data;
  },

  /**
   * Fetches detailed patient, exam, equipment, and referring physician context for a worklist item
   */
  async getWorklistItem(id: string): Promise<TechnologistExamDetail> {
    const response = await apiClient<TechnologistExamDetail>(`/technologist/worklist/${id}`);
    return response.data;
  },

  /**
   * Loads patient clinical context and existing safety screening data for an exam
   */
  async getSafetyScreening(id: string): Promise<SafetyScreeningContext> {
    const response = await apiClient<SafetyScreeningContext>(`/technologist/worklist/${id}/safety`);
    return response.data;
  },

  /**
   * Submits technologist patient identity verification and modality safety checklist
   */
  async saveSafetyScreening(
    id: string,
    payload: SaveSafetyScreeningPayload
  ): Promise<{
    screening: TechnologistSafetyScreening;
    decision: {
      safetyStatus: string;
      riskFactors: string[];
      cautionNotes: string[];
      requiresClinicalReview: boolean;
      requiresRadiologistReview?: boolean;
    };
    orderStatus: OrderStatus;
  }> {
    const response = await apiClient<{
      screening: TechnologistSafetyScreening;
      decision: {
        safetyStatus: string;
        riskFactors: string[];
        cautionNotes: string[];
        requiresClinicalReview: boolean;
        requiresRadiologistReview?: boolean;
      };
      orderStatus: OrderStatus;
    }>(`/technologist/worklist/${id}/safety`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Loads patient preparation requirements, current readiness checklist, and eligible protocols
   */
  async getPreparation(id: string): Promise<PreparationContext> {
    const response = await apiClient<PreparationContext>(`/technologist/worklist/${id}/preparation`);
    return response.data;
  },

  /**
   * Saves patient preparation checklist (fasting, IV readiness, contrast review, consent)
   */
  async savePreparation(
    id: string,
    payload: SavePreparationPayload
  ): Promise<{
    preparation: TechnologistPreparation;
    preparationStatus: PreparationStatus;
    orderStatus: OrderStatus;
  }> {
    const response = await apiClient<{
      preparation: TechnologistPreparation;
      preparationStatus: PreparationStatus;
      orderStatus: OrderStatus;
    }>(`/technologist/worklist/${id}/preparation`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Confirms compatible workflow protocol and advances exam to READY_FOR_SCAN
   */
  async confirmProtocol(id: string, protocolId: string): Promise<ConfirmProtocolResult> {
    const response = await apiClient<ConfirmProtocolResult>(`/technologist/worklist/${id}/protocol`, {
      method: 'POST',
      body: JSON.stringify({ protocolId }),
    });
    return response.data;
  },

  /**
   * Phase 3.4: Loads scan lifecycle context (current operational state, equipment, events)
   */
  async getScanLifecycle(id: string): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan`);
    return response.data;
  },

  async launchScannerWorklist(orderId: string): Promise<{
    success: boolean;
    accessionNumber: string;
    syncedAt: string;
    stationAETitle: string;
    transport: 'DICOM_MWL';
  }> {
    const response = await apiClient<{
      success: boolean;
      accessionNumber: string;
      syncedAt: string;
      stationAETitle: string;
      transport: 'DICOM_MWL';
    }>(`/orders/${orderId}/mwl-sync`, { method: 'POST' });
    return response.data;
  },

  /**
   * Starts scan acquisition (READY_FOR_SCAN -> SCAN_IN_PROGRESS)
   */
  async startScan(id: string, equipmentId?: string): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan/start`, {
      method: 'POST',
      body: JSON.stringify({ equipmentId }),
    });
    return response.data;
  },

  /**
   * Interrupts an active scan (SCAN_IN_PROGRESS -> SCAN_INTERRUPTED)
   */
  async interruptScan(id: string, payload: InterruptScanPayload): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan/interrupt`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Resumes an interrupted scan (SCAN_INTERRUPTED -> SCAN_IN_PROGRESS)
   */
  async resumeScan(id: string): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan/resume`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  /**
   * Finishes an active scan (SCAN_IN_PROGRESS -> SCAN_COMPLETED)
   */
  async finishScan(id: string): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan/finish`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  /**
   * Cancels a scan from READY_FOR_SCAN or SCAN_INTERRUPTED (-> SCAN_CANCELLED)
   */
  async cancelScan(id: string, payload: CancelScanPayload): Promise<ScanLifecycleContext> {
    const response = await apiClient<ScanLifecycleContext>(`/technologist/worklist/${id}/scan/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Phase 3.5: Loads contrast administration context, past administrations, and incidents
   */
  async getContrastContext(id: string): Promise<ContrastContext> {
    const response = await apiClient<ContrastContext>(`/technologist/worklist/${id}/contrast`);
    return response.data;
  },

  /**
   * Phase 3.5: Records contrast media administration for an active scan
   */
  async recordContrast(id: string, payload: RecordContrastPayload): Promise<ContrastAdministrationData> {
    const response = await apiClient<ContrastAdministrationData>(`/technologist/worklist/${id}/contrast`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Phase 3.5: Loads incident records associated with an examination
   */
  async getIncidents(id: string): Promise<TechnologistIncidentData[]> {
    const response = await apiClient<TechnologistIncidentData[]>(`/technologist/worklist/${id}/incidents`);
    return response.data;
  },

  /**
   * Phase 3.5: Records a technologist incident (does NOT alter scan lifecycle state)
   */
  async recordIncident(id: string, payload: RecordIncidentPayload): Promise<TechnologistIncidentData> {
    const response = await apiClient<TechnologistIncidentData>(`/technologist/worklist/${id}/incidents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Phase 3.6: Loads authoritative Image Quality Review & Acquisition Context
   */
  async getImageQualityContext(id: string): Promise<ImageQualityContext> {
    const response = await apiClient<ImageQualityContext>(`/technologist/worklist/${id}/image-quality`);
    return response.data;
  },

  /**
   * Phase 3.6: Explicitly begins Image Quality Review on a completed scan (SCAN_COMPLETED -> IMAGE_QA_PENDING)
   */
  async startImageQualityReview(id: string): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/image-quality/start`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Phase 3.6: Accepts Image Quality Review (IMAGE_QA_PENDING -> PACS_READY)
   */
  async acceptImageQuality(id: string, payload?: AcceptImageQualityPayload): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/image-quality/accept`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    return response.data;
  },

  /**
   * Phase 3.6: Marks Image Quality as REPEAT_REQUIRED
   */
  async markRepeatRequired(id: string, payload: ImageQualityDecisionPayload): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/image-quality/repeat-required`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Phase 3.6: Rejects Image Acquisition
   */
  async rejectImageQuality(id: string, payload: ImageQualityDecisionPayload): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/image-quality/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Phase 3.6: Authorizes repeat scan from REPEAT_REQUIRED or IMAGE_REJECTED (-> READY_FOR_SCAN)
   */
  async authorizeRepeat(id: string): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/image-quality/authorize-repeat`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Phase 3.6: Loads simulated PACS Handoff Context
   */
  async getPacsHandoff(id: string): Promise<PacsHandoffContext> {
    const response = await apiClient<PacsHandoffContext>(`/technologist/worklist/${id}/pacs-handoff`);
    return response.data;
  },

  /**
   * Phase 3.6: Initiates simulated PACS Handoff (PACS_READY -> PACS_HANDOFF_PENDING -> COMPLETE/FAILED)
   */
  async initiatePacsHandoff(id: string): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/pacs-handoff/initiate`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Phase 3.6: Retries a failed simulated PACS Handoff (PACS_HANDOFF_FAILED -> PENDING -> COMPLETE/FAILED)
   */
  async retryPacsHandoff(id: string): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/pacs-handoff/retry`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * Phase 3.6R: Retrieves current PACS integration status & adapter capabilities
   */
  async getPacsStatus(): Promise<PacsStatusData> {
    try {
      const response = await apiClient<PacsStatusData>('/integrations/pacs/status');
      return response.data;
    } catch {
      return {
        adapter: 'orthanc',
        connected: false,
        serverName: 'RadAxis RIS PACS',
        version: 'Unknown',
        dicomWebPluginAvailable: false,
        metadataLookupSupported: true,
        reconciliationSupported: true,
        dicomTransferSupported: false,
        viewerSupported: false,
        checkedAt: new Date().toISOString(),
        details: 'Orthanc is currently unreachable. RIS workflow data remains available.',
      };
    }
  },

  /**
   * Phase 3.6R: Looks up existing PACS study in Orthanc by RIS accession number
   */
  async lookupPacsStudy(id: string): Promise<PacsStudyLookupResponse> {
    const response = await apiClient<PacsStudyLookupResponse>(`/technologist/worklist/${id}/pacs-study`);
    return response.data;
  },

  /**
   * Phase 3.6R: Reconciles matched PACS study and creates persistent linkage
   */
  async reconcilePacsStudy(id: string): Promise<any> {
    const response = await apiClient(`/technologist/worklist/${id}/pacs-study/reconcile`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return response.data;
  },

  /**
   * Requirement 7: Get supporting documents attached to an imaging order
   */
  async getDocuments(id: string): Promise<OrderDocumentData[]> {
    const response = await apiClient<OrderDocumentData[]>(`/technologist/worklist/${id}/documents`);
    return response.data;
  },

  /**
   * Requirement 7: Upload supporting document (referral, lab result, consent, previous report, other)
   */
  async uploadDocument(id: string, payload: UploadDocumentPayload): Promise<OrderDocumentData> {
    const response = await apiClient<OrderDocumentData>(`/technologist/worklist/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  /**
   * Requirement 7: Delete supporting document
   */
  async deleteDocument(id: string, docId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient<{ success: boolean; message: string }>(
      `/technologist/worklist/${id}/documents/${docId}`,
      { method: 'DELETE' }
    );
    return response.data;
  },

  /**
   * Requirement 7: Authenticated download/view of a supporting document
   */
  async downloadDocument(id: string, docId: string, filename?: string): Promise<void> {
    const token = localStorage.getItem('ris_auth_token') || localStorage.getItem('token');
    const url = `/api/v1/technologist/worklist/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/download`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to download document (${res.status} ${res.statusText})`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || `Document_${docId}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};



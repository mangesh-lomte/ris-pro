export interface PacsHandoffContext {
  imagingOrderId: string;
  accessionNumber: string;
  patientId: string;
  patientInternalId: string;
  modality: string;
  examination: string;
  protocolCode: string | null;
  scanLifecycleId: string;
  attemptNumber: number;
  equipmentId: string | null;
  equipmentName: string | null;
  imageQualityReviewId: string;
  reviewedByUserId: string;
  reviewedAt: Date;
}

export interface PacsHandoffResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  simulatedTimestamp: Date;
  adapterIdentifier: string;
}

export interface PacsCapabilities {
  adapter: 'mock' | 'orthanc';
  connected: boolean;
  serverName?: string;
  version?: string;
  dicomWebPluginAvailable?: boolean;
  metadataLookupSupported: boolean;
  reconciliationSupported: boolean;
  dicomTransferSupported: boolean;
  viewerSupported: boolean;
}

export interface PacsHealthResult {
  connected: boolean;
  serverName?: string;
  version?: string;
  apiVersion?: number;
  dicomAet?: string;
  dicomWebPluginAvailable?: boolean;
  details?: string;
  checkedAt: Date;
}

export interface OrthancStudyMetadata {
  orthancStudyId: string;
  accessionNumber: string;
  patientId: string | null;
  patientName: string | null;
  studyInstanceUid: string | null;
  studyDate: string | null;
  studyDescription: string | null;
  modalitiesInStudy: string[];
}

export enum PacsStudyLookupOutcome {
  MATCHED = 'MATCHED',
  NOT_FOUND = 'NOT_FOUND',
  ACCESSION_MISMATCH = 'ACCESSION_MISMATCH',
  PATIENT_ID_MISMATCH = 'PATIENT_ID_MISMATCH',
  AMBIGUOUS_MATCH = 'AMBIGUOUS_MATCH',
  PACS_UNAVAILABLE = 'PACS_UNAVAILABLE',
}

export interface PacsStudyLookupResult {
  outcome: PacsStudyLookupOutcome;
  message: string;
  metadata?: OrthancStudyMetadata | null;
  candidateStudies?: Array<{
    orthancStudyId: string;
    studyInstanceUid?: string | null;
    accessionNumber?: string;
    patientId?: string | null;
    description?: string | null;
  }>;
  risAccession: string;
  risPatientId: string;
}

export interface DicomInstanceSummary {
  sopInstanceUid: string;
  instanceNumber?: number;
  sliceLocation?: number;
}

export interface DicomSeriesSummary {
  seriesInstanceUid: string;
  seriesNumber?: number;
  modality?: string;
  seriesDescription?: string;
  numberOfInstances?: number;
  instances: DicomInstanceSummary[];
}

export interface PacsGateway {
  requestHandoff(context: PacsHandoffContext): Promise<PacsHandoffResult>;
  checkHealth(): Promise<PacsHealthResult>;
  getCapabilities(): Promise<PacsCapabilities>;
  findStudyByAccession(accessionNumber: string): Promise<{
    outcome: PacsStudyLookupOutcome;
    studies: OrthancStudyMetadata[];
    rawError?: string;
  }>;
  getStudyMetadata(orthancStudyId: string): Promise<OrthancStudyMetadata | null>;
  getStudySeriesAndInstances?(orthancStudyId: string): Promise<DicomSeriesSummary[]>;
  getStudyArchive?(orthancStudyId: string): Promise<Buffer | null>;
}

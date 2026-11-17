export type UserRole = 'ADMIN' | 'RECEPTION' | 'TECHNOLOGIST' | 'RADIOLOGIST';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | 'UNSPECIFIED';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'COMPLETED';

export type OrderStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'ARRIVED'
  | 'READY_FOR_TECH'
  | 'SAFETY_REVIEW'
  | 'SAFETY_CLEARED'
  | 'PREPARATION_IN_PROGRESS'
  | 'PREPARED'
  | 'READY_FOR_SCAN'
  | 'SCAN_IN_PROGRESS'
  | 'SCAN_INTERRUPTED'
  | 'SCAN_COMPLETED'
  | 'IMAGE_QA_PENDING'
  | 'IMAGE_ACCEPTED'
  | 'REPEAT_REQUIRED'
  | 'IMAGE_REJECTED'
  | 'PACS_READY'
  | 'PACS_HANDOFF_PENDING'
  | 'PACS_HANDOFF_COMPLETE'
  | 'PACS_HANDOFF_FAILED'
  | 'SCAN_CANCELLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type SafetyStatus =
  | 'NOT_STARTED'
  | 'IN_REVIEW'
  | 'CLEARED'
  | 'REQUIRES_REVIEW'
  | 'BLOCKED';

export type PreparationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export type FastingStatus = 'NOT_REQUIRED' | 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNKNOWN';

export type ConsentStatus = 'NOT_REQUIRED' | 'CONFIRMED' | 'NOT_CONFIRMED';

export type StudyStatus =
  | 'PENDING'
  | 'ACQUIRING'
  | 'ACQUIRED'
  | 'SENT_TO_PACS'
  | 'READY_FOR_REPORTING'
  | 'REPORTED';

export type PacsStatus = 'NOT_SENT' | 'SENDING' | 'SENT' | 'FAILED';

export type ReportStatus = 'DRAFT' | 'PRELIMINARY' | 'FINAL' | 'ADDENDUM';

export type Priority = 'ROUTINE' | 'URGENT' | 'STAT';

export type ModalityType = 'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND' | 'MAMMOGRAPHY';

export type EquipmentStatus =
  | 'AVAILABLE'
  | 'OPERATIONAL'
  | 'BUSY'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE';

export type AuthorizationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type PayerType = 'SELF_PAY' | 'INSURANCE' | 'CORPORATE';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

export interface Patient {
  id: string;
  patientId: string; // Persistent unique ID (MRN)
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  appointments?: Appointment[];
  imagingOrders?: ImagingOrder[];
  _count?: {
    appointments?: number;
    imagingOrders?: number;
  };
}

export interface CandidateDuplicatePatient {
  id: string;
  patientId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  city?: string | null;
  matchReason?: string;
  createdAt: string;
}

export interface ReferringDoctor {
  id: string;
  name: string;
  organization?: string | null;
  phone?: string | null;
  email?: string | null;
  registrationNumber?: string | null;
  providerIdentifier?: string | null;
  npi?: string | null;
  isActive: boolean;
}

export interface ExamDefinition {
  id: string;
  code: string;
  name: string;
  modality: ModalityType;
  bodyPart: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  contrastSupported: boolean;
  isActive: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  modality: ModalityType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: EquipmentStatus;
  location: string;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
}

export interface Appointment {
  id: string;
  appointmentNumber: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'patientId' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'phone'>;
  imagingOrderId?: string | null;
  modality: ModalityType;
  equipmentId?: string | null;
  equipment?: Equipment | null;
  examDefinitionId?: string | null;
  examDefinition?: ExamDefinition | null;
  examination: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledStartTime?: string; // Compatibility alias
  scheduledEndTime?: string; // Compatibility alias
  durationMinutes: number;
  status: AppointmentStatus;
  priority: Priority;
  location?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  noShowReason?: string | null;
  rescheduleReason?: string | null;
  tokenNumber?: string | null;
  checkedInAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  movementStage?: 'RECEPTION' | 'DRESSING_PREPARATION' | 'SCANNER' | 'POST_SCAN';
  movementUpdatedAt?: string | null;
  imagingOrder?: {
    id: string;
    accessionNumber: string;
    modality?: ModalityType;
    bodyPart?: string;
    examinationName?: string;
    clinicalIndication?: string;
    contrastRequired?: boolean;
    priority?: Priority;
    orderStatus: OrderStatus;
    authorizationStatus?: AuthorizationStatus;
    referringDoctor?: { id: string; name: string } | null;
  } | null;
}

export interface ImagingOrder {
  id: string;
  accessionNumber: string; // Unique accession number
  patientId: string;
  patient?: Pick<Patient, 'id' | 'patientId' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'phone'>;
  appointmentId?: string | null;
  appointment?: Pick<Appointment, 'id' | 'appointmentNumber' | 'scheduledStart' | 'scheduledEnd' | 'status' | 'location' | 'tokenNumber'> | null;
  modality: ModalityType;
  bodyPart: string;
  examDefinitionId?: string | null;
  examDefinition?: ExamDefinition | null;
  examinationName: string;
  clinicalIndication: string;
  referringDoctorId?: string | null;
  referringDoctor?: ReferringDoctor | null;
  referringDoctorText?: string | null;
  contrastRequired: boolean;
  contrastRequirement?: 'NONE' | 'ORAL' | 'IV' | 'BOTH';
  priority: Priority;
  orderStatus: OrderStatus;
  payerType?: PayerType | null;
  payerName?: string | null;
  insuranceProvider?: string | null;
  memberId?: string | null;
  policyNumber?: string | null;
  authorizationRequired?: boolean;
  authorizationStatus?: AuthorizationStatus;
  authorizationCode?: string | null;
  insuranceNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  study?: {
    id: string;
    studyStatus: StudyStatus;
    pacsStatus: PacsStatus;
    instanceCount: number;
  } | null;
  report?: {
    id: string;
    status: ReportStatus;
    finalizedAt?: string | null;
  } | null;
}

export interface SlotCandidate {
  start: string;
  end: string;
  equipmentId: string;
  equipmentName: string;
  available: boolean;
}

export interface SlotAvailabilityResponse {
  date: string;
  modality: ModalityType;
  slots: SlotCandidate[];
  message?: string;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SystemHealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  environment: string;
  appEnv?: string;
  commit?: string;
  version: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    responseTimeMs?: number;
    error?: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsageMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

// ==========================================
// TECHNOLOGIST WORKLIST TYPES (PHASE 3.1)
// ==========================================

export interface TechnologistWorklistItem {
  appointmentId: string;
  orderId: string;
  patientId: string;
  patient: {
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
  };
  order: {
    accessionNumber: string;
    modality: ModalityType;
    examinationName: string;
    bodyPart: string;
    clinicalIndication: string;
    priority: Priority;
    orderStatus: OrderStatus;
    contrastRequired: boolean;
    safetyStatus?: SafetyStatus;
  };
  appointment: {
    appointmentNumber: string;
    scheduledStart: string;
    scheduledEnd: string;
    checkedInAt: string | null;
    tokenNumber: string | null;
    notes: string | null;
  };
  equipment: {
    id: string;
    name: string;
    modality: ModalityType;
    location: string;
    status: string;
  } | null;
  waitingMinutes: number;
}

export interface TechnologistWorklistData {
  items: TechnologistWorklistItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TechnologistWorklistFilters {
  date?: string;
  modality?: string;
  equipmentId?: string;
  priority?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TechnologistExamDetail {
  appointmentId: string;
  appointmentNumber: string;
  scheduledStart: string;
  scheduledEnd: string;
  checkedInAt: string | null;
  tokenNumber: string | null;
  status: AppointmentStatus;
  notes: string | null;
  waitingMinutes: number;
  priorStudies: Array<{
    orderId: string;
    accessionNumber: string;
    examinationName: string;
    modality: ModalityType;
    bodyPart: string;
    clinicalIndication: string;
    orderStatus: OrderStatus;
    performedAt: string;
    reportStatus: string | null;
    reportImpression: string | null;
    reportFinalizedAt: string | null;
  }>;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    phone: string;
    email?: string | null;
  };
  order: {
    id: string;
    accessionNumber: string;
    modality: ModalityType;
    examinationName: string;
    bodyPart: string;
    clinicalIndication: string;
    priority: Priority;
    orderStatus: OrderStatus;
    contrastRequired: boolean;
    referringDoctor: {
      id: string;
      name: string;
      organization?: string | null;
      providerIdentifier?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  };
  equipment: {
    id: string;
    name: string;
    modality: ModalityType;
    manufacturer: string;
    model: string;
    location: string;
    status: string;
  } | null;
  safetyScreening?: TechnologistSafetyScreening | null;
}

export interface TechnologistSafetyScreening {
  id: string;
  imagingOrderId: string;
  patientId: string;
  appointmentId?: string | null;
  completedByUserId: string;
  modality: ModalityType;
  identityVerified: boolean;
  identityVerificationMethod?: string | null;
  identityVerifiedAt?: string | null;
  safetyStatus: SafetyStatus;
  safetyNotes?: string | null;
  answers: Record<string, string>;
  riskFactors: string[];
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface SaveSafetyScreeningPayload {
  identityVerified: boolean;
  identityVerificationMethod: string;
  safetyNotes?: string;
  answers: Record<string, string>;
}

export interface SafetyScreeningContext {
  appointmentId: string | null;
  appointmentNumber: string | null;
  orderId: string;
  accessionNumber: string;
  modality: ModalityType;
  examinationName: string;
  bodyPart: string;
  clinicalIndication: string;
  priority: Priority;
  orderStatus: OrderStatus;
  contrastRequired: boolean;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
  };
  referringDoctor: string | null;
  equipment: {
    id: string;
    name: string;
    location: string;
  } | null;
  screening: TechnologistSafetyScreening | null;
  patientPreVisitScreening: {
    hasMetalImplants?: boolean;
    hasAllergies?: boolean;
    isPregnant?: boolean;
    hasKidneyDisease?: boolean;
    notes?: string;
    risksIdentified?: string[];
    status?: 'NO_RISKS_REPORTED' | 'REQUIRES_TECH_REVIEW';
    completedAt?: string;
  } | null;
}

export interface ImagingProtocol {
  id: string;
  code: string;
  name: string;
  modality: ModalityType;
  examDefinitionId?: string | null;
  bodyPart?: string | null;
  description?: string | null;
  isActive: boolean;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'RETIRED';
  version: number;
  approvedAt: string;
}

export interface PreparationRequirements {
  fastingRequired: boolean;
  ivRequired: boolean;
  contrastPreparationRequired: boolean;
  consentRequired: boolean;
  additionalPreparationRequired: boolean;
  additionalPreparationInstructions: string | null;
}

export interface TechnologistPreparation {
  id: string;
  imagingOrderId: string;
  patientId: string;
  appointmentId?: string | null;
  completedByUserId?: string | null;
  fastingRequired: boolean;
  fastingStatus: FastingStatus;
  ivRequired: boolean;
  ivReady: boolean;
  contrastPreparationRequired: boolean;
  contrastReady: boolean;
  consentRequired: boolean;
  consentStatus: ConsentStatus;
  additionalPreparationRequired: boolean;
  additionalPreparationComplete: boolean;
  additionalPreparationInstructions?: string | null;
  preparationNotes?: string | null;
  preparationStatus: PreparationStatus;
  preparedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
}

export interface PreparationContext {
  orderId: string;
  accessionNumber: string;
  appointmentId?: string | null;
  appointmentNumber?: string | null;
  modality: ModalityType;
  examinationName: string;
  bodyPart: string;
  clinicalIndication: string;
  priority: Priority;
  orderStatus: OrderStatus;
  contrastRequired: boolean;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
  };
  referringDoctor: string | null;
  equipment: {
    id: string;
    name: string;
    location: string;
  } | null;
  safetyStatus: SafetyStatus;
  isSafetyCleared: boolean;
  requirements: PreparationRequirements;
  preparation: TechnologistPreparation | null;
  preparationStatus: PreparationStatus;
  eligibleProtocols: ImagingProtocol[];
  confirmedProtocol: ImagingProtocol | null;
  protocolConfirmedAt: string | null;
}

export interface SavePreparationPayload {
  fastingStatus?: FastingStatus;
  ivReady?: boolean;
  contrastReady?: boolean;
  consentStatus?: ConsentStatus;
  additionalPreparationComplete?: boolean;
  preparationNotes?: string;
}

export interface ConfirmProtocolResult {
  orderId: string;
  accessionNumber: string;
  preparationStatus: PreparationStatus;
  protocol: {
    id: string;
    code: string;
    name: string;
    modality: ModalityType;
    bodyPart?: string | null;
    approvalStatus: 'DRAFT' | 'APPROVED' | 'RETIRED';
    version: number;
    approvedAt: string;
  };
  orderStatus: OrderStatus;
}

export type ScanState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'INTERRUPTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ScanLifecycleAction =
  | 'STARTED'
  | 'INTERRUPTED'
  | 'RESUMED'
  | 'COMPLETED'
  | 'CANCELLED';

export type InterruptionReason =
  | 'PATIENT_REQUEST'
  | 'EQUIPMENT_ISSUE'
  | 'WORKFLOW_ISSUE'
  | 'OTHER';

export type CancellationReason =
  | 'PATIENT_REQUEST'
  | 'PATIENT_UNABLE_TO_CONTINUE'
  | 'EQUIPMENT_ISSUE'
  | 'ORDER_CANCELLED'
  | 'WORKFLOW_ISSUE'
  | 'OTHER';

export interface ScanLifecycleEvent {
  id: string;
  action: ScanLifecycleAction;
  timestamp: string;
  reason?: string | null;
  notes?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
}

export interface ScanLifecycleData {
  id: string;
  state: ScanState;
  startedAt: string;
  startedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  interruptedAt?: string | null;
  interruptedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  interruptionReason?: string | null;
  interruptionNotes?: string | null;
  resumedAt?: string | null;
  resumedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  completedAt?: string | null;
  completedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  cancelledAt?: string | null;
  cancelledBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  cancellationReason?: string | null;
  cancellationNotes?: string | null;
  events?: ScanLifecycleEvent[];
}

export interface ScanLifecycleContext {
  orderId: string;
  patientId: string;
  accessionNumber: string;
  orderStatus: OrderStatus;
  modality: ModalityType;
  examination: string;
  bodyPart: string;
  priority: Priority;
  contrastRequired: boolean;
  mwlSyncedAt: string | null;
  mwlStationAETitle: string | null;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    isActive: boolean;
  };
  equipment: {
    id: string;
    name: string;
    modality: ModalityType;
    location: string;
    status: string;
  } | null;
  protocol: {
    id: string;
    code: string;
    name: string;
    modality: ModalityType;
    bodyPart?: string | null;
    description?: string | null;
    approvalStatus: 'DRAFT' | 'APPROVED' | 'RETIRED';
    version: number;
    approvedAt: string;
  } | null;
  safetyStatus: SafetyStatus;
  isSafetyCleared: boolean;
  preparationStatus: PreparationStatus;
  isPreparationComplete: boolean;
  scan: ScanLifecycleData | null;
}

export interface InterruptScanPayload {
  reason: InterruptionReason;
  notes?: string;
}

export interface CancelScanPayload {
  reason: CancellationReason;
  notes?: string;
}

// ==========================================
// CONTRAST & INCIDENTS TYPES (PHASE 3.5)
// ==========================================

export type ContrastRoute = 'IV' | 'ORAL' | 'OTHER';

export type IncidentCategory =
  | 'CONTRAST_REACTION'
  | 'EXTRAVASATION'
  | 'PATIENT_DISTRESS'
  | 'PATIENT_REQUEST'
  | 'EQUIPMENT_RELATED'
  | 'WORKFLOW_EVENT'
  | 'OTHER';

export type IncidentWorkflowAction =
  | 'SCAN_INTERRUPTED'
  | 'SCAN_STOPPED'
  | 'CLINICIAN_NOTIFIED'
  | 'PATIENT_MONITORED'
  | 'OTHER';

export interface ContrastAdministrationData {
  id: string;
  contrastAgentName: string;
  concentration?: string | null;
  volume: number;
  volumeUnit: string;
  route: ContrastRoute;
  routeNotes?: string | null;
  batchLotNumber?: string | null;
  expirationDate?: string | null;
  administeredAt: string;
  administeredBy: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  administrationNotes?: string | null;
  hasIncident: boolean;
  incidents?: Array<{
    id: string;
    category: IncidentCategory;
    description: string;
    recordedAt: string;
  }>;
}

export interface TechnologistIncidentData {
  id: string;
  category: IncidentCategory;
  description: string;
  occurredAt: string;
  recordedAt: string;
  recordedBy: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  clinicianNotified: boolean;
  clinicianNotifiedAt?: string | null;
  notificationNotes?: string | null;
  workflowActionTaken?: IncidentWorkflowAction | null;
  workflowActionNotes?: string | null;
  contrastAdministration?: {
    id: string;
    contrastAgentName: string;
    volume: number;
    volumeUnit: string;
    administeredAt: string;
  } | null;
}

export interface ContrastContext {
  orderId: string;
  patientId: string;
  accessionNumber: string;
  modality: ModalityType;
  examination: string;
  bodyPart: string;
  priority: Priority;
  contrastRequired: boolean;
  orderStatus: OrderStatus;
  safetyStatus: SafetyStatus;
  isSafetyCleared: boolean;
  preparationStatus: PreparationStatus;
  isPreparationComplete: boolean;
  scanState: ScanState;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    isActive: boolean;
  };
  equipment: {
    id: string;
    name: string;
    modality: ModalityType;
    location: string;
  } | null;
  protocol: {
    id: string;
    code: string;
    name: string;
  } | null;
  administrations: ContrastAdministrationData[];
  incidents: TechnologistIncidentData[];
}

export interface RecordContrastPayload {
  contrastAgentName: string;
  concentration?: string;
  volume: number;
  volumeUnit?: string;
  route: ContrastRoute;
  routeNotes?: string;
  batchLotNumber: string;
  expirationDate: string;
  administrationNotes?: string;
}

export interface RecordIncidentPayload {
  category: IncidentCategory;
  description: string;
  contrastAdministrationId?: string;
  clinicianNotified?: boolean;
  notificationNotes?: string;
  workflowActionTaken?: IncidentWorkflowAction;
  workflowActionNotes?: string;
}

// ==========================================
// IMAGE QUALITY & PACS HANDOFF TYPES (PHASE 3.6)
// ==========================================

export type ImageQualityStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REPEAT_REQUIRED'
  | 'REJECTED';

export type ImageQualityReason =
  | 'PATIENT_MOTION'
  | 'POSITIONING'
  | 'COVERAGE_INCOMPLETE'
  | 'TECHNICAL_ARTIFACT'
  | 'PROTOCOL_DEVIATION'
  | 'OTHER';

export type PacsHandoffStatus =
  | 'READY'
  | 'PENDING'
  | 'COMPLETE'
  | 'FAILED';

export type PacsHandoffOutcome = 'SUCCESS' | 'FAILURE';

export interface ImageQualityReviewData {
  id: string;
  status: ImageQualityStatus;
  startedAt: string;
  startedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  reviewedAt?: string | null;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  reasonCode?: ImageQualityReason | null;
  notes?: string | null;
  completenessConfirmed: boolean;
  coverageConfirmed: boolean;
  orientationConfirmed: boolean;
  artifactReviewConfirmed: boolean;
  repeatAuthorizedAt?: string | null;
  repeatAuthorizedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
}

export interface PacsHandoffAttemptData {
  id: string;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string | null;
  outcome: PacsHandoffOutcome;
  errorCode?: string | null;
  errorMessage?: string | null;
  initiatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
}

export interface PacsHandoffData {
  id: string;
  status: PacsHandoffStatus;
  attemptCount: number;
  initiatedAt?: string | null;
  initiatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  } | null;
  lastAttemptAt?: string | null;
  completedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  attempts?: PacsHandoffAttemptData[];
}

export interface ScanAttemptHistoryItem {
  scanLifecycleId: string;
  attemptNumber: number;
  state: ScanState;
  startedAt: string;
  completedAt?: string | null;
  qaStatus?: ImageQualityStatus | null;
  qaReasonCode?: ImageQualityReason | null;
  qaNotes?: string | null;
  repeatAuthorizedAt?: string | null;
  pacsStatus?: PacsHandoffStatus | null;
}

export interface ImageQualityContext {
  orderId: string;
  patientId: string;
  accessionNumber: string;
  orderStatus: OrderStatus;
  modality: ModalityType;
  examination: string;
  bodyPart: string;
  priority: Priority;
  contrastRequired: boolean;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    isActive: boolean;
  };
  equipment: {
    id: string;
    name: string;
    modality: ModalityType;
    location: string;
  } | null;
  protocol: {
    id: string;
    code: string;
    name: string;
    modality: ModalityType;
    bodyPart?: string | null;
  } | null;
  currentScan: {
    id: string;
    attemptNumber: number;
    state: ScanState;
    startedAt: string;
    startedBy?: {
      id: string;
      firstName: string;
      lastName: string;
      role: UserRole;
    } | null;
    completedAt?: string | null;
    completedBy?: {
      id: string;
      firstName: string;
      lastName: string;
      role: UserRole;
    } | null;
  } | null;
  imageQualityReview: ImageQualityReviewData | null;
  pacsHandoff: PacsHandoffData | null;
  attemptHistory: ScanAttemptHistoryItem[];
  flags: {
    canStartQA: boolean;
    canAccept: boolean;
    canRepeat: boolean;
    canReject: boolean;
    canAuthorizeRepeat: boolean;
    canInitiateHandoff: boolean;
    canRetryHandoff: boolean;
  };
}

export interface PacsHandoffContext {
  integrationMode: string;
  adapterIdentifier: string;
  orderId: string;
  patientId: string;
  accessionNumber: string;
  examination: string;
  modality: ModalityType;
  orderStatus: OrderStatus;
  currentScan: ImageQualityContext['currentScan'];
  imageQualityReview: ImageQualityReviewData | null;
  pacsHandoff: PacsHandoffData | null;
  flags: ImageQualityContext['flags'];
}

export interface AcceptImageQualityPayload {
  completenessConfirmed: true;
  coverageConfirmed: true;
  orientationConfirmed: true;
  artifactReviewConfirmed: true;
  notes?: string;
}

export interface ImageQualityDecisionPayload {
  reason: ImageQualityReason;
  notes?: string;
}

// ==========================================
// REAL ORTHANC PACS INTEGRATION TYPES (PHASE 3.6R)
// ==========================================

export type PacsAdapterType = 'mock' | 'orthanc';

export interface PacsStatusData {
  adapter: PacsAdapterType;
  connected: boolean;
  serverName: string;
  version?: string;
  apiVersion?: number;
  dicomAet?: string;
  dicomWebPluginAvailable?: boolean;
  metadataLookupSupported: boolean;
  reconciliationSupported: boolean;
  dicomTransferSupported: boolean;
  viewerSupported: boolean;
  checkedAt: string;
  details?: string;
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

export type PacsStudyLookupOutcome =
  | 'MATCHED'
  | 'NOT_FOUND'
  | 'ACCESSION_MISMATCH'
  | 'PATIENT_ID_MISMATCH'
  | 'AMBIGUOUS_MATCH'
  | 'PACS_UNAVAILABLE';

export interface PacsStudyLookupResponse {
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
  pacsStudyLink?: {
    id: string;
    orthancStudyId: string;
    studyInstanceUid?: string | null;
    status: 'LINKED' | 'UNLINKED';
    verifiedAt: string;
  } | null;
}

// ==========================================
// RADIOLOGIST WORKLIST & ASSIGNMENT TYPES (PHASE 4.1)
// ==========================================

export type RadiologistAssignmentStatus = 'ASSIGNED' | 'RELEASED';

export interface RadiologistWorklistItem {
  imagingOrderId: string;
  patientId: string;
  patientName: string;
  patientGender: Gender;
  patientDob: string;
  accessionNumber: string;
  modality: ModalityType;
  procedureName: string;
  bodyPart: string;
  priority: Priority;
  priorityWeight: number;
  clinicalIndication: string;
  referringDoctor: string | null;
  eligibleAt: string;
  waitingMinutes: number;
  orderStatus: OrderStatus;
  assignmentStatus: 'ASSIGNED' | 'UNASSIGNED';
  assignedRadiologist: {
    id: string;
    name: string;
    email: string;
    assignedAt: string;
    isAssignedToMe: boolean;
  } | null;
  pacsIntegrationState: {
    adapter: string;
    status: string;
    label: string;
    message?: string;
    studyInstanceUid: string | null;
    orthancStudyId: string | null;
  };
  priorStudyCount: number;
  priorAvailable: boolean;
  reportStatus: string | null;
  finalizedAt: string | null;
  isReported: boolean;
}

export interface RadiologistWorklistData {
  items: RadiologistWorklistItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    total: number;
    unassigned: number;
    assigned: number;
    stat: number;
    urgent: number;
    routine: number;
  };
  turnaround: {
    pendingCount: number;
    averagePendingMinutes: number;
    longestPendingMinutes: number;
    finalizedCount: number;
    averageFinalizedMinutes: number;
    measuredFrom: string;
  };
}

export interface RadiologistWorklistFilters {
  modality?: ModalityType | '';
  priority?: Priority | '';
  date?: string;
  assignmentStatus?: 'UNASSIGNED' | 'ASSIGNED' | 'ALL';
  reportStatus?: 'UNREPORTED' | 'REPORTED' | 'ALL';
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PriorReportDetail {
  reportId: string;
  priorOrderId: string;
  priorAccessionNumber: string;
  examinationName: string;
  modality: ModalityType;
  bodyPart: string;
  reportStatus: string;
  finalizedAt: string | null;
  authorName: string;
  findings: string | null;
  impression: string | null;
  createdAt: string;
}

export interface PriorStudySummary {
  imagingOrderId: string;
  accessionNumber: string;
  modality: ModalityType;
  bodyPart: string;
  procedureName: string;
  orderStatus: OrderStatus;
  date: string;
  studyDate?: string;
  pacsStatus: 'LINKED' | 'NOT_RECONCILED' | 'UNAVAILABLE';
  pacsMessage: string | null;
  isImageComparisonEligible: boolean;
  hasPacsStudy: boolean;
  studyInstanceUid: string | null;
  hasPriorReport: boolean;
  priorReport?: {
    reportId: string;
    status: string;
    authorName: string;
    finalizedAt: string | null;
    findings: string | null;
    impression: string | null;
    createdAt: string;
  } | null;
}

export interface RadiologistStudyContext {
  order: {
    id: string;
    accessionNumber: string;
    modality: ModalityType;
    bodyPart: string;
    examinationName: string;
    clinicalIndication: string;
    priority: Priority;
    orderStatus: OrderStatus;
    contrastRequired: boolean;
    eligibleAt: string;
    waitingMinutes: number;
    protocol: {
      id: string;
      name: string;
      code: string;
    } | null;
    referringDoctor: {
      id?: string;
      name: string;
      organization?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  };
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    dateOfBirth: string;
    phone: string;
    email: string | null;
  };
  acceptedAcquisition: {
    scanLifecycleId: string;
    attemptNumber: number;
    completedAt: string | null;
    scanner: string | null;
    qaStatus: ImageQualityStatus;
    qaReviewedAt: string | null;
    qaNotes: string | null;
  } | null;
  repeatHistory: Array<{
    scanLifecycleId: string;
    attemptNumber: number;
    state: string;
    startedAt: string | null;
    completedAt: string | null;
    scanner: string | null;
    qaStatus: ImageQualityStatus | null;
    qaReason: ImageQualityReason | null;
    qaNotes: string | null;
    qaReviewedAt: string | null;
    qaReviewedBy: string | null;
    isAcceptedAcquisition: boolean;
  }>;
  contrastSummary: Array<{
    id: string;
    agentName: string;
    volume: number;
    volumeUnit: string;
    route: string;
    administeredAt: string;
    administeredBy: string | null;
    notes: string | null;
  }>;
  incidentSummary: Array<{
    id: string;
    category: string;
    description: string;
    clinicianNotified: boolean;
    recordedAt: string;
    recordedBy: string | null;
  }>;
  pacsIntegrationState: {
    adapter: string;
    status: string;
    label: string;
    message?: string;
    studyInstanceUid: string | null;
    orthancStudyId: string | null;
  };
  priorStudies: PriorStudySummary[];
  priorStudyCount: number;
  hasPriorStudies: boolean;
  activeAssignment: {
    id: string;
    radiologistUserId: string;
    radiologistName: string;
    radiologistEmail: string;
    assignedAt: string;
    assignedBy: string;
    isAssignedToMe: boolean;
  } | null;
  assignmentHistory: Array<{
    id: string;
    radiologistName: string;
    assignedAt: string;
    assignedBy: string;
    status: RadiologistAssignmentStatus;
    releasedAt: string | null;
    releasedBy: string | null;
  }>;
}

export interface RadiologistUserOption {
  id: string;
  name: string;
  email: string;
}

// ==========================================
// PHASE 4.3 REPORTING TEMPLATES & DRAFT/AUTOSAVE TYPES
// ==========================================

export interface ReportingTemplateSummary {
  id: string;
  name: string;
  modality: ModalityType;
  bodyPart: string;
  description: string | null;
  sections: string[];
  isRecommended: boolean;
}

export interface ReportDraftDetail {
  id: string;
  authorId: string;
  authorName: string;
  templateId: string | null;
  templateName: string | null;
  content: Record<string, string>;
  measurements?: MeasurementReference[];
  keyImages?: KeyImageReference[];
  version: number;
  lastAutosavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportWorkspaceData {
  order: {
    id: string;
    accessionNumber: string;
    patientId: string;
    patientName: string;
    patientDob: string;
    patientGender: Gender;
    modality: ModalityType;
    bodyPart: string;
    examinationName: string;
    clinicalIndication: string;
    priority: Priority;
    orderStatus: OrderStatus;
    studyInstanceUid?: string | null;
  };
  draft: ReportDraftDetail | null;
  templates: ReportingTemplateSummary[];
  assignment: {
    assignedToUserId: string;
    assignedToName: string;
    assignedAt: string;
  } | null;
  finalizedReport?: {
    id: string;
    status: string;
    version: number;
    findings?: string | null;
    impression?: string | null;
    finalizedAt?: string | null;
    signedAt?: string | null;
    radiologist?: {
      id: string;
      name: string;
      email: string;
    } | null;
    signedBy?: {
      id: string;
      name: string;
      email: string;
      role?: string;
    } | null;
    isSigned?: boolean;
    isLocked?: boolean;
    signatureHash?: string | null;
    digitalSignature?: {
      algorithm: string;
      signedBy: string;
      signerEmail: string;
      signerRole: string;
      signedAt: string;
      signatureHash: string;
      statement: string;
    } | null;
    pdfGeneratedAt?: string | null;
    pdfArtifactPath?: string | null;
    pdfFileSizeBytes?: number | null;
    pdfVersion?: number | null;
    isReadyForReception?: boolean;
    readyForReceptionAt?: string | null;
    amendmentCount?: number;
  } | null;
}

export interface CreateReportDraftPayload {
  templateId?: string;
  content?: Record<string, string>;
}

export interface SaveReportDraftPayload {
  version: number;
  content: Record<string, string>;
  measurements?: MeasurementReference[];
  keyImages?: KeyImageReference[];
}

// ==========================================
// PHASE 4.5 — MEASUREMENTS & KEY IMAGES TYPES
// ==========================================

export type OhifMeasurementToolType =
  | 'Length'
  | 'Bidirectional'
  | 'EllipticalROI'
  | 'CircleROI'
  | 'RectangleROI'
  | 'Angle'
  | 'CobbAngle'
  | 'ArrowAnnotate'
  | 'Probe'
  | 'PlanarFreehandROI';

export interface MeasurementReference {
  id: string;
  toolType: OhifMeasurementToolType;
  label?: string;
  numericValue?: number;
  unit?: string;
  displayText?: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  frameNumber?: number;
  instanceNumber?: number;
  sliceLocation?: number | string;
  findingText?: string;
  notes?: string;
  createdAt: string;
}

export interface KeyImageReference {
  id: string;
  label: string;
  description?: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  frameNumber?: number;
  instanceNumber?: number;
  sliceLocation?: number | string;
  createdAt: string;
}

export interface DicomInstanceSummary {
  sopInstanceUid: string;
  instanceNumber: number;
  sliceLocation?: number | string;
}

export interface DicomSeriesSummary {
  seriesInstanceUid: string;
  seriesNumber: number;
  modality: string;
  bodyPart?: string;
  description?: string;
  instances: DicomInstanceSummary[];
}

export interface StudyInstancesResult {
  studyInstanceUid: string;
  accessionNumber: string;
  patientId: string;
  series: DicomSeriesSummary[];
}

// ==========================================
// Phase 4.6 — Peer Review / Second Opinion
// ==========================================

export type PeerReviewStatus = 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';

export interface PeerReviewItem {
  id: string;
  imagingOrderId: string;
  status: PeerReviewStatus;
  reason: string | null;
  reviewComment: string | null;
  decision: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  patient: {
    id: string;
    patientId: string;
    name: string;
    dob: string;
    gender: string;
  };
  order: {
    id: string;
    accessionNumber: string;
    modality: ModalityType;
    procedureName: string;
    bodyPart: string;
    priority: Priority;
    studyInstanceUid: string | null;
  };
  requester: {
    id: string;
    name: string;
    email: string;
  };
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PeerReviewQueueResponse {
  items: PeerReviewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PeerReviewContextData extends PeerReviewItem {
  primaryDraftSummary?: {
    templateName?: string | null;
    content: Record<string, string>;
    version: number;
    updatedAt: string;
  } | null;
}

export interface OrderPeerReviewSummary {
  id: string;
  imagingOrderId: string;
  status: PeerReviewStatus;
  reason: string | null;
  reviewComment: string | null;
  decision: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

// Phase 4.7 — Critical Findings Types
export type CriticalFindingStatus = 'PENDING' | 'ACKNOWLEDGED';

export interface CriticalFindingItem {
  id: string;
  imagingOrderId: string;
  order?: {
    id: string;
    accessionNumber: string;
    modality: ModalityType;
    bodyPart: string;
    examinationName: string;
    patientId: string;
    patientName: string;
  };
  findingText: string;
  status: CriticalFindingStatus;
  severity: string;
  sentAt: string;
  acknowledgedAt?: string | null;
  acknowledgmentNotes?: string | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
  };
  acknowledgedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CriticalFindingQueueResponse {
  items: CriticalFindingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClinicianItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ==========================================
// Phase 4.11 — Report Delivery, Front Desk & TAT
// ==========================================

export type ReportDeliveryMethodType = 'RECEPTION_HANDOVER' | 'PATIENT_PORTAL' | 'REFERRING_PHYSICIAN' | 'PRINT';
export type NotificationChannelType = 'SMS' | 'EMAIL';
export type NotificationStatusType = 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED';

export interface ReportDeliveryRecord {
  id: string;
  version: number;
  deliveryMethod: ReportDeliveryMethodType;
  recipientName: string;
  recipientRole?: string | null;
  deliveredAt: string;
  deliveredBy?: string | null;
  status: string;
  notes?: string | null;
}

export interface ReportNotificationRecord {
  id: string | null;
  channel: NotificationChannelType;
  recipientContact: string;
  messageBody: string;
  status: NotificationStatusType;
  provider: string;
  sentAt: string | null;
  sentBy?: string | null;
}

export interface ReportReprintRecord {
  id: string;
  version: number;
  printedAt: string;
  printedBy: string;
  reason?: string | null;
  copiesCount: number;
}

export interface ReceptionReadyReport {
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  phone: string;
  email?: string | null;
  modality: ModalityType;
  examinationName: string;
  priority: Priority;
  referringDoctorName: string;
  reportId: string;
  reportStatus: string;
  reportVersion: number;
  finalizedAt?: string | null;
  signedAt?: string | null;
  signedBy: string;
  hasPdf: boolean;
  pdfGeneratedAt?: string | null;
  isReadyForReception: boolean;
  readyForReceptionAt?: string | null;
  readyForReceptionBy?: string | null;
  deliveryStatus: 'READY_FOR_PICKUP' | 'DELIVERED';
  lastDeliveredAt?: string | null;
  deliveriesCount: number;
  notificationsCount: number;
  reprintsCount: number;
  deliveries: ReportDeliveryRecord[];
  notifications: ReportNotificationRecord[];
  reprints: ReportReprintRecord[];
}

export interface TatItem {
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  modality: ModalityType;
  examinationName: string;
  priority: Priority;
  targetSlaMinutes: number;
  slaStatus: 'ON_TARGET' | 'DELAYED' | 'IN_PROGRESS';
  timestamps: {
    orderCreatedAt: string;
    scanStartedAt: string | null;
    scanCompletedAt: string | null;
    reportFinalizedAt: string | null;
    readyForReceptionAt: string | null;
    deliveredAt: string | null;
  };
  turnaroundMinutes: {
    reportingTatMinutes: number | null;
    deliveryTatMinutes: number | null;
    endToEndTatMinutes: number | null;
  };
  reportStatus: string;
  deliveryStatus: string;
}

export interface TatDashboardData {
  summary: {
    totalOrdersTracked: number;
    averageReportingTatMinutes: number;
    averageDeliveryTatMinutes: number;
    averageEndToEndTatMinutes: number;
    deliveredOrdersCount: number;
    delayedCasesCount: number;
    onTargetCasesCount: number;
  };
  items: TatItem[];
}

export interface TodayOverviewData {
  totalBookings: number;
  completedScans: number;
  pendingReports: number;
  totalRevenue: number;
  acquisitionBacklog: number;
  finalizedReportsToday: number;
}

export interface LivePatientStatusData {
  breakdown: {
    booked: number;
    arrived: number;
    waiting: number;
    scanning: number;
    reporting: number;
    delivered: number;
  };
  activePatients: Array<{
    id: string;
    databasePatientId: string;
    patientId: string;
    patientName: string;
    accessionNumber: string;
    modality: ModalityType;
    examinationName: string;
    priority: Priority;
    status: string;
    stage: 'BOOKED' | 'ARRIVED' | 'WAITING' | 'SCANNING' | 'REPORTING' | 'DELIVERED';
    timeAgoMinutes: number;
  }>;
}

export interface ModalityStatusTile {
  modality: ModalityType;
  name: string;
  totalScanners: number;
  operationalScanners: number;
  status: 'OPERATIONAL' | 'BUSY' | 'MAINTENANCE' | 'OFFLINE';
  todayScheduledCount: number;
  currentlyScanningCount: number;
  utilizationPercent: number;
}

export interface PendingTaskAlert {
  id: string;
  type: 'URGENT_SCAN' | 'UNSIGNED_REPORT' | 'DELAYED_APPOINTMENT' | 'CRITICAL_FINDING';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  accessionNumber?: string;
  patientId?: string;
  orderId?: string;
  targetUrl: string;
  timestamp: string;
}

export interface DailyAnalyticsData {
  scanVolumeToday: number;
  averageReportingTatMinutes: number;
  averageDeliveryTatMinutes: number;
  noShowCountToday: number;
  cancelledCountToday: number;
  completionRatePercent: number;
}

export interface DashboardNotificationItem {
  id: string;
  channel: string;
  type: 'CRITICAL_FINDING' | 'APPOINTMENT_CHANGE' | 'SYSTEM_STATUS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardOverviewResponse {
  todayOverview: TodayOverviewData;
  livePatientStatus: LivePatientStatusData;
  modalityTiles: ModalityStatusTile[];
  pendingTaskAlerts: PendingTaskAlert[];
  dailyAnalytics: DailyAnalyticsData;
  notifications: DashboardNotificationItem[];
  roleCapabilities: {
    role: UserRole;
    allowedActions: string[];
  };
}

export interface DashboardSearchResultItem {
  type: 'PATIENT' | 'ORDER';
  patientId: string;
  patientName: string;
  phone?: string;
  accessionNumber?: string;
  examinationName?: string;
  modality?: ModalityType;
  status: string;
  targetUrl: string;
}

// ==========================================
// REQUIREMENT 7: SUPPORTING DOCUMENTS (PHASE 3.7)
// ==========================================

export type DocumentCategory =
  | 'REFERRAL'
  | 'LAB_RESULT'
  | 'CONSENT'
  | 'PREVIOUS_REPORT'
  | 'OTHER';

export interface OrderDocumentData {
  id: string;
  imagingOrderId: string;
  patientId: string;
  accessionNumber: string;
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  notes?: string | null;
  uploadedAt: string;
  uploadedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export interface UploadDocumentPayload {
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileBase64: string;
  notes?: string;
}




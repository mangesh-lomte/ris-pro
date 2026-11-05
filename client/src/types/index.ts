export type UserRole = 'ADMIN' | 'RECEPTION' | 'TECHNOLOGIST' | 'RADIOLOGIST';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'COMPLETED';

export type OrderStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

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

export type EquipmentStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

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
  patientId: string; // Persistent unique ID
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    appointments?: number;
    imagingOrders?: number;
  };
}

export interface Appointment {
  id: string;
  appointmentNumber: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'patientId' | 'firstName' | 'lastName'>;
  examination: string;
  modality: ModalityType;
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: AppointmentStatus;
  priority: Priority;
  location?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  imagingOrder?: {
    id: string;
    accessionNumber: string;
    orderStatus: OrderStatus;
  } | null;
}

export interface ImagingOrder {
  id: string;
  accessionNumber: string; // Unique accession number
  patientId: string;
  patient?: Pick<Patient, 'id' | 'patientId' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender'>;
  appointmentId?: string | null;
  appointment?: Pick<Appointment, 'id' | 'appointmentNumber' | 'scheduledStartTime' | 'status' | 'location'> | null;
  modality: ModalityType;
  bodyPart: string;
  clinicalIndication: string;
  referringDoctor: string;
  contrastRequirement: boolean;
  priority: Priority;
  orderStatus: OrderStatus;
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

export interface SystemHealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  environment: string;
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
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

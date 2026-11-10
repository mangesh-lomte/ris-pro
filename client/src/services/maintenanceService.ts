import { apiClient } from '../lib/api';
import { ApiResponse } from '../types';

export interface EquipmentRecord {
  id: string;
  assetTag: string;
  name: string;
  modality: string;
  assetCategory: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: string; // 'AVAILABLE', 'OPERATIONAL', 'BUSY', 'MAINTENANCE', 'UNDER_PM', 'OUT_OF_SERVICE'
  location: string;
  roomNumber?: string | null;
  department?: string | null;
  powerRatingKva?: number | null;
  operatingTempMin?: number | null;
  operatingTempMax?: number | null;
  installationDate?: string | null;
  warrantyExpiry?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  schedules?: PmScheduleRecord[];
  qcChecks?: QcCheckRecord[];
  tickets?: ServiceTicketRecord[];
  downtimes?: DowntimeLogRecord[];
  contracts?: ContractRecord[];
  certificates?: CalibrationCertRecord[];
}

export interface PmScheduleRecord {
  id: string;
  scheduleNumber: string;
  equipmentId: string;
  title: string;
  maintenanceType: string;
  frequency: string;
  intervalDays: number;
  contractType?: string | null;
  scheduledDate: string;
  nextDueDate: string;
  lastCompletedDate?: string | null;
  assignedEngineer?: string | null;
  vendorName?: string | null;
  status: string; // 'SCHEDULED', 'DUE', 'OVERDUE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  notes?: string | null;
  completedChecklist?: any;
  completedById?: string | null;
  completedByName?: string | null;
  completedAt?: string | null;
  equipment?: EquipmentRecord;
  createdAt: string;
  updatedAt: string;
}

export interface QcCheckRecord {
  id: string;
  checkNumber: string;
  equipmentId: string;
  frequency: string;
  checkDate: string;
  performedById: string;
  performedByName: string;
  performedByRole: string;
  overallResult: string; // 'PASS', 'FAIL', 'WARNING'
  temperatureC?: number | null;
  humidityPercent?: number | null;
  chillerTempC?: number | null;
  heliumLevelPercent?: number | null;
  ctNumberWaterHu?: number | null;
  noiseVariance?: number | null;
  checklistData: any;
  notes?: string | null;
  equipment?: EquipmentRecord;
  createdAt: string;
}

export interface PmChecklistTemplateRecord {
  id: string;
  code: string;
  title: string;
  modality: string;
  frequency: string;
  oemManufacturer?: string | null;
  version: string;
  sections: Array<{
    category: string;
    items: string[];
  }>;
  active: boolean;
}

export interface ServiceTicketRecord {
  id: string;
  ticketNumber: string;
  equipmentId: string;
  title: string;
  description: string;
  errorCodes?: string | null;
  priority: string; // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  status: string; // 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'CLOSED'
  reportedById: string;
  reportedByName: string;
  assignedEngineer?: string | null;
  vendorName?: string | null;
  isDowntimeCaused: boolean;
  downtimeId?: string | null;
  openedAt: string;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  resolutionNotes?: string | null;
  rootCause?: string | null;
  equipment?: EquipmentRecord;
  partsUsages?: MaintenancePartUsageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DowntimeLogRecord {
  id: string;
  downtimeNumber: string;
  equipmentId: string;
  serviceTicketId?: string | null;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  causeCategory: string;
  cause: string;
  impactLevel: string;
  affectedAppointmentsCount: number;
  affectedAppointmentIds?: any;
  rescheduledCount: number;
  resolutionSummary?: string | null;
  recordedById: string;
  recordedByName: string;
  equipment?: EquipmentRecord;
  serviceTicket?: ServiceTicketRecord;
  createdAt: string;
}

export interface MaintenancePartUsageRecord {
  id: string;
  equipmentId: string;
  serviceTicketId?: string | null;
  pmScheduleId?: string | null;
  inventoryItemId: string;
  batchId?: string | null;
  stockTransactionId?: string | null;
  location: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  installedById: string;
  installedByName: string;
  installedAt: string;
  equipment?: EquipmentRecord;
  inventoryItem?: any;
  batch?: any;
}

export interface ServiceRecordItem {
  id: string;
  recordNumber: string;
  equipmentId: string;
  serviceType: string;
  serviceDate: string;
  serviceProvider: string;
  engineerName: string;
  engineerContact?: string | null;
  workDescription: string;
  partsReplaced?: string | null;
  findingsAndRecommendations?: string | null;
  statusBefore: string;
  statusAfter: string;
  cost?: number | null;
  serviceTicketId?: string | null;
  pmScheduleId?: string | null;
  equipment?: EquipmentRecord;
  createdAt: string;
}

export interface CalibrationCertRecord {
  id: string;
  certificateNumber: string;
  equipmentId: string;
  certificationType: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: string; // 'VALID', 'EXPIRING_SOON', 'EXPIRED'
  documentReference?: string | null;
  measuredValues?: any;
  passed: boolean;
  certifiedByName: string;
  remarks?: string | null;
  equipment?: EquipmentRecord;
  createdAt: string;
  isExpired?: boolean;
  isExpiring?: boolean;
}

export interface ContractRecord {
  id: string;
  contractNumber: string;
  equipmentId: string;
  contractType: string;
  vendorName: string;
  vendorContact?: string | null;
  startDate: string;
  endDate: string;
  coverageDetails: string;
  annualCost?: number | null;
  responseSlaHours: number;
  status: string; // 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED'
  contactPerson?: string | null;
  escalationContact?: string | null;
  equipment?: EquipmentRecord;
  createdAt: string;
  isExpired?: boolean;
  isExpiring?: boolean;
}

export interface ServiceContactRecord {
  id: string;
  vendorName: string;
  contactPerson: string;
  role: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  supportHours: string;
  isEmergencyContact: boolean;
  notes?: string | null;
  active: boolean;
  createdAt: string;
}

export interface AvailabilitySummaryRecord {
  totalEquipment: number;
  totalUnits?: number;
  availableUnits?: number;
  underPmUnits?: number;
  outOfServiceUnits?: number;
  statusBreakdown: Record<string, number>;
  activeDowntimesCount: number;
  activeDowntimes: DowntimeLogRecord[];
  equipmentList: EquipmentRecord[];
}

export interface MaintenanceRemindersRecord {
  daysLookahead: number;
  upcomingPms: PmScheduleRecord[];
  expiringContracts: ContractRecord[];
  expiringCertificates: CalibrationCertRecord[];
  openTickets: ServiceTicketRecord[];
  activeDowntimes: DowntimeLogRecord[];
}

export interface PerformanceAnalyticsRecord {
  equipmentId?: string;
  periodDays: number;
  totalPeriodMinutes?: number;
  totalDowntimeMinutes?: number;
  totalOperatingHours?: number;
  totalDowntimeHours?: number;
  uptimePercentage: number;
  breakdownCount: number;
  pmCount?: number;
  mtbfHours: number;
  mttrHours: number;
  estimatedPartsCost?: number;
  downtimeByCause?: Record<string, number>;
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const maintenanceService = {
  // 1. Equipment Asset Register
  async listEquipment(filters?: {
    modality?: string;
    assetCategory?: string;
    status?: string;
    search?: string;
    activeOnly?: boolean;
  }): Promise<ApiResponse<EquipmentRecord[]>> {
    return apiClient<EquipmentRecord[]>(`/maintenance/equipment${buildQuery(filters)}`);
  },

  async getEquipmentById(id: string): Promise<ApiResponse<EquipmentRecord>> {
    return apiClient<EquipmentRecord>(`/maintenance/equipment/${encodeURIComponent(id)}`);
  },

  async createEquipment(data: any): Promise<ApiResponse<EquipmentRecord>> {
    return apiClient<EquipmentRecord>('/maintenance/equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEquipment(id: string, data: any): Promise<ApiResponse<EquipmentRecord>> {
    return apiClient<EquipmentRecord>(`/maintenance/equipment/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 2. PM Schedule Calendar
  async listPmSchedules(filters?: {
    equipmentId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PmScheduleRecord[]>> {
    return apiClient<PmScheduleRecord[]>(`/maintenance/pm-schedules${buildQuery(filters)}`);
  },

  async createPmSchedule(data: any): Promise<ApiResponse<PmScheduleRecord>> {
    return apiClient<PmScheduleRecord>('/maintenance/pm-schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async completePmSchedule(id: string, data: any): Promise<ApiResponse<PmScheduleRecord>> {
    return apiClient<PmScheduleRecord>(`/maintenance/pm-schedules/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 3. Daily / Weekly QC Checklist
  async listQcChecks(filters?: {
    equipmentId?: string;
    frequency?: string;
  }): Promise<ApiResponse<QcCheckRecord[]>> {
    return apiClient<QcCheckRecord[]>(`/maintenance/qc-checks${buildQuery(filters)}`);
  },

  async recordQcCheck(data: any): Promise<ApiResponse<QcCheckRecord>> {
    return apiClient<QcCheckRecord>('/maintenance/qc-checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 4. PM Checklist by Modality
  async listPmTemplates(modality?: string): Promise<ApiResponse<PmChecklistTemplateRecord[]>> {
    return apiClient<PmChecklistTemplateRecord[]>(`/maintenance/pm-templates${buildQuery({ modality })}`);
  },

  // 5. Service Ticket / Breakdown
  async listServiceTickets(filters?: {
    equipmentId?: string;
    status?: string;
    priority?: string;
  }): Promise<ApiResponse<ServiceTicketRecord[]>> {
    return apiClient<ServiceTicketRecord[]>(`/maintenance/service-tickets${buildQuery(filters)}`);
  },

  async createServiceTicket(data: any): Promise<ApiResponse<ServiceTicketRecord>> {
    return apiClient<ServiceTicketRecord>('/maintenance/service-tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateServiceTicketStatus(id: string, data: any): Promise<ApiResponse<ServiceTicketRecord>> {
    return apiClient<ServiceTicketRecord>(`/maintenance/service-tickets/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // 6. Machine Downtime Log
  async listDowntimes(filters?: {
    equipmentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<DowntimeLogRecord[]>> {
    return apiClient<DowntimeLogRecord[]>(`/maintenance/downtimes${buildQuery(filters)}`);
  },

  async startDowntime(data: any): Promise<ApiResponse<DowntimeLogRecord>> {
    return apiClient<DowntimeLogRecord>('/maintenance/downtimes/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async endDowntime(id: string, data: any): Promise<ApiResponse<DowntimeLogRecord>> {
    return apiClient<DowntimeLogRecord>(`/maintenance/downtimes/${encodeURIComponent(id)}/end`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 7. Parts and Spare Stock
  async listPartUsages(filters?: {
    equipmentId?: string;
    serviceTicketId?: string;
  }): Promise<ApiResponse<MaintenancePartUsageRecord[]>> {
    return apiClient<MaintenancePartUsageRecord[]>(`/maintenance/parts/usage${buildQuery(filters)}`);
  },

  async consumePart(data: any): Promise<ApiResponse<MaintenancePartUsageRecord>> {
    return apiClient<MaintenancePartUsageRecord>('/maintenance/parts/consume', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 8. Service History
  async getServiceHistory(equipmentId: string): Promise<ApiResponse<any>> {
    return apiClient<any>(`/maintenance/equipment/${encodeURIComponent(equipmentId)}/service-history`);
  },

  async createServiceRecord(data: any): Promise<ApiResponse<ServiceRecordItem>> {
    return apiClient<ServiceRecordItem>('/maintenance/service-records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 9. Calibration / Test Certificates
  async listCalibrationCertificates(filters?: {
    equipmentId?: string;
    status?: string;
  }): Promise<ApiResponse<CalibrationCertRecord[]>> {
    return apiClient<CalibrationCertRecord[]>(`/maintenance/calibration-certificates${buildQuery(filters)}`);
  },

  async recordCalibrationCertificate(data: any): Promise<ApiResponse<CalibrationCertRecord>> {
    return apiClient<CalibrationCertRecord>('/maintenance/calibration-certificates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 10. AMC / Warranty Tracker
  async listContracts(filters?: {
    equipmentId?: string;
    status?: string;
  }): Promise<ApiResponse<ContractRecord[]>> {
    return apiClient<ContractRecord[]>(`/maintenance/contracts${buildQuery(filters)}`);
  },

  async recordContract(data: any): Promise<ApiResponse<ContractRecord>> {
    return apiClient<ContractRecord>('/maintenance/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 11. Engineer / Supplier Contacts
  async listContacts(filters?: {
    vendorName?: string;
    role?: string;
  }): Promise<ApiResponse<ServiceContactRecord[]>> {
    return apiClient<ServiceContactRecord[]>(`/maintenance/contacts${buildQuery(filters)}`);
  },

  async createContact(data: any): Promise<ApiResponse<ServiceContactRecord>> {
    return apiClient<ServiceContactRecord>('/maintenance/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 12. Machine Availability Status
  async getAvailabilitySummary(): Promise<ApiResponse<AvailabilitySummaryRecord>> {
    return apiClient<AvailabilitySummaryRecord>('/maintenance/availability/summary');
  },

  async setAvailability(id: string, data: { status: string; reason?: string }): Promise<ApiResponse<any>> {
    return apiClient<any>(`/maintenance/equipment/${encodeURIComponent(id)}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // 13. Maintenance Reminders
  async getReminders(days?: number): Promise<ApiResponse<MaintenanceRemindersRecord>> {
    return apiClient<MaintenanceRemindersRecord>(`/maintenance/reminders${buildQuery({ days })}`);
  },

  // 14. Equipment Performance Analytics
  async getAnalytics(filters?: {
    equipmentId?: string;
    periodDays?: number;
  }): Promise<ApiResponse<PerformanceAnalyticsRecord>> {
    return apiClient<PerformanceAnalyticsRecord>(`/maintenance/analytics${buildQuery(filters)}`);
  },
};

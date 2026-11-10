import { apiClient } from '../lib/api';

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role: 'ADMIN' | 'RADIOLOGIST' | 'TECHNOLOGIST' | 'RECEPTION';
  department?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  patientId?: string | null;
  accessionNumber?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export interface PatientMergeRecord {
  id: string;
  sourceMrn: string;
  targetMrn: string;
  sourceName: string;
  targetName: string;
  reason: string;
  reassignedCounts: {
    orders: number;
    appointments: number;
    studies: number;
    invoices: number;
    quotations: number;
    safetyScreenings: number;
    preparations: number;
    externalShares: number;
    shareConsents: number;
    outsideImports: number;
    total: number;
  };
  mergedBy: string;
  createdAt: string;
}

export interface RetentionRule {
  id: string;
  dataCategory: string;
  policyName: string;
  retentionYears: number;
  legalBasis: string;
  description?: string | null;
  actionOnExpiry: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupRecord {
  id: string;
  backupType: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string | null;
  filename: string;
  filePath?: string | null;
  sizeBytes?: number | null;
  recordCount: number;
  checksumSha256?: string | null;
  triggeredBy: string;
  notes?: string | null;
  verificationDetails?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DrDrillRecord {
  id: string;
  drillName: string;
  drillType: string;
  drillDate: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  recoveryTarget: string;
  simulatedRtoMinutes: number;
  simulatedRpoMinutes: number;
  findings: string;
  conductedBy: string;
  createdAt: string;
}

export interface IntegrationHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  interfaces: {
    database: {
      name: string;
      type: string;
      status: string;
      latencyMs: number;
      error?: string | null;
    };
    pacs: {
      name: string;
      type: string;
      status: string;
      details?: Record<string, unknown>;
    };
    viewer?: {
      name: string;
      type: string;
      status: string;
      route: string;
    };
    modalities: {
      name: string;
      type: string;
      status: string;
      configuredCount: number;
    };
    messaging: {
      name: string;
      type: string;
      status: string;
      deliveryLogged: boolean;
    };
    hl7_fhir: {
      name: string;
      type: string;
      status: string;
      endpoint: string;
    };
  };
}

export interface SecurityOverview {
  status?: string;
  controls?: {
    authentication?: {
      enabled: boolean;
      type: string;
      tokenExpiryHours: number;
    };
    rbac?: {
      enabled: boolean;
      enforcement: string;
      rolesSupported: string[];
    };
    dataProtection?: {
      helmetHeaders: boolean;
      corsRestricted: boolean;
      corsOrigin: string;
      credentialStrippingInLogs: boolean;
      mandatoryOtpSharing: boolean;
    };
  };
  activeSecurityControls?: {
    rbacEnforcement: boolean;
    jwtExpiryMinutes: number;
    passwordHashing: string;
    auditTrailEnabled: boolean;
    shareVerificationMandatory: boolean;
    httpsTlsReady: boolean;
  };
  userMetrics?: {
    totalUsers: number;
    activeUsers: number;
    deactivatedUsers?: number;
    disabledUsers?: number;
    roleDistribution?: Array<{ role: string; count: number }>;
    byRole?: Record<string, number>;
  };
  auditMetrics?: {
    totalAuditsLogged?: number;
    totalEventsLogged?: number;
    lastLoginEvent?: string | null;
    eventsLast24Hours?: number;
    topActions?: Array<{ action: string; count: number }>;
  };
  evaluatedAt?: string;
}

function toQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const adminService = {
  // 1. Users
  async getUsers(params?: { role?: string; search?: string }): Promise<AdminUser[]> {
    const query = toQueryString(params);
    const res = await apiClient<{ items: AdminUser[]; total: number }>(`/admin/users${query}`);
    return Array.isArray(res.data) ? res.data : (res.data as any)?.items || [];
  },

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    department?: string;
    phoneNumber?: string;
  }): Promise<AdminUser> {
    const res = await apiClient<AdminUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    role?: string;
    department?: string;
    phoneNumber?: string;
    isActive?: boolean;
    password?: string;
  }): Promise<AdminUser> {
    const res = await apiClient<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async deactivateUser(id: string, reason?: string): Promise<AdminUser> {
    const res = await apiClient<AdminUser>(`/admin/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },

  // 2. Audit Trail
  async getAuditLogs(params?: {
    actorId?: string;
    action?: string;
    entityType?: string;
    patientId?: string;
    accessionNumber?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminAuditLog[]; total: number; page: number; totalPages: number }> {
    const query = toQueryString(params);
    const res = await apiClient<{ items: AdminAuditLog[]; total: number; page: number; totalPages: number }>(`/admin/audit-logs${query}`);
    return res.data;
  },

  // 3. Patient Merge
  async mergePatients(data: {
    sourceMrn: string;
    targetMrn: string;
    reason: string;
  }): Promise<PatientMergeRecord> {
    const res = await apiClient<PatientMergeRecord>('/admin/patients/merge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async getMergeHistory(): Promise<PatientMergeRecord[]> {
    const res = await apiClient<PatientMergeRecord[]>('/admin/patients/merge-history');
    return res.data;
  },

  // 4. Security Overview
  async getSecurityOverview(): Promise<SecurityOverview> {
    const res = await apiClient<SecurityOverview>('/admin/security/overview');
    return res.data;
  },

  // 5. Consent & Retention
  async getRetentionRules(): Promise<RetentionRule[]> {
    const res = await apiClient<RetentionRule[]>('/admin/retention/rules');
    return res.data;
  },

  async createRetentionRule(data: {
    dataCategory: string;
    policyName: string;
    retentionYears: number;
    legalBasis: string;
    description?: string;
    actionOnExpiry?: string;
  }): Promise<RetentionRule> {
    const res = await apiClient<RetentionRule>('/admin/retention/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async getRetentionAuditSummary(): Promise<any> {
    const res = await apiClient<any>('/admin/retention/audit-summary');
    return res.data;
  },

  async getConsentSummary(): Promise<any> {
    const res = await apiClient<any>('/admin/consent/summary');
    return res.data;
  },

  // 6. Service & Report Masters
  async getExamCatalog(category?: string): Promise<any[]> {
    const query = category ? `?category=${category}` : '';
    const res = await apiClient<any[]>(`/admin/exam-catalog${query}`);
    return res.data;
  },

  async createExamDefinition(data: {
    code: string;
    name: string;
    modality: string;
    bodyPart?: string;
    typicalDurationMinutes?: number;
    requiresContrast?: boolean;
    preparationInstructions?: string;
    category?: string;
    basePrice?: number;
  }): Promise<any> {
    const res = await apiClient<any>('/admin/exam-catalog', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateExamDefinition(id: string, data: any): Promise<any> {
    const res = await apiClient<any>(`/admin/exam-catalog/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async getReportingTemplates(modality?: string): Promise<any[]> {
    const query = modality ? `?modality=${modality}` : '';
    const res = await apiClient<any[]>(`/admin/reporting-templates${query}`);
    return res.data;
  },

  async createReportingTemplate(data: {
    modality: string;
    bodyPart: string;
    title: string;
    technique?: string;
    findings: string;
    impression: string;
    isDefault?: boolean;
    language?: string;
  }): Promise<any> {
    const res = await apiClient<any>('/admin/reporting-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async updateReportingTemplate(id: string, data: any): Promise<any> {
    const res = await apiClient<any>(`/admin/reporting-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  // 7. Operational KPI Reports
  async getOperationalKpiReport(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = toQueryString(params);
    const res = await apiClient<any>(`/admin/reports/operational-kpi${query}`);
    return res.data;
  },

  // 8. Quality & Incident Reports
  async getQualityIncidentsReport(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = toQueryString(params);
    const res = await apiClient<any>(`/admin/reports/quality-incidents${query}`);
    return res.data;
  },

  // 9. Integration Health
  async getIntegrationHealth(): Promise<IntegrationHealth> {
    const res = await apiClient<IntegrationHealth>('/admin/integration-health');
    return res.data;
  },

  // 10. Backup & DR
  async triggerBackup(notes?: string): Promise<BackupRecord> {
    const res = await apiClient<BackupRecord>('/admin/backups/trigger', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    return res.data;
  },

  async listBackups(): Promise<BackupRecord[]> {
    const res = await apiClient<BackupRecord[]>('/admin/backups');
    return res.data;
  },

  async verifyBackup(id: string): Promise<any> {
    const res = await apiClient<any>(`/admin/backups/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data;
  },

  async recordDrDrill(data: {
    drillName: string;
    drillType?: string;
    status: string;
    recoveryTarget: string;
    simulatedRtoMinutes: number;
    simulatedRpoMinutes: number;
    findings: string;
  }): Promise<DrDrillRecord> {
    const res = await apiClient<DrDrillRecord>('/admin/dr-drills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async listDrDrills(): Promise<DrDrillRecord[]> {
    const res = await apiClient<DrDrillRecord[]>('/admin/dr-drills');
    return res.data;
  },
};

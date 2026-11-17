import React, { useEffect, useState, useCallback } from 'react';
import {
  adminService,
  AdminUser,
  AdminAuditLog,
  PatientMergeRecord,
  RetentionRule,
  BackupRecord,
  DrDrillRecord,
  IntegrationHealth,
  SecurityOverview,
} from '../services/adminService';
import {
  Users,
  ShieldCheck,
  GitMerge,
  Activity,
  Archive,
  BarChart2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Lock,
  FileCheck2,
  Layers,
  ChevronDown
} from 'lucide-react';
import { UsersRolesTab } from '../features/admin/UsersRolesTab';
import { AuditTrailTab } from '../features/admin/AuditTrailTab';
import { PatientMergeTab } from '../features/admin/PatientMergeTab';
import { PrivacySecurityTab } from '../features/admin/PrivacySecurityTab';
import { ConsentRetentionTab } from '../features/admin/ConsentRetentionTab';
import { ServiceMastersTab } from '../features/admin/ServiceMastersTab';
import { OperationalKpisTab } from '../features/admin/OperationalKpisTab';
import { QualityIncidentsTab } from '../features/admin/QualityIncidentsTab';
import { IntegrationHealthTab } from '../features/admin/IntegrationHealthTab';
import { BackupDrTab } from '../features/admin/BackupDrTab';

export type AdminTabKey =
  | 'users'
  | 'security'
  | 'audit'
  | 'merge'
  | 'retention'
  | 'masters'
  | 'kpi'
  | 'quality'
  | 'health'
  | 'backup';

export type AdminCategoryKey =
  | 'ALL'
  | 'SECURITY'
  | 'GOVERNANCE'
  | 'OPERATIONS'
  | 'INFRASTRUCTURE';

interface TabDefinition {
  key: AdminTabKey;
  label: string;
  category: 'SECURITY' | 'GOVERNANCE' | 'OPERATIONS' | 'INFRASTRUCTURE';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ADMIN_TABS: TabDefinition[] = [
  {
    key: 'users',
    label: 'Users & Roles',
    category: 'SECURITY',
    icon: Users,
    description: 'Staff accounts & role assignments',
  },
  {
    key: 'security',
    label: 'Privacy & Security',
    category: 'SECURITY',
    icon: Lock,
    description: 'Access control & credential security',
  },
  {
    key: 'audit',
    label: 'Audit Trail',
    category: 'GOVERNANCE',
    icon: FileCheck2,
    description: 'Tamper-evident clinical event logs',
  },
  {
    key: 'merge',
    label: 'Patient Merge',
    category: 'GOVERNANCE',
    icon: GitMerge,
    description: 'Atomic record reassignment & correction',
  },
  {
    key: 'retention',
    label: 'Consent & Retention',
    category: 'GOVERNANCE',
    icon: Archive,
    description: 'Statutory healthcare policies & consents',
  },
  {
    key: 'masters',
    label: 'Service Masters',
    category: 'OPERATIONS',
    icon: Layers,
    description: 'Exam catalog & reporting templates',
  },
  {
    key: 'kpi',
    label: 'Operational KPIs',
    category: 'OPERATIONS',
    icon: BarChart2,
    description: 'Volume throughput & turnaround times',
  },
  {
    key: 'quality',
    label: 'Quality & Incidents',
    category: 'OPERATIONS',
    icon: AlertTriangle,
    description: 'Repeat scans, adverse events & peer review',
  },
  {
    key: 'health',
    label: 'Integration Health',
    category: 'INFRASTRUCTURE',
    icon: Activity,
    description: 'PACS, database & modality interfaces',
  },
  {
    key: 'backup',
    label: 'Backup & DR',
    category: 'INFRASTRUCTURE',
    icon: HardDrive,
    description: 'Database snapshots & disaster drills',
  },
];

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('users');
  const [activeCategory, setActiveCategory] = useState<AdminCategoryKey>('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');

  // Patient Merge State
  const [mergeHistory, setMergeHistory] = useState<PatientMergeRecord[]>([]);

  // Security Posture State
  const [securityData, setSecurityData] = useState<SecurityOverview | null>(null);

  // Retention Rules State
  const [retentionRules, setRetentionRules] = useState<RetentionRule[]>([]);
  const [retentionAudit, setRetentionAudit] = useState<any>(null);
  const [consentSummary, setConsentSummary] = useState<any>(null);

  // Masters State
  const [examCatalog, setExamCatalog] = useState<any[]>([]);
  const [reportingTemplates, setReportingTemplates] = useState<any[]>([]);

  // KPI & Quality Reports State
  const [kpiReport, setKpiReport] = useState<any>(null);
  const [qualityReport, setQualityReport] = useState<any>(null);

  // Integration Health State
  const [healthData, setHealthData] = useState<IntegrationHealth | null>(null);

  // Backup & DR State
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [drDrills, setDrDrills] = useState<DrDrillRecord[]>([]);
  const [backupTriggering, setBackupTriggering] = useState(false);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(null), 6000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  // Load Tab Specific Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'users') {
        const u = await adminService.getUsers();
        setUsers(u);
      } else if (activeTab === 'audit') {
        const res = await adminService.getAuditLogs({
          page: auditPage,
          limit: 15,
          action: auditActionFilter || undefined,
          entityType: auditEntityFilter || undefined,
        });
        setAuditLogs(res.items);
        setAuditTotal(res.total);
      } else if (activeTab === 'merge') {
        const history = await adminService.getMergeHistory();
        setMergeHistory(history);
      } else if (activeTab === 'security') {
        const sec = await adminService.getSecurityOverview();
        setSecurityData(sec);
      } else if (activeTab === 'retention') {
        const [rules, audit, consent] = await Promise.all([
          adminService.getRetentionRules(),
          adminService.getRetentionAuditSummary(),
          adminService.getConsentSummary(),
        ]);
        setRetentionRules(rules);
        setRetentionAudit(audit);
        setConsentSummary(consent);
      } else if (activeTab === 'masters') {
        const [exams, tmpls] = await Promise.all([
          adminService.getExamCatalog(),
          adminService.getReportingTemplates(),
        ]);
        setExamCatalog(exams);
        setReportingTemplates(tmpls);
      } else if (activeTab === 'kpi') {
        const kpi = await adminService.getOperationalKpiReport();
        setKpiReport(kpi);
      } else if (activeTab === 'quality') {
        const qual = await adminService.getQualityIncidentsReport();
        setQualityReport(qual);
      } else if (activeTab === 'health') {
        const h = await adminService.getIntegrationHealth();
        setHealthData(h);
      } else if (activeTab === 'backup') {
        const [b, d] = await Promise.all([
          adminService.listBackups(),
          adminService.listDrDrills(),
        ]);
        setBackups(b);
        setDrDrills(d);
      }
    } catch (err: any) {
      showNotification(
        err?.response?.data?.message || err?.message || 'Error loading administration data',
        true
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, auditPage, auditActionFilter, auditEntityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Backup Trigger Handler
  const handleTriggerBackup = async () => {
    try {
      setBackupTriggering(true);
      const res = await adminService.triggerBackup('Admin manual database snapshot');
      showNotification(`Backup snapshot generated: ${res.filename} (${res.recordCount} records).`);
      loadData();
    } catch (err: any) {
      showNotification(err?.response?.data?.message || err?.message || 'Backup failed', true);
    } finally {
      setBackupTriggering(false);
    }
  };

  // Backup Verify Handler
  const handleVerifyBackup = async (id: string) => {
    try {
      const res = await adminService.verifyBackup(id);
      showNotification(`Backup verified: SHA-256 integrity match (${res.verifiedChecksum})`);
      loadData();
    } catch (err: any) {
      showNotification(err?.response?.data?.message || err?.message || 'Verification failed', true);
    }
  };

  // Filter tabs by active category
  const visibleTabs = ADMIN_TABS.filter((tab) => {
    if (activeCategory === 'ALL') return true;
    return tab.category === activeCategory;
  });

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Header */}
      <div className="rounded-3xl border border-[#dce6e0] bg-white p-5 md:p-6 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Enterprise RIS Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Administration &amp; Governance</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Clinical governance, security controls, audit trail, service masters &amp; disaster recovery
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-200/80 bg-emerald-50 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />RBAC Active
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-200/80 bg-blue-50 text-[11px] font-bold text-blue-800">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />Audit Trail
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-sky-200/80 bg-sky-50 text-[11px] font-bold text-sky-800">
              <HardDrive className="w-3.5 h-3.5 text-sky-600" />Snapshots
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-200/80 bg-emerald-50 text-[11px] font-bold text-emerald-800">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />Integrations OK
            </span>
          </div>
        </div>
        <button
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-soft transition-all disabled:opacity-50 shrink-0 self-start lg:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/80 text-rose-900 rounded-2xl flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 text-emerald-900 rounded-2xl flex items-center justify-between shadow-soft">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-semibold">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Controls: Categories + Direct Selector + Tab Rail */}
      <div className="space-y-3">
        {/* Category Filter Pills & Direct Jump Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-3xl border border-[#dce6e0] shadow-soft">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: `All Sections (${ADMIN_TABS.length})` },
              { id: 'SECURITY', label: 'Security & Access' },
              { id: 'GOVERNANCE', label: 'Clinical Governance' },
              { id: 'OPERATIONS', label: 'Operations & Masters' },
              { id: 'INFRASTRUCTURE', label: 'Infrastructure & DR' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as AdminCategoryKey)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-soft'
                    : 'bg-[#f4f7f5] text-slate-700 hover:bg-[#edf2ee]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick-Jump Section Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="admin-direct-jump-selector" className="text-xs font-bold text-slate-600 whitespace-nowrap">
              Jump to section:
            </label>
            <div className="relative">
              <select
                id="admin-direct-jump-selector"
                aria-label="Direct section navigation selector"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as AdminTabKey)}
                className="appearance-none bg-[#f4f7f5] hover:bg-[#edf2ee] border border-slate-200/80 rounded-full pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-soft cursor-pointer"
              >
                {ADMIN_TABS.map((t, idx) => (
                  <option key={t.key} value={t.key}>
                    {idx + 1}. {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Scrollable Tab Rail */}
        <div className="overflow-x-auto pb-1">
          <nav className="flex space-x-2 p-1.5 bg-[#f4f8f5]/80 rounded-3xl border border-[#dce6e0] shadow-soft" aria-label="Administration Sections" role="tablist">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isCurrent = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-900 text-white shadow-soft'
                      : 'bg-white/80 hover:bg-white text-slate-600 border border-transparent hover:border-[#dce6e0]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ACTIVE SECTION CONTENT */}
      <div className="pt-1">
        {/* TAB 1: Users & Roles */}
        {activeTab === 'users' && (
          <UsersRolesTab
            users={users}
            loading={loading}
            onRefresh={loadData}
            onNotify={showNotification}
          />
        )}

        {/* TAB 2: Privacy & Security */}
        {activeTab === 'security' && (
          <PrivacySecurityTab
            securityData={securityData}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {/* TAB 3: Audit Trail */}
        {activeTab === 'audit' && (
          <AuditTrailTab
            auditLogs={auditLogs}
            auditTotal={auditTotal}
            auditPage={auditPage}
            auditActionFilter={auditActionFilter}
            auditEntityFilter={auditEntityFilter}
            loading={loading}
            onPageChange={(page) => setAuditPage(page)}
            onFilterChange={(action, entity) => {
              setAuditActionFilter(action);
              setAuditEntityFilter(entity);
              setAuditPage(1);
            }}
            onRefresh={loadData}
          />
        )}

        {/* TAB 4: Patient Record Merge */}
        {activeTab === 'merge' && (
          <PatientMergeTab
            mergeHistory={mergeHistory}
            loading={loading}
            onRefresh={loadData}
            onNotify={showNotification}
          />
        )}

        {/* TAB 5: Consent & Retention Rules */}
        {activeTab === 'retention' && (
          <ConsentRetentionTab
            retentionRules={retentionRules}
            retentionAudit={retentionAudit}
            consentSummary={consentSummary}
            loading={loading}
            onRefresh={loadData}
            onNotify={showNotification}
          />
        )}

        {/* TAB 6: Service & Report Masters */}
        {activeTab === 'masters' && (
          <ServiceMastersTab
            examCatalog={examCatalog}
            reportingTemplates={reportingTemplates}
            loading={loading}
            onRefresh={loadData}
            onNotify={showNotification}
          />
        )}

        {/* TAB 7: Operational KPIs */}
        {activeTab === 'kpi' && (
          <OperationalKpisTab
            kpiReport={kpiReport}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {/* TAB 8: Quality & Incidents */}
        {activeTab === 'quality' && (
          <QualityIncidentsTab
            qualityReport={qualityReport}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {/* TAB 9: Integration Health */}
        {activeTab === 'health' && (
          <IntegrationHealthTab
            healthData={healthData}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {/* TAB 10: Backup & Disaster Recovery */}
        {activeTab === 'backup' && (
          <BackupDrTab
            backups={backups}
            drDrills={drDrills}
            backupTriggering={backupTriggering}
            loading={loading}
            onTriggerBackup={handleTriggerBackup}
            onVerifyBackup={handleVerifyBackup}
            onRefresh={loadData}
            onNotify={showNotification}
          />
        )}
      </div>
    </div>
  );
};

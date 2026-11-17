import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu,
  Calendar,
  CheckCircle2,
  Layers,
  Wrench,
  Clock,
  Package,
  History,
  FileCheck2,
  FileText,
  Phone,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Filter
} from 'lucide-react';
import {
  maintenanceService,
  EquipmentRecord,
  PmScheduleRecord,
  QcCheckRecord,
  PmChecklistTemplateRecord,
  ServiceTicketRecord,
  DowntimeLogRecord,
  MaintenancePartUsageRecord,
  CalibrationCertRecord,
  ContractRecord,
  ServiceContactRecord,
  AvailabilitySummaryRecord,
  MaintenanceRemindersRecord,
  PerformanceAnalyticsRecord,
} from '../services/maintenanceService';
import { EquipmentRegisterTab } from '../features/maintenance/EquipmentRegisterTab';
import { PmCalendarTab } from '../features/maintenance/PmCalendarTab';
import { QcChecklistTab } from '../features/maintenance/QcChecklistTab';
import { PmTemplatesTab } from '../features/maintenance/PmTemplatesTab';
import { ServiceTicketsTab } from '../features/maintenance/ServiceTicketsTab';
import { DowntimeLogTab } from '../features/maintenance/DowntimeLogTab';
import { PartsUsageTab } from '../features/maintenance/PartsUsageTab';
import { ServiceHistoryTab } from '../features/maintenance/ServiceHistoryTab';
import { CalibrationCertsTab } from '../features/maintenance/CalibrationCertsTab';
import { ContractsTab } from '../features/maintenance/ContractsTab';
import { ServiceContactsTab } from '../features/maintenance/ServiceContactsTab';
import { MaintenanceRemindersTab } from '../features/maintenance/MaintenanceRemindersTab';
import { PerformanceAnalyticsTab } from '../features/maintenance/PerformanceAnalyticsTab';
import { CreateEquipmentModal } from '../features/maintenance/modals/CreateEquipmentModal';
import { SchedulePmModal } from '../features/maintenance/modals/SchedulePmModal';
import { CompletePmModal } from '../features/maintenance/modals/CompletePmModal';
import { RecordQcModal } from '../features/maintenance/modals/RecordQcModal';
import { CreateTicketModal } from '../features/maintenance/modals/CreateTicketModal';
import { StartDowntimeModal } from '../features/maintenance/modals/StartDowntimeModal';
import { EndDowntimeModal } from '../features/maintenance/modals/EndDowntimeModal';
import { ConsumePartModal } from '../features/maintenance/modals/ConsumePartModal';
import { RecordCertificateModal } from '../features/maintenance/modals/RecordCertificateModal';
import { RecordContractModal } from '../features/maintenance/modals/RecordContractModal';
import { CreateContactModal } from '../features/maintenance/modals/CreateContactModal';

export type MaintenanceTabKey =
  | 'equipment'
  | 'reminders'
  | 'pm-calendar'
  | 'qc-checks'
  | 'pm-templates'
  | 'tickets'
  | 'downtimes'
  | 'parts'
  | 'history'
  | 'certificates'
  | 'contracts'
  | 'contacts'
  | 'analytics';

interface TabDefinition {
  key: MaintenanceTabKey;
  label: string;
  category: 'ASSETS' | 'PREVENTIVE' | 'BREAKDOWN' | 'COMPLIANCE';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const MaintenancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MaintenanceTabKey>('equipment');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'ASSETS' | 'PREVENTIVE' | 'BREAKDOWN' | 'COMPLIANCE'>('ALL');

  // State
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [schedules, setSchedules] = useState<PmScheduleRecord[]>([]);
  const [qcChecks, setQcChecks] = useState<QcCheckRecord[]>([]);
  const [templates, setTemplates] = useState<PmChecklistTemplateRecord[]>([]);
  const [tickets, setTickets] = useState<ServiceTicketRecord[]>([]);
  const [downtimes, setDowntimes] = useState<DowntimeLogRecord[]>([]);
  const [partUsages, setPartUsages] = useState<MaintenancePartUsageRecord[]>([]);
  const [certificates, setCertificates] = useState<CalibrationCertRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contacts, setContacts] = useState<ServiceContactRecord[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySummaryRecord | null>(null);
  const [reminders, setReminders] = useState<MaintenanceRemindersRecord | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalyticsRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [showCreateEqModal, setShowCreateEqModal] = useState(false);
  const [showSchedulePmModal, setShowSchedulePmModal] = useState(false);
  const [selectedPmForComplete, setSelectedPmForComplete] = useState<PmScheduleRecord | null>(null);
  const [showRecordQcModal, setShowRecordQcModal] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [showStartDowntimeModal, setShowStartDowntimeModal] = useState(false);
  const [selectedDowntimeForEnd, setSelectedDowntimeForEnd] = useState<DowntimeLogRecord | null>(null);
  const [showConsumePartModal, setShowConsumePartModal] = useState(false);
  const [showRecordCertModal, setShowRecordCertModal] = useState(false);
  const [showRecordContractModal, setShowRecordContractModal] = useState(false);
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setBannerMessage({ type, text });
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // Data Loading
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        eqRes,
        schedRes,
        qcRes,
        tktRes,
        dwnRes,
        partsRes,
        certRes,
        contractRes,
        contactRes,
        availRes,
        remRes,
        tmplsRes,
      ] = await Promise.all([
        maintenanceService.listEquipment(),
        maintenanceService.listPmSchedules(),
        maintenanceService.listQcChecks(),
        maintenanceService.listServiceTickets(),
        maintenanceService.listDowntimes(),
        maintenanceService.listPartUsages(),
        maintenanceService.listCalibrationCertificates(),
        maintenanceService.listContracts(),
        maintenanceService.listContacts(),
        maintenanceService.getAvailabilitySummary(),
        maintenanceService.getReminders(30),
        maintenanceService.listPmTemplates(),
      ]);

      if (eqRes.success && eqRes.data) setEquipment(eqRes.data);
      if (schedRes.success && schedRes.data) setSchedules(schedRes.data);
      if (qcRes.success && qcRes.data) setQcChecks(qcRes.data);
      if (tktRes.success && tktRes.data) setTickets(tktRes.data);
      if (dwnRes.success && dwnRes.data) setDowntimes(dwnRes.data);
      if (partsRes.success && partsRes.data) setPartUsages(partsRes.data);
      if (certRes.success && certRes.data) setCertificates(certRes.data);
      if (contractRes.success && contractRes.data) setContracts(contractRes.data);
      if (contactRes.success && contactRes.data) setContacts(contactRes.data);
      if (availRes.success && availRes.data) setAvailability(availRes.data);
      if (remRes.success && remRes.data) setReminders(remRes.data);
      if (tmplsRes.success && tmplsRes.data) setTemplates(tmplsRes.data);

      // Load 30-day analytics
      const anaRes = await maintenanceService.getAnalytics({ periodDays: 30 });
      if (anaRes.success && anaRes.data) setAnalytics(anaRes.data);
    } catch (err: any) {
      console.error('Failed to load maintenance data:', err);
      notify(err?.message || 'Failed to fetch equipment maintenance records', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handler Actions
  const handleCreateEquipment = async (data: any) => {
    const res = await maintenanceService.createEquipment(data);
    if (res.success) {
      notify(`Equipment asset '${res.data?.name}' registered successfully`);
      loadInitialData();
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await maintenanceService.setAvailability(id, { status });
      if (res.success) {
        notify(`Equipment availability status updated to ${status}`);
        loadInitialData();
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to update equipment status', 'error');
    }
  };

  const handleSchedulePm = async (data: any) => {
    const res = await maintenanceService.createPmSchedule(data);
    if (res.success) {
      notify(`Preventive maintenance schedule '${res.data?.scheduleNumber}' planned`);
      loadInitialData();
    }
  };

  const handleCompletePm = async (id: string, data: any) => {
    const res = await maintenanceService.completePmSchedule(id, data);
    if (res.success) {
      notify(`PM schedule '${res.data?.scheduleNumber}' marked completed`);
      loadInitialData();
    }
  };

  const handleRecordQc = async (data: any) => {
    const res = await maintenanceService.recordQcCheck(data);
    if (res.success) {
      notify(`QC Check '${res.data?.checkNumber}' recorded with result ${res.data?.overallResult}`);
      loadInitialData();
    }
  };

  const handleCreateTicket = async (data: any) => {
    const res = await maintenanceService.createServiceTicket(data);
    if (res.success) {
      notify(`Service breakdown ticket '${res.data?.ticketNumber}' submitted`);
      loadInitialData();
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: string, notes?: string, rootCause?: string) => {
    try {
      const res = await maintenanceService.updateServiceTicketStatus(id, { status, resolutionNotes: notes, rootCause });
      if (res.success) {
        notify(`Service ticket '${res.data?.ticketNumber}' updated to ${status}`);
        loadInitialData();
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to update service ticket status', 'error');
    }
  };

  const handleStartDowntime = async (data: any) => {
    const res = await maintenanceService.startDowntime(data);
    if (res.success) {
      notify(`Machine downtime outage '${res.data?.downtimeNumber}' logged. Machine flagged OUT_OF_SERVICE.`);
      loadInitialData();
    }
  };

  const handleEndDowntime = async (id: string, data: any) => {
    const res = await maintenanceService.endDowntime(id, data);
    if (res.success) {
      notify(`Machine downtime ended. Equipment returned to operational service.`);
      loadInitialData();
    }
  };

  const handleConsumePart = async (data: any) => {
    const res = await maintenanceService.consumePart(data);
    if (res.success) {
      notify(`Maintenance spare part consumed and deducted from inventory`);
      loadInitialData();
    }
  };

  const handleRecordCertificate = async (data: any) => {
    const res = await maintenanceService.recordCalibrationCertificate(data);
    if (res.success) {
      notify(`Calibration certificate '${res.data?.certificateNumber}' recorded successfully`);
      loadInitialData();
    }
  };

  const handleRecordContract = async (data: any) => {
    const res = await maintenanceService.recordContract(data);
    if (res.success) {
      notify(`Maintenance contract '${res.data?.contractNumber}' recorded successfully`);
      loadInitialData();
    }
  };

  const handleCreateContact = async (data: any) => {
    const res = await maintenanceService.createContact(data);
    if (res.success) {
      notify(`Service contact '${res.data?.contactPerson}' added to directory`);
      loadInitialData();
    }
  };

  const handleRefreshAnalytics = async (periodDays: number, equipmentId?: string) => {
    const res = await maintenanceService.getAnalytics({ periodDays, equipmentId });
    if (res.success && res.data) {
      setAnalytics(res.data);
    }
  };

  // Header quick metrics
  const totalAssets = availability?.totalUnits || equipment.length;
  const operationalAssets = availability?.availableUnits || equipment.filter(e => e.status === 'AVAILABLE' || e.status === 'OPERATIONAL').length;
  const activeDowntimesCount = downtimes.filter(d => !d.endTime).length;
  const upcomingPmsCount = schedules.filter(p => p.status === 'SCHEDULED' || p.status === 'DUE' || p.status === 'OVERDUE').length;
  const validCertsCount = certificates.filter(c => c.status === 'VALID').length;
  const openTicketsCount = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;

  // Reminders total count
  const actionableRemindersCount =
    (reminders?.upcomingPms?.length || 0) +
    (reminders?.expiringContracts?.length || 0) +
    (reminders?.expiringCertificates?.length || 0) +
    activeDowntimesCount;

  // Master Tabs Definition
  const ALL_TABS: TabDefinition[] = [
    { key: 'equipment', label: 'Asset Register', category: 'ASSETS', icon: Cpu, badge: totalAssets },
    { key: 'reminders', label: 'Actionable Reminders', category: 'ASSETS', icon: AlertTriangle, badge: actionableRemindersCount },
    { key: 'pm-calendar', label: 'PM Schedule', category: 'PREVENTIVE', icon: Calendar, badge: upcomingPmsCount },
    { key: 'qc-checks', label: 'Daily QC Logs', category: 'PREVENTIVE', icon: CheckCircle2, badge: qcChecks.length },
    { key: 'pm-templates', label: 'Modality Checklists', category: 'PREVENTIVE', icon: Layers, badge: templates.length },
    { key: 'tickets', label: 'Breakdown Tickets', category: 'BREAKDOWN', icon: Wrench, badge: openTicketsCount },
    { key: 'downtimes', label: 'Machine Downtime', category: 'BREAKDOWN', icon: Clock, badge: activeDowntimesCount },
    { key: 'parts', label: 'Spare Parts & Stock', category: 'BREAKDOWN', icon: Package, badge: partUsages.length },
    { key: 'history', label: 'Service History', category: 'BREAKDOWN', icon: History },
    { key: 'certificates', label: 'QA Certificates', category: 'COMPLIANCE', icon: FileCheck2, badge: validCertsCount },
    { key: 'contracts', label: 'AMC & Warranty', category: 'COMPLIANCE', icon: FileText, badge: contracts.length },
    { key: 'contacts', label: 'OEM Contacts', category: 'COMPLIANCE', icon: Phone, badge: contacts.length },
    { key: 'analytics', label: 'Reliability Analytics', category: 'COMPLIANCE', icon: BarChart3 },
  ];

  const visibleTabs = ALL_TABS.filter((t) => activeCategory === 'ALL' || t.category === activeCategory);

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* Page Title & Clinical Scope Authority */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Equipment Maintenance &amp; Biomedical Engineering
            </h1>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
              Biomedical Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-3xl">
            Clinical asset lifecycle, preventive maintenance calendars, daily QC checks, breakdown tickets, downtime logs, spare parts, calibration certificates &amp; 24×7 escalation contacts.
          </p>
        </div>

        <button
          onClick={loadInitialData}
          className="px-4 py-1.5 text-xs font-bold bg-white text-slate-800 border border-[#dce6e0] rounded-full hover:bg-[#f8faf8] transition-colors shadow-soft flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
          Sync Fleet State
        </button>
      </div>

      {/* Alert Banner */}
      {bannerMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-soft border ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button onClick={() => setBannerMessage(null)} className="font-bold text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Fleet Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-[#dce6e0] shadow-soft">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Total Equipment
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{totalAssets} Units</div>
          <div className="text-xs text-emerald-700 font-bold mt-1 font-mono">
            {operationalAssets} Operational ({((operationalAssets / (totalAssets || 1)) * 100).toFixed(0)}%)
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#dce6e0] shadow-soft">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Active Outages
          </div>
          <div className={`text-xl font-extrabold mt-1 font-mono ${activeDowntimesCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {activeDowntimesCount} Offline
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            {activeDowntimesCount === 0 ? 'Zero clinical downtime' : 'Front desk rescheduling active'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#dce6e0] shadow-soft">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Pending / Due PMs
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">{upcomingPmsCount} Slots</div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Quarterly &amp; annual cycles
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#dce6e0] shadow-soft">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            QA / AERB Compliance
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{validCertsCount} Valid</div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Radiation safety &amp; dosimetry
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-[#dce6e0] shadow-soft">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Breakdown Tickets
          </div>
          <div className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
            {openTicketsCount} Open
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            {reminders?.openTickets?.length || 0} Critical / High
          </div>
        </div>
      </div>

      {/* Ergonomic Grouped Navigation Header */}
      <div className="bg-white rounded-3xl border border-[#dce6e0] shadow-soft overflow-hidden p-2">
        {/* Category Filter Chips & Quick Jump Selector */}
        <div className="bg-[#f8faf8] px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-slate-400 font-bold flex items-center gap-1 mr-1 shrink-0 text-[10px] uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Focus Group:
            </span>
            <div className="flex items-center gap-1 bg-[#f0f4f1] p-1 rounded-full">
              {[
                { key: 'ALL', label: 'All Sections (13)' },
                { key: 'ASSETS', label: 'Fleet & Assets' },
                { key: 'PREVENTIVE', label: 'Preventive & QC' },
                { key: 'BREAKDOWN', label: 'Breakdowns & Spares' },
                { key: 'COMPLIANCE', label: 'Compliance & Vendors' },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === cat.key
                      ? 'bg-slate-900 text-white shadow-soft font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Jump Dropdown for Narrow Breakpoints (1024px) */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-bold hidden sm:inline">Jump to section:</span>
            <select
              aria-label="Direct section navigation selector"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as MaintenanceTabKey)}
              className="py-1 px-3 text-xs font-bold rounded-full border border-[#dce6e0] bg-white text-slate-800 shadow-soft focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {ALL_TABS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} {t.badge !== undefined ? `(${t.badge})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Rail (Horizontally Scrollable with accessible focus) */}
        <div role="tablist" aria-label="Maintenance Sections" className="flex border-b border-slate-200 overflow-x-auto px-2 pt-1 gap-1 scrollbar-thin">
          {visibleTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] shrink-0 ${
                  isActive
                    ? 'border-[#2563EB] text-[#2563EB] bg-[#2563EB]/10'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold tabular-nums ${
                      isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'equipment' && (
          <EquipmentRegisterTab
            equipment={equipment}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenCreateModal={() => setShowCreateEqModal(true)}
            onSelectEquipment={(eq) => {
              notify(`Selected asset ${eq.name} (${eq.assetTag})`);
            }}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'reminders' && (
          <MaintenanceRemindersTab
            reminders={reminders}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenCompletePm={(pm) => setSelectedPmForComplete(pm)}
            onOpenRecordCert={() => setShowRecordCertModal(true)}
            onOpenRecordContract={() => setShowRecordContractModal(true)}
            onOpenEndDowntime={(dwn) => setSelectedDowntimeForEnd(dwn)}
            onSelectTab={(tabKey) => setActiveTab(tabKey)}
          />
        )}

        {activeTab === 'pm-calendar' && (
          <PmCalendarTab
            schedules={schedules}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenScheduleModal={() => setShowSchedulePmModal(true)}
            onOpenCompleteModal={(pm) => setSelectedPmForComplete(pm)}
          />
        )}

        {activeTab === 'qc-checks' && (
          <QcChecklistTab
            qcChecks={qcChecks}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenRecordModal={() => setShowRecordQcModal(true)}
          />
        )}

        {activeTab === 'pm-templates' && (
          <PmTemplatesTab
            templates={templates}
            loading={loading}
            onRefresh={loadInitialData}
          />
        )}

        {activeTab === 'tickets' && (
          <ServiceTicketsTab
            tickets={tickets}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenCreateTicketModal={() => setShowCreateTicketModal(true)}
            onUpdateTicketStatus={handleUpdateTicketStatus}
          />
        )}

        {activeTab === 'downtimes' && (
          <DowntimeLogTab
            downtimes={downtimes}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenStartModal={() => setShowStartDowntimeModal(true)}
            onOpenEndModal={(dwn) => setSelectedDowntimeForEnd(dwn)}
          />
        )}

        {activeTab === 'parts' && (
          <PartsUsageTab
            partUsages={partUsages}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenConsumeModal={() => setShowConsumePartModal(true)}
          />
        )}

        {activeTab === 'history' && (
          <ServiceHistoryTab
            equipment={equipment}
            loading={loading}
            onRefresh={loadInitialData}
          />
        )}

        {activeTab === 'certificates' && (
          <CalibrationCertsTab
            certificates={certificates}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenRecordModal={() => setShowRecordCertModal(true)}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractsTab
            contracts={contracts}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenRecordModal={() => setShowRecordContractModal(true)}
          />
        )}

        {activeTab === 'contacts' && (
          <ServiceContactsTab
            contacts={contacts}
            loading={loading}
            onRefresh={loadInitialData}
            onOpenCreateModal={() => setShowCreateContactModal(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <PerformanceAnalyticsTab
            analytics={analytics}
            equipment={equipment}
            loading={loading}
            onRefresh={handleRefreshAnalytics}
          />
        )}
      </div>

      {/* Interactive Modals */}
      <CreateEquipmentModal
        isOpen={showCreateEqModal}
        onClose={() => setShowCreateEqModal(false)}
        onSubmit={handleCreateEquipment}
      />

      <SchedulePmModal
        isOpen={showSchedulePmModal}
        equipment={equipment}
        onClose={() => setShowSchedulePmModal(false)}
        onSubmit={handleSchedulePm}
      />

      <CompletePmModal
        isOpen={Boolean(selectedPmForComplete)}
        pm={selectedPmForComplete}
        onClose={() => setSelectedPmForComplete(null)}
        onSubmit={handleCompletePm}
      />

      <RecordQcModal
        isOpen={showRecordQcModal}
        equipment={equipment}
        onClose={() => setShowRecordQcModal(false)}
        onSubmit={handleRecordQc}
      />

      <CreateTicketModal
        isOpen={showCreateTicketModal}
        equipment={equipment}
        onClose={() => setShowCreateTicketModal(false)}
        onSubmit={handleCreateTicket}
      />

      <StartDowntimeModal
        isOpen={showStartDowntimeModal}
        equipment={equipment}
        onClose={() => setShowStartDowntimeModal(false)}
        onSubmit={handleStartDowntime}
      />

      <EndDowntimeModal
        isOpen={Boolean(selectedDowntimeForEnd)}
        downtime={selectedDowntimeForEnd}
        onClose={() => setSelectedDowntimeForEnd(null)}
        onSubmit={handleEndDowntime}
      />

      <ConsumePartModal
        isOpen={showConsumePartModal}
        equipment={equipment}
        onClose={() => setShowConsumePartModal(false)}
        onSubmit={handleConsumePart}
      />

      <RecordCertificateModal
        isOpen={showRecordCertModal}
        equipment={equipment}
        onClose={() => setShowRecordCertModal(false)}
        onSubmit={handleRecordCertificate}
      />

      <RecordContractModal
        isOpen={showRecordContractModal}
        equipment={equipment}
        onClose={() => setShowRecordContractModal(false)}
        onSubmit={handleRecordContract}
      />

      <CreateContactModal
        isOpen={showCreateContactModal}
        onClose={() => setShowCreateContactModal(false)}
        onSubmit={handleCreateContact}
      />
    </div>
  );
};

export default MaintenancePage;

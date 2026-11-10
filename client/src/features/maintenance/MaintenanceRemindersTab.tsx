import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  FileCheck2,
  FileText,
  AlertOctagon,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import {
  MaintenanceRemindersRecord,
  PmScheduleRecord,
  DowntimeLogRecord
} from '../../services/maintenanceService';

interface MaintenanceRemindersTabProps {
  reminders: MaintenanceRemindersRecord | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenCompletePm: (pm: PmScheduleRecord) => void;
  onOpenRecordCert: () => void;
  onOpenRecordContract: () => void;
  onOpenEndDowntime: (dwn: DowntimeLogRecord) => void;
  onSelectTab: (tab: any) => void;
}

export const MaintenanceRemindersTab: React.FC<MaintenanceRemindersTabProps> = ({
  reminders,
  loading,
  onRefresh,
  onOpenCompletePm,
  onOpenRecordCert,
  onOpenRecordContract,
  onOpenEndDowntime,
  onSelectTab,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'OVERDUE' | 'NEAR_DUE' | 'UPCOMING'>('ALL');

  if (loading || !reminders) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        Evaluating maintenance reminders and compliance schedule...
      </div>
    );
  }

  const { upcomingPms = [], expiringContracts = [], expiringCertificates = [], openTickets = [], activeDowntimes = [] } = reminders;

  const now = new Date();

  // Categorize PMs
  const overduePms = upcomingPms.filter((pm) => new Date(pm.nextDueDate) < now);
  const dueNearPms = upcomingPms.filter((pm) => {
    const d = new Date(pm.nextDueDate);
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 7;
  });
  const upcomingLaterPms = upcomingPms.filter((pm) => {
    const d = new Date(pm.nextDueDate);
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7;
  });

  // Critical tickets
  const criticalTickets = openTickets.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH');

  // Total actionable counts
  const totalOverdue = overduePms.length + activeDowntimes.length + expiringCertificates.filter((c) => c.status === 'EXPIRED').length;
  const totalNearDue = dueNearPms.length + expiringCertificates.filter((c) => c.status === 'EXPIRING_SOON').length + expiringContracts.filter((c) => c.status === 'EXPIRING_SOON').length;
  const totalUpcoming = upcomingLaterPms.length + openTickets.length;

  return (
    <div className="space-y-4">
      {/* Overview Stat Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 uppercase tracking-wider">
            <span>Overdue Actions</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">{totalOverdue} Items</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            Immediate clinical attention required
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 uppercase tracking-wider">
            <span>Due Within 7 Days</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{totalNearDue} Items</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            PMs and expiring certifications
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-2xs bg-sky-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-700 uppercase tracking-wider">
            <span>Upcoming (30 Days)</span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-800 mt-1">{totalUpcoming} Items</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Planned preventive maintenance
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Active Downtime Outages</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className={`text-2xl font-black mt-1 ${activeDowntimes.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {activeDowntimes.length} Units Down
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {activeDowntimes.length === 0 ? 'Zero clinical outages' : 'Rescheduling active'}
          </div>
        </div>
      </div>

      {/* Filter Chips & Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Severity:
          </span>
          {[
            { key: 'ALL', label: 'All Actionable Items' },
            { key: 'OVERDUE', label: `Overdue (${totalOverdue})` },
            { key: 'NEAR_DUE', label: `Due Soon (${totalNearDue})` },
            { key: 'UPCOMING', label: `Upcoming (${totalUpcoming})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterSeverity(tab.key as any)}
              className={`px-3 py-1 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                filterSeverity === tab.key
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          ↻ Refresh Reminders
        </button>
      </div>

      {/* Actionable Sections Grid */}
      <div className="space-y-4">
        {/* Active Downtime Outages */}
        {(filterSeverity === 'ALL' || filterSeverity === 'OVERDUE') && activeDowntimes.length > 0 && (
          <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-rose-950">
                  Active Scanner Outages ({activeDowntimes.length})
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('downtimes')}
                className="text-xs text-rose-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View All Outages</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {activeDowntimes.map((dwn) => (
                <div
                  key={dwn.id}
                  className="bg-white rounded-lg p-3 border border-rose-200 shadow-2xs flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-rose-700 mr-2">{dwn.downtimeNumber}</span>
                    <strong className="text-slate-900">{dwn.equipment?.name || 'Scanner Unit'}</strong>
                    <span className="text-slate-500 ml-2">({dwn.cause})</span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Outage started: {new Date(dwn.startTime).toLocaleString()} • Impact: {dwn.impactLevel}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenEndDowntime(dwn)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs shrink-0"
                  >
                    Restore Machine
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overdue / Due PM Schedules */}
        {(filterSeverity === 'ALL' || filterSeverity === 'OVERDUE' || filterSeverity === 'NEAR_DUE') && (overduePms.length > 0 || dueNearPms.length > 0) && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  PM Schedules Due / Overdue ({overduePms.length + dueNearPms.length})
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('pm-calendar')}
                className="text-xs text-sky-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View PM Calendar</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {[...overduePms, ...dueNearPms].map((pm) => {
                const isOverdue = new Date(pm.nextDueDate) < now;
                return (
                  <div
                    key={pm.id}
                    className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-sky-700 mr-2">{pm.scheduleNumber}</span>
                      <strong className="text-slate-900">{pm.equipment?.name || 'Equipment Unit'}</strong>
                      <span className="text-slate-500 ml-2">({pm.maintenanceType || pm.title} • {pm.frequency})</span>
                      <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-2">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-amber-700 font-semibold'}>
                          Due Date: {new Date(pm.nextDueDate).toLocaleDateString()} {isOverdue && '(OVERDUE)'}
                        </span>
                        <span>•</span>
                        <span>Assigned: {pm.assignedEngineer || 'Field Team'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenCompletePm(pm)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs shrink-0 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark Completed
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expiring Compliance Certificates */}
        {(filterSeverity === 'ALL' || filterSeverity === 'NEAR_DUE' || filterSeverity === 'OVERDUE') && expiringCertificates.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Expiring QA & AERB Radiation Certificates ({expiringCertificates.length})
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('certificates')}
                className="text-xs text-sky-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View Certificates</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {expiringCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800 mr-2">{cert.certificateNumber}</span>
                    <strong className="text-slate-900">{cert.equipment?.name || 'Equipment'}</strong>
                    <span className="text-slate-500 ml-2">({cert.certificationType})</span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Valid until: <strong className="text-amber-700">{new Date(cert.expiryDate).toLocaleDateString()}</strong> • Authority: {cert.issuingAuthority}
                    </div>
                  </div>
                  <button
                    onClick={onOpenRecordCert}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-50 transition-colors shrink-0"
                  >
                    Renew Certificate
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expiring Warranty / AMC Contracts */}
        {(filterSeverity === 'ALL' || filterSeverity === 'NEAR_DUE') && expiringContracts.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Expiring AMC & Warranty Contracts ({expiringContracts.length})
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('contracts')}
                className="text-xs text-sky-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View Contracts</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {expiringContracts.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800 mr-2">{c.contractNumber}</span>
                    <strong className="text-slate-900">{c.equipment?.name || 'Equipment'}</strong>
                    <span className="text-slate-500 ml-2">({c.contractType} • {c.vendorName})</span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Term ends: <strong className="text-amber-700">{new Date(c.endDate).toLocaleDateString()}</strong> • SLA: {c.responseSlaHours}h response
                    </div>
                  </div>
                  <button
                    onClick={onOpenRecordContract}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-50 transition-colors shrink-0"
                  >
                    Renew Contract
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Critical/High Breakdown Tickets */}
        {(filterSeverity === 'ALL' || filterSeverity === 'UPCOMING') && criticalTickets.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Critical & High Breakdown Tickets ({criticalTickets.length})
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('tickets')}
                className="text-xs text-sky-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>View Tickets</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {criticalTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800 mr-2">{tkt.ticketNumber}</span>
                    <strong className="text-slate-900">{tkt.equipment?.name || 'Equipment'}</strong>
                    <span className="text-slate-500 ml-2">({tkt.title})</span>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Priority: <strong className={tkt.priority === 'CRITICAL' ? 'text-rose-600 font-bold' : 'text-amber-600 font-semibold'}>{tkt.priority}</strong> • Status: {tkt.status}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectTab('tickets')}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-50 transition-colors shrink-0"
                  >
                    Manage Ticket
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

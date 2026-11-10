import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Package,
  Wrench,
  Plus,
  RefreshCw,
  Search
} from 'lucide-react';
import { ServiceTicketRecord } from '../../services/maintenanceService';

interface ServiceTicketsTabProps {
  tickets: ServiceTicketRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateTicketModal: () => void;
  onUpdateTicketStatus: (id: string, status: string, notes?: string) => void;
}

export const ServiceTicketsTab: React.FC<ServiceTicketsTabProps> = ({
  tickets,
  loading,
  onRefresh,
  onOpenCreateTicketModal,
  onUpdateTicketStatus,
}) => {
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = tickets.filter((t) => {
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesSearch =
      !search ||
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.equipment?.name && t.equipment.name.toLowerCase().includes(search.toLowerCase())) ||
      (t.equipment?.assetTag && t.equipment.assetTag.toLowerCase().includes(search.toLowerCase())) ||
      (t.assignedEngineer && t.assignedEngineer.toLowerCase().includes(search.toLowerCase()));
    return matchesPriority && matchesStatus && matchesSearch;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" /> MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            LOW
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">{priority}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Open
          </span>
        );
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Wrench className="w-3 h-3 text-indigo-600" /> In Progress
          </span>
        );
      case 'AWAITING_PARTS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Package className="w-3 h-3 text-amber-600" /> Awaiting Parts
          </span>
        );
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ticket #, title, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Ticket Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="AWAITING_PARTS">Awaiting Parts</option>
            <option value="RESOLVED">Resolved / Closed</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenCreateTicketModal}
          className="px-3.5 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Report Breakdown Ticket</span>
        </button>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading breakdown service tickets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No service breakdown tickets matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Ticket #</th>
                  <th className="py-3 px-3.5">Severity</th>
                  <th className="py-3 px-3.5">Equipment Unit</th>
                  <th className="py-3 px-3.5">Fault Description & Codes</th>
                  <th className="py-3 px-3.5">Downtime Impact</th>
                  <th className="py-3 px-3.5">Reported At</th>
                  <th className="py-3 px-3.5">Assigned Specialist</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Quick Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                        {t.ticketNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">{getPriorityBadge(t.priority)}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{t.equipment?.name || 'Equipment Unit'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.equipment?.assetTag}</div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 max-w-sm">
                      <div className="font-semibold text-slate-900">{t.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{t.description}</div>
                      {t.errorCodes && (
                        <div className="text-[10px] font-mono text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 inline-block mt-0.5">
                          ERR: {t.errorCodes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {t.isDowntimeCaused ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertOctagon className="w-3 h-3 text-rose-600" /> Caused Outage
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Non-blocking</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                      {new Date(t.openedAt).toLocaleDateString()}
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{t.assignedEngineer || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400">{t.vendorName || 'In-House BioMed'}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">{getStatusBadge(t.status)}</td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <select
                        value={t.status}
                        aria-label={`Update status for ticket ${t.ticketNumber}`}
                        onChange={(e) => onUpdateTicketStatus(t.id, e.target.value)}
                        className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="AWAITING_PARTS">Awaiting Parts</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

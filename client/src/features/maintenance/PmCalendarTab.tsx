import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Plus,
  RefreshCw,
  Search
} from 'lucide-react';
import { PmScheduleRecord } from '../../services/maintenanceService';

interface PmCalendarTabProps {
  schedules: PmScheduleRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenScheduleModal: () => void;
  onOpenCompleteModal: (pm: PmScheduleRecord) => void;
}

export const PmCalendarTab: React.FC<PmCalendarTabProps> = ({
  schedules,
  loading,
  onRefresh,
  onOpenScheduleModal,
  onOpenCompleteModal,
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = schedules.filter((pm) => {
    const matchesStatus = statusFilter === 'ALL' || pm.status === statusFilter;
    const matchesFreq = frequencyFilter === 'ALL' || pm.frequency === frequencyFilter;
    const matchesSearch =
      !search ||
      pm.scheduleNumber.toLowerCase().includes(search.toLowerCase()) ||
      pm.title.toLowerCase().includes(search.toLowerCase()) ||
      (pm.equipment?.name && pm.equipment.name.toLowerCase().includes(search.toLowerCase())) ||
      (pm.equipment?.assetTag && pm.equipment.assetTag.toLowerCase().includes(search.toLowerCase())) ||
      (pm.assignedEngineer && pm.assignedEngineer.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesFreq && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>Scheduled</span>
          </span>
        );
      case 'DUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Due Soon</span>
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Wrench className="w-3.5 h-3.5 text-indigo-600" />
            <span>In Progress</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
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
              placeholder="Search PM code, unit, engineer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All PM Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DUE">Due Soon</option>
            <option value="OVERDUE">Overdue</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Frequencies</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="BIANNUAL">Biannual</option>
            <option value="ANNUAL">Annual</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenScheduleModal}
          className="px-3.5 py-1.5 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Plan PM Slot</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading preventive maintenance schedule calendar...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No maintenance schedules found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">PM Schedule #</th>
                  <th className="py-3 px-3.5">Equipment Unit</th>
                  <th className="py-3 px-3.5">Maintenance Scope</th>
                  <th className="py-3 px-3.5">Cycle Frequency</th>
                  <th className="py-3 px-3.5">Scheduled Date</th>
                  <th className="py-3 px-3.5">Next Due Date</th>
                  <th className="py-3 px-3.5">Assigned Specialist</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((pm) => (
                  <tr key={pm.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                        {pm.scheduleNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{pm.equipment?.name || 'General Equipment'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{pm.equipment?.assetTag}</div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 max-w-xs">
                      <div className="font-semibold text-slate-900">{pm.title}</div>
                      {pm.notes && <div className="text-[11px] text-slate-500 truncate mt-0.5">{pm.notes}</div>}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-700">
                        {pm.frequency}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      {new Date(pm.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                      <span className={new Date(pm.nextDueDate) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                        {new Date(pm.nextDueDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{pm.assignedEngineer || 'Field Specialist'}</div>
                      <div className="text-[10px] text-slate-400">{pm.vendorName || 'OEM Service'}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">{getStatusBadge(pm.status)}</td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {pm.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => onOpenCompleteModal(pm)}
                          className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-bold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                        >
                          Mark Completed
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                        </span>
                      )}
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

import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search
} from 'lucide-react';
import { DowntimeLogRecord } from '../../services/maintenanceService';

interface DowntimeLogTabProps {
  downtimes: DowntimeLogRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenStartModal: () => void;
  onOpenEndModal: (dwn: DowntimeLogRecord) => void;
}

export const DowntimeLogTab: React.FC<DowntimeLogTabProps> = ({
  downtimes,
  loading,
  onRefresh,
  onOpenStartModal,
  onOpenEndModal,
}) => {
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = downtimes.filter((d) => {
    if (filterActiveOnly && d.endTime) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.downtimeNumber.toLowerCase().includes(q) ||
      d.cause.toLowerCase().includes(q) ||
      d.causeCategory.toLowerCase().includes(q) ||
      (d.equipment?.name && d.equipment.name.toLowerCase().includes(q)) ||
      (d.equipment?.assetTag && d.equipment.assetTag.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search outage #, equipment, cause..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="rounded text-sky-600 focus:ring-cyan-500"
            />
            <span>Active Machine Outages Only ({downtimes.filter((d) => !d.endTime).length})</span>
          </label>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenStartModal}
          className="px-3.5 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Log Machine Downtime Outage</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading machine downtime outage logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No machine downtime logs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Outage Code</th>
                  <th className="py-3 px-3.5">Equipment Unit</th>
                  <th className="py-3 px-3.5">Outage Cause & Clinical Impact</th>
                  <th className="py-3 px-3.5">Outage Start</th>
                  <th className="py-3 px-3.5">Restored At</th>
                  <th className="py-3 px-3.5">Total Duration</th>
                  <th className="py-3 px-3.5 text-center">Affected Bookings</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => {
                  const isActive = !d.endTime;
                  const durationStr = d.durationMinutes
                    ? `${Math.floor(d.durationMinutes / 60)}h ${d.durationMinutes % 60}m`
                    : 'Ongoing...';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800">
                          {d.downtimeNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{d.equipment?.name || 'Scanner Asset'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.equipment?.assetTag}</div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 max-w-sm">
                        <div className="font-semibold text-slate-900">{d.cause}</div>
                        <div className="text-[11px] text-slate-500">Category: {d.causeCategory}</div>
                        <div className="text-[10px] text-rose-700 font-semibold mt-0.5">Impact: {d.impactLevel}</div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                        <div>{new Date(d.startTime).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(d.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                        {d.endTime ? (
                          <>
                            <div>{new Date(d.endTime).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(d.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-rose-600 font-bold">Unresolved</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-xs font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {durationStr}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {d.affectedAppointmentsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-800 border border-rose-200 text-[11px]">
                            {d.affectedAppointmentsCount} Bookings
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" /> Active Outage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Restored
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        {isActive ? (
                          <button
                            onClick={() => onOpenEndModal(d)}
                            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-bold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                          >
                            Restore Service
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Restored</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

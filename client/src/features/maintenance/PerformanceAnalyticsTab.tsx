import React, { useState } from 'react';
import {
  Activity,
  Clock,
  Wrench,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';
import { PerformanceAnalyticsRecord, EquipmentRecord } from '../../services/maintenanceService';

interface PerformanceAnalyticsTabProps {
  analytics: PerformanceAnalyticsRecord | null;
  equipment: EquipmentRecord[];
  loading: boolean;
  onRefresh: (periodDays: number, equipmentId?: string) => void;
}

export const PerformanceAnalyticsTab: React.FC<PerformanceAnalyticsTabProps> = ({
  analytics,
  equipment,
  loading,
  onRefresh,
}) => {
  const [periodDays, setPeriodDays] = useState(30);
  const [selectedEqId, setSelectedEqId] = useState<string>('');

  const handlePeriodChange = (days: number) => {
    setPeriodDays(days);
    onRefresh(days, selectedEqId || undefined);
  };

  const handleEquipmentChange = (eqId: string) => {
    setSelectedEqId(eqId);
    onRefresh(periodDays, eqId || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">Analytics Period:</label>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs">
            {[7, 30, 90, 365].map((days) => (
              <button
                key={days}
                onClick={() => handlePeriodChange(days)}
                className={`px-3 py-1 rounded font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  periodDays === days
                    ? 'bg-white text-sky-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days === 365 ? '1 Year' : `${days} Days`}
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-slate-700 ml-2">Equipment Unit:</label>
          <select
            value={selectedEqId}
            onChange={(e) => handleEquipmentChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="">All Registered Units (Fleet-wide)</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.assetTag})
              </option>
            ))}
          </select>

          <button
            onClick={() => onRefresh(periodDays, selectedEqId || undefined)}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Metrics
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Uptime, MTBF & MTTR Computed per ISO 13485 & NABH Biomedical Engineering Guidelines
        </div>
      </div>

      {loading || !analytics ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded border border-slate-200 text-xs">
          Computing equipment performance and reliability analytics...
        </div>
      ) : (
        <>
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <span>Fleet Operational Uptime</span>
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-600">
                {analytics.uptimePercentage}%
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Out of {analytics.totalPeriodMinutes ? (analytics.totalPeriodMinutes / 60).toFixed(0) : 0} scheduled hours
              </div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <span>Mean Time Between Failures</span>
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-3xl font-extrabold text-sky-700">
                {analytics.mtbfHours} hrs
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Average operational interval between fault stops
              </div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <span>Mean Time To Repair</span>
                <Wrench className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-3xl font-extrabold text-sky-800">
                {analytics.mttrHours} hrs
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Average resolution turnaround by OEM engineers
              </div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <span>Unplanned Outages</span>
                <AlertOctagon className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-3xl font-extrabold text-rose-600">
                {analytics.breakdownCount}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Total unplanned stops in selected window
              </div>
            </div>
          </div>

          {/* Downtime Hours & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Downtime Breakdown (Hours)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Downtime Hours:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {analytics.totalDowntimeHours ? `${analytics.totalDowntimeHours} hrs` : '0 hrs'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total Operational Minutes:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {analytics.totalPeriodMinutes ? (analytics.totalPeriodMinutes - (analytics.totalDowntimeHours || 0) * 60) : '0'} min
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Scheduled PM Completion Rate:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {(analytics as any).pmCompletionRate !== null && (analytics as any).pmCompletionRate !== undefined ? `${(analytics as any).pmCompletionRate}%` : 'No scheduled PM data'}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-equipment breakdown table */}
            <div className="lg:col-span-2 bg-white rounded border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Unit-by-Unit Reliability Table</h3>
                <span className="text-[11px] text-slate-400 font-medium">Past {periodDays} Days Window</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Asset Tag</th>
                      <th className="py-2.5 px-3">Equipment Unit</th>
                      <th className="py-2.5 px-3">Modality</th>
                      <th className="py-2.5 px-3 text-right">Uptime %</th>
                      <th className="py-2.5 px-3 text-right">Downtime (hrs)</th>
                      <th className="py-2.5 px-3 text-center">Breakdowns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(analytics as any).equipmentMetrics && Array.isArray((analytics as any).equipmentMetrics) ? (
                      (analytics as any).equipmentMetrics.map((m: any) => (
                        <tr key={m.equipmentId} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{m.assetTag}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{m.name}</td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              {m.modality}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-600 text-right">{m.uptimePercentage}%</td>
                          <td className="py-2 px-3 font-mono text-slate-800 text-right">{m.downtimeHours} h</td>
                          <td className="py-2 px-3 text-center">
                            {m.failureCount > 0 ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                {m.failureCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">
                          Detailed unit metrics available when filtering by single equipment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

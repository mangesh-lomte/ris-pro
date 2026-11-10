import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw,
  Search
} from 'lucide-react';
import { QcCheckRecord } from '../../services/maintenanceService';

interface QcChecklistTabProps {
  qcChecks: QcCheckRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenRecordModal: () => void;
}

export const QcChecklistTab: React.FC<QcChecklistTabProps> = ({
  qcChecks,
  loading,
  onRefresh,
  onOpenRecordModal,
}) => {
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = qcChecks.filter((qc) => {
    const matchesFreq = frequencyFilter === 'ALL' || qc.frequency === frequencyFilter;
    const matchesResult = resultFilter === 'ALL' || qc.overallResult === resultFilter;
    const matchesSearch =
      !search ||
      qc.checkNumber.toLowerCase().includes(search.toLowerCase()) ||
      (qc.equipment?.name && qc.equipment.name.toLowerCase().includes(search.toLowerCase())) ||
      (qc.equipment?.assetTag && qc.equipment.assetTag.toLowerCase().includes(search.toLowerCase())) ||
      (qc.performedByName && qc.performedByName.toLowerCase().includes(search.toLowerCase()));
    return matchesFreq && matchesResult && matchesSearch;
  });

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>PASS</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>WARNING</span>
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>FAIL</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
            {result}
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
              placeholder="Search QC code, unit, inspector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All Inspection Frequencies</option>
            <option value="DAILY">Daily Morning QC</option>
            <option value="WEEKLY">Weekly Routine QC</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-slate-700"
          >
            <option value="ALL">All QC Outcomes</option>
            <option value="PASS">Pass Only</option>
            <option value="WARNING">Warning Tolerances</option>
            <option value="FAIL">Failed Tolerances</option>
          </select>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenRecordModal}
          className="px-3.5 py-1.5 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Record QC Inspection</span>
        </button>
      </div>

      {/* QC Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading daily and weekly QC logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No QC checks found matching the criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">QC Check #</th>
                  <th className="py-3 px-3.5">Equipment Target</th>
                  <th className="py-3 px-3.5">Protocol Frequency</th>
                  <th className="py-3 px-3.5">Inspection Timestamp</th>
                  <th className="py-3 px-3.5">Inspecting Technologist</th>
                  <th className="py-3 px-3.5">Room Environment</th>
                  <th className="py-3 px-3.5">Tolerances & Calibration</th>
                  <th className="py-3 px-3.5">Outcome</th>
                  <th className="py-3 px-3.5">Exceptions & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((qc) => (
                  <tr key={qc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                        {qc.checkNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{qc.equipment?.name || 'Scanner System'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{qc.equipment?.assetTag}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-700">
                        {qc.frequency}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{new Date(qc.checkDate).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(qc.checkDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{qc.performedByName}</div>
                      <div className="text-[10px] text-slate-400">{qc.performedByRole || 'QC Specialist'}</div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                      <div>Temp: <strong className="font-mono text-slate-800">{qc.temperatureC !== null && qc.temperatureC !== undefined ? `${qc.temperatureC} °C` : '—'}</strong></div>
                      <div>Humidity: <strong className="font-mono text-slate-800">{qc.humidityPercent !== null && qc.humidityPercent !== undefined ? `${qc.humidityPercent} %` : '—'}</strong></div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 text-xs font-mono whitespace-nowrap">
                      {qc.ctNumberWaterHu !== null && qc.ctNumberWaterHu !== undefined && (
                        <div>Water: <strong>{qc.ctNumberWaterHu} HU</strong></div>
                      )}
                      {qc.heliumLevelPercent !== null && qc.heliumLevelPercent !== undefined && (
                        <div>Helium: <strong>{qc.heliumLevelPercent} %</strong></div>
                      )}
                      {qc.chillerTempC !== null && qc.chillerTempC !== undefined && (
                        <div>Chiller: <strong>{qc.chillerTempC} °C</strong></div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">{getResultBadge(qc.overallResult)}</td>
                    <td className="py-3 px-3.5 text-slate-500 max-w-xs truncate text-[11px]">
                      {qc.notes || 'Verified against clinical AAPM / OEM reference tolerances'}
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

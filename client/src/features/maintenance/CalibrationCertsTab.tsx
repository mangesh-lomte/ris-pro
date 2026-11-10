import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search
} from 'lucide-react';
import { CalibrationCertRecord } from '../../services/maintenanceService';

interface CalibrationCertsTabProps {
  certificates: CalibrationCertRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenRecordModal: () => void;
}

export const CalibrationCertsTab: React.FC<CalibrationCertsTabProps> = ({
  certificates,
  loading,
  onRefresh,
  onOpenRecordModal,
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = certificates.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch =
      !search ||
      c.certificateNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.certificationType.toLowerCase().includes(search.toLowerCase()) ||
      c.issuingAuthority.toLowerCase().includes(search.toLowerCase()) ||
      (c.equipment?.name && c.equipment.name.toLowerCase().includes(search.toLowerCase())) ||
      (c.equipment?.assetTag && c.equipment.assetTag.toLowerCase().includes(search.toLowerCase())) ||
      (c.certifiedByName && c.certifiedByName.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Valid Compliance</span>
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Expiring Soon</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Expired Compliance</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
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
              placeholder="Search cert #, authority, unit..."
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
            <option value="ALL">All Certification Statuses</option>
            <option value="VALID">Valid Compliance</option>
            <option value="EXPIRING_SOON">Expiring in 30 Days</option>
            <option value="EXPIRED">Expired Certificates</option>
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
          <span>Record QA / Calibration Certificate</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading calibration certificates and QA compliance records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No calibration certificates found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Certificate #</th>
                  <th className="py-3 px-3.5">Equipment Target</th>
                  <th className="py-3 px-3.5">Certification Protocol</th>
                  <th className="py-3 px-3.5">Issuing Authority</th>
                  <th className="py-3 px-3.5">Issued Date</th>
                  <th className="py-3 px-3.5">Valid Until / Renewal</th>
                  <th className="py-3 px-3.5">Certified Officer</th>
                  <th className="py-3 px-3.5">Compliance Status</th>
                  <th className="py-3 px-3.5">Measured QA Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const isExpired = c.status === 'EXPIRED';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                          {c.certificateNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{c.equipment?.name || 'Equipment'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.equipment?.assetTag}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-sky-50 text-sky-800 border border-sky-200">
                          {c.certificationType}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{c.issuingAuthority}</div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        {new Date(c.issueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                        <span className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                          {new Date(c.expiryDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                        {c.certifiedByName}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                      <td className="py-3 px-3.5 text-slate-600 text-[11px] max-w-xs truncate">
                        {c.remarks || (c.measuredValues ? JSON.stringify(c.measuredValues) : 'Passed OEM tolerance matrix')}
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

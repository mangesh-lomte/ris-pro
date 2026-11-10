import React, { useState } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Layers,
  Users
} from 'lucide-react';
import { AdminAuditLog } from '../../services/adminService';

interface AuditTrailTabProps {
  auditLogs: AdminAuditLog[];
  auditTotal: number;
  auditPage: number;
  auditActionFilter: string;
  auditEntityFilter: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  onFilterChange: (action: string, entity: string) => void;
  onRefresh: () => void;
}

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({
  auditLogs,
  auditTotal,
  auditPage,
  auditActionFilter,
  auditEntityFilter,
  loading,
  onPageChange,
  onFilterChange,
  onRefresh,
}) => {
  const [localAction, setLocalAction] = useState(auditActionFilter);
  const [localEntity, setLocalEntity] = useState(auditEntityFilter);

  const limit = 15;
  const totalPages = Math.ceil(auditTotal / limit) || 1;

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(localAction.trim(), localEntity.trim());
  };

  const handleClearFilter = () => {
    setLocalAction('');
    setLocalEntity('');
    onFilterChange('', '');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3 h-3 text-indigo-600" />
            ADMIN
          </span>
        );
      case 'RADIOLOGIST':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Activity className="w-3 h-3 text-sky-600" />
            RADIOLOGIST
          </span>
        );
      case 'TECHNOLOGIST':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Layers className="w-3 h-3 text-amber-600" />
            TECHNOLOGIST
          </span>
        );
      case 'RECEPTION':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Users className="w-3 h-3 text-emerald-600" />
            RECEPTION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
            {role || 'SYSTEM'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <form
        onSubmit={handleApplyFilter}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Action (e.g. CLINICAL_VIEW, REPORT_FINALIZE)..."
              value={localAction}
              onChange={(e) => setLocalAction(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Filter className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Entity (e.g. Order, Report, Patient)..."
              value={localEntity}
              onChange={(e) => setLocalEntity(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center px-3.5 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              Filter Logs
            </button>
            {(localAction || localEntity || auditActionFilter || auditEntityFilter) && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-indigo-600" />
            <span>Clinical Audit Trail Ledger (Total: {auditTotal})</span>
          </div>
          <span>Page {auditPage} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Timestamp</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Clinical Action</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Staff Actor</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Role</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Entity & ID</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Patient / Accession</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-slate-700">Client IP / Origin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No audit records found matching active filters.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-sans font-medium">{log.actorName}</td>
                    <td className="px-4 py-2.5 font-sans">{getRoleBadge(log.actorRole)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="text-slate-800 font-semibold">{log.entityType}:</span>{' '}
                      <span className="text-slate-500">{log.entityId.slice(0, 12)}...</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.patientId || log.accessionNumber ? (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-cyan-900 border border-slate-200 rounded font-bold text-[11px]">
                          {log.patientId || log.accessionNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200 text-sm">
          <button
            type="button"
            disabled={auditPage <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, auditPage - 1))}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </button>
          <span className="text-xs text-slate-600 font-medium">
            Page {auditPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={auditPage >= totalPages || loading}
            onClick={() => onPageChange(auditPage + 1)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { ShareAccessLogRecord } from '../../services/externalShareService';
import { CheckCircle, AlertTriangle, UserCheck } from 'lucide-react';

interface AuditLogsTabProps {
  logs: ShareAccessLogRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({ logs, loading, onRefresh }) => {
  const [search, setSearch] = useState('');

  const filtered = logs.filter((l) => {
    return (
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.ipAddress && l.ipAddress.toLowerCase().includes(search.toLowerCase())) ||
      (l.failureReason && l.failureReason.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const getActionBadge = (action: string, success: boolean) => {
    if (!success) {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" /> {action}
        </span>
      );
    }

    switch (action) {
      case 'OTP_VERIFIED':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <UserCheck className="w-3 h-3 text-emerald-600" /> OTP Verified
          </span>
        );
      case 'STUDY_VIEWED':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Study Accessed
          </span>
        );
      case 'PDF_DOWNLOADED':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            PDF Report Downloaded
          </span>
        );
      case 'DICOM_DOWNLOADED':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            DICOM ZIP Downloaded
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search action, IP address, failure reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-72"
          />
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          Refresh Log
        </button>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Security Action</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Client IP Address</th>
                <th className="px-4 py-3">Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Loading access and disclosure audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No access log entries recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/75 transition">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{getActionBadge(l.action, l.success)}</td>
                    <td className="px-4 py-3 text-xs">
                      {l.success ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Authorized
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Blocked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">{l.ipAddress || '127.0.0.1'}</td>
                    <td className="px-4 py-3 text-xs text-rose-600">{l.failureReason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

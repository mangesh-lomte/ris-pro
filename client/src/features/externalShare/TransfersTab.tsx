import React, { useState } from 'react';
import { LargeFileTransferRecord } from '../../services/externalShareService';
import { ArrowUpRight, RotateCw, CheckCircle, AlertOctagon, Clock, HardDrive } from 'lucide-react';

interface TransfersTabProps {
  transfers: LargeFileTransferRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenInitiateModal: () => void;
  onRetryTransfer: (id: string) => Promise<void>;
}

export const TransfersTab: React.FC<TransfersTabProps> = ({
  transfers,
  loading,
  onRefresh,
  onOpenInitiateModal,
  onRetryTransfer,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      !search ||
      t.transferNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.accessionNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.targetSystem.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      await onRetryTransfer(id);
    } finally {
      setRetryingId(null);
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Complete
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <RotateCw className="w-3 h-3 text-blue-600 animate-spin" /> In Progress
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      case 'RETRYING':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <RotateCw className="w-3 h-3 text-amber-600 animate-spin" /> Retrying
          </span>
        );
      case 'QUEUED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Clock className="w-3 h-3 text-gray-500" /> Queued
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-xs text-gray-700 bg-gray-100">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search transfer #, accession, target system..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="FAILED">Failed</option>
            <option value="RETRYING">Retrying</option>
            <option value="QUEUED">Queued</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Refresh
          </button>
          <button
            onClick={onOpenInitiateModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            Initiate DICOM Transfer
          </button>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Transfer #</th>
                <th className="px-4 py-3">Accession / Study</th>
                <th className="px-4 py-3">Target System</th>
                <th className="px-4 py-3">Protocol</th>
                <th className="px-4 py-3">Payload Size</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Loading transfer queue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No large file transfers currently recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/75 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-gray-900">{t.transferNumber}</div>
                      <div className="text-[11px] text-gray-400">{new Date(t.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-blue-700 font-semibold">{t.accessionNumber}</div>
                      <div className="text-xs text-gray-800">{t.order?.examinationName || 'CT / MRI Dataset'}</div>
                      <div className="text-[11px] text-gray-400">
                        {t.order?.patient ? `${t.order.patient.firstName} ${t.order.patient.lastName}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                        {t.targetSystem}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300">
                        {t.transferProtocol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-gray-800">{formatBytes(t.totalSizeBytes)}</div>
                      <div className="text-[11px] text-gray-400">{formatBytes(t.transferredBytes)} sent</div>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 mb-1">
                        <span>{t.progressPercent}%</span>
                        {t.retryCount > 0 && <span className="text-amber-600">Retry {t.retryCount}/{t.maxRetries}</span>}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            t.status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : t.status === 'FAILED'
                              ? 'bg-rose-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${t.progressPercent}%` }}
                        />
                      </div>
                      {t.errorMessage && (
                        <div className="text-[10px] text-rose-600 mt-1 truncate max-w-[180px]" title={t.errorMessage}>
                          {t.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {(t.status === 'FAILED' || t.status === 'RETRYING') && (
                        <button
                          onClick={() => handleRetry(t.id)}
                          disabled={retryingId === t.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition disabled:opacity-50"
                        >
                          <RotateCw className={`w-3 h-3 ${retryingId === t.id ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      )}
                    </td>
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

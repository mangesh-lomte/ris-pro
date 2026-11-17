import React, { useState } from 'react';
import { ExternalShareRecord } from '../../services/externalShareService';
import {
  Lock,
  Copy,
  Check,
  Eye,
  AlertTriangle,
  FileText,
  Film,
  Monitor,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface ActiveSharesTabProps {
  shares: ExternalShareRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onRevokeShare: (id: string) => void;
}

export const ActiveSharesTab: React.FC<ActiveSharesTabProps> = ({
  shares,
  loading,
  onRefresh,
  onRevokeShare,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const filteredShares = shares.filter((s) => {
    const matchesSearch =
      !search ||
      s.shareNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.accessionNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.patientId.toLowerCase().includes(search.toLowerCase()) ||
      s.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      (s.institutionName && s.institutionName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || s.shareType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const copyShareLink = (token: string) => {
    const fullUrl = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Active
          </span>
        );
      case 'ACCESSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Eye className="w-3.5 h-3.5 text-sky-600" />
            Accessed
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Expired
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PATIENT_LINK':
        return <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Patient Portal</span>;
      case 'DOCTOR_SHARE':
        return <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">Referring Doctor</span>;
      case 'OUTSIDE_HOSPITAL':
        return <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Outside Hospital</span>;
      default:
        return <span className="text-xs text-slate-600">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar - Single Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search share #, accession, patient, recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ACCESSED">Accessed</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="ALL">All Recipient Types</option>
            <option value="PATIENT_LINK">Patient Link</option>
            <option value="DOCTOR_SHARE">Doctor Share</option>
            <option value="OUTSIDE_HOSPITAL">Outside Hospital</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Share Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Share #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Accession / Study</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Recipient & Facility</th>
                <th className="px-4 py-3">Artifacts</th>
                <th className="px-4 py-3">Security & Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading external shares...
                  </td>
                </tr>
              ) : filteredShares.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No external shares match your criteria.
                  </td>
                </tr>
              ) : (
                filteredShares.map((share) => (
                  <tr key={share.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-slate-900">{share.shareNumber}</div>
                      <div className="text-[11px] text-slate-400">{new Date(share.createdAt).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(share.shareType)}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-blue-700 font-semibold">{share.accessionNumber}</div>
                      <div className="text-xs text-slate-800">{share.order?.examinationName || 'Study'}</div>
                      <div className="text-[11px] text-slate-500">{share.order?.modality}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {share.order?.patient
                          ? `${share.order.patient.firstName} ${share.order.patient.lastName}`
                          : share.patientId}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{share.patientId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{share.recipientName}</div>
                      {share.recipientRole && (
                        <div className="text-xs text-slate-600">{share.recipientRole}</div>
                      )}
                      {share.institutionName && (
                        <div className="text-xs text-slate-500">{share.institutionName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {share.includeReportPdf && (
                          <span title="Report PDF included" className="p-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {share.includeDicom && (
                          <span title="DICOM package included" className="p-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            <Film className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {share.includeWebViewer && (
                          <span title="Web viewer included" className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Monitor className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        {share.requiresOtp ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium" title="Mandatory 6-digit OTP verification">
                            <Lock className="w-3 h-3 text-emerald-600" /> Mandatory 6-digit OTP verification
                          </span>
                        ) : (
                          <span className="text-slate-500">Direct Link</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Expires: {new Date(share.expiresAt).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(share.status)}
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {share.viewCount} views
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => copyShareLink(share.shareToken)}
                          title="Copy secure link"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
                        >
                          {copiedToken === share.shareToken ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        {(share.status === 'ACTIVE' || share.status === 'ACCESSED') && (
                          <button
                            onClick={() => onRevokeShare(share.id)}
                            title="Revoke link immediately"
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Revoke Access
                          </button>
                        )}
                      </div>
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


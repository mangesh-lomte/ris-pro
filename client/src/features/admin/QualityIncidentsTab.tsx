import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Eye,
  FileCheck2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';

interface QualityIncidentsTabProps {
  qualityReport: any;
  loading: boolean;
  onRefresh: () => void;
}

export const QualityIncidentsTab: React.FC<QualityIncidentsTabProps> = ({
  qualityReport,
  loading,
  onRefresh,
}) => {
  if (!qualityReport) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center space-y-3">
        <p className="text-slate-500 text-sm">Quality and incidents telemetry is currently unavailable.</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh Report
        </button>
      </div>
    );
  }

  const { repeatScans, adverseEvents, criticalFindings, peerReview } = qualityReport;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Clinical Quality Assurance & Incident Audit</h2>
            <p className="text-xs text-slate-500">QC pass rates, contrast reactions, critical alerts & peer review concordance</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 4 Quality Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. QC & Repeat Scans */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>QC Review Rate</span>
            <Eye className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {repeatScans?.totalReviewed ?? 0}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Rejected / Repeated:</span>
            <span className="font-mono font-bold text-amber-700">{repeatScans?.rejectedCount ?? 0}</span>
          </div>
        </div>

        {/* 2. Adverse Events & Reactions */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Adverse Events</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-700 font-mono">
            {adverseEvents?.totalRecorded ?? 0}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Contrast & Technical:</span>
            <span className="font-semibold text-rose-600">Logged with clinical notes</span>
          </div>
        </div>

        {/* 3. Critical Findings Follow-Up */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Critical Findings SLA</span>
            <ShieldAlert className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 font-mono">
            {criticalFindings?.complianceRatePercent ?? 100}%
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Acknowledged:</span>
            <span className="font-mono font-semibold text-slate-800">
              {criticalFindings?.acknowledgedCount ?? 0} / {criticalFindings?.totalAlerts ?? 0}
            </span>
          </div>
        </div>

        {/* 4. Peer Review & Concordance */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Peer Review Audit</span>
            <FileCheck2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-700 font-mono">
            {peerReview?.totalSubmitted ?? 0}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Concordance Audited:</span>
            <span className="font-semibold text-emerald-700">Clinical Concordance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

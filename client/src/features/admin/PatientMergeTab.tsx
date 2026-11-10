import React, { useState } from 'react';
import {
  GitMerge,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  FileText,
  Clock,
  UserCheck
} from 'lucide-react';
import { PatientMergeRecord, adminService } from '../../services/adminService';

interface PatientMergeTabProps {
  mergeHistory: PatientMergeRecord[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, isErr?: boolean) => void;
}

export const PatientMergeTab: React.FC<PatientMergeTabProps> = ({
  mergeHistory,
  loading,
  onRefresh,
  onNotify,
}) => {
  const [sourceMrn, setSourceMrn] = useState('');
  const [targetMrn, setTargetMrn] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [executing, setExecuting] = useState(false);

  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSource = sourceMrn.trim().toUpperCase();
    const cleanTarget = targetMrn.trim().toUpperCase();
    const cleanReason = mergeReason.trim();

    if (!cleanSource || !cleanTarget || !cleanReason) {
      onNotify('Please specify both Source MRN, Target MRN, and a clinical reason.', true);
      return;
    }

    if (cleanSource === cleanTarget) {
      onNotify('Source MRN and Target MRN cannot be identical.', true);
      return;
    }

    const confirmPrompt = window.confirm(
      `IRREVERSIBLE CLINICAL ACTION CONFIRMATION:\n\n` +
      `Are you absolutely certain you want to merge:\n` +
      `SOURCE: ${cleanSource} (Duplicate)\n` +
      `INTO\n` +
      `TARGET: ${cleanTarget} (Primary Surviving Record)?\n\n` +
      `This will atomically reassign all clinical orders, appointments, imaging studies, reports, safety screenings, and billing invoices.\n\n` +
      `Reason: "${cleanReason}"\n\n` +
      `Proceed with atomic merge?`
    );

    if (!confirmPrompt) return;

    try {
      setExecuting(true);
      const res = await adminService.mergePatients({
        sourceMrn: cleanSource,
        targetMrn: cleanTarget,
        reason: cleanReason,
      });

      onNotify(
        `Patient merge completed successfully. Reassigned ${res.reassignedCounts?.total ?? 0} clinical & financial records.`
      );
      setSourceMrn('');
      setTargetMrn('');
      setMergeReason('');
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Patient merge execution failed', true);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Merge Execution Form */}
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Execute Patient Record Merge</h2>
              <p className="text-xs text-slate-500">Atomic reassignment of duplicate clinical records</p>
            </div>
          </div>
        </div>

        {/* Clinical Safety Warning Box */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wide text-amber-950">High-Risk Irreversible Operation</p>
            <p className="leading-relaxed">
              Merging will atomically transfer all orders, imaging studies, diagnostic reports, safety screenings, and financial invoices from the source duplicate into the primary target record. The source MRN will be flagged as MERGED for legal audit provenance.
            </p>
          </div>
        </div>

        <form onSubmit={handleExecuteMerge} className="space-y-4 pt-1">
          {/* Visual Source to Target Container */}
          <div className="space-y-3">
            {/* Source Duplicate Card */}
            <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <label htmlFor="source-mrn-input" className="block text-xs font-bold text-rose-900 uppercase">
                  Source Patient MRN (Duplicate to be merged away)
                </label>
              </div>
              <input
                id="source-mrn-input"
                type="text"
                required
                placeholder="e.g. PAT-2026-0042"
                value={sourceMrn}
                onChange={(e) => setSourceMrn(e.target.value)}
                className="w-full border border-rose-300 bg-white rounded-md px-3 py-2 text-sm font-mono text-slate-900 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none uppercase"
              />
              <p className="text-[11px] text-rose-700 font-medium">
                This record will be deactivated and historical items will be reassigned.
              </p>
            </div>

            {/* Reassignment Arrow Indicator */}
            <div className="flex items-center justify-center py-1">
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
                <span className="hidden sm:inline">Atomically Reassign History To</span>
                <ArrowDown className="w-4 h-4 text-indigo-600 sm:hidden" />
                <ArrowRight className="w-4 h-4 text-indigo-600 hidden sm:inline" />
              </div>
            </div>

            {/* Target Primary Card */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <label htmlFor="target-mrn-input" className="block text-xs font-bold text-emerald-900 uppercase">
                  Target Patient MRN (Surviving Primary Master Record)
                </label>
              </div>
              <input
                id="target-mrn-input"
                type="text"
                required
                placeholder="e.g. PAT-2026-0001"
                value={targetMrn}
                onChange={(e) => setTargetMrn(e.target.value)}
                className="w-full border border-emerald-300 bg-white rounded-md px-3 py-2 text-sm font-mono text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none uppercase"
              />
              <p className="text-[11px] text-emerald-700 font-medium">
                This master record will retain all clinical and financial history.
              </p>
            </div>
          </div>

          {/* Clinical Justification */}
          <div>
            <label htmlFor="merge-reason-input" className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Clinical & Regulatory Reason for Merge
            </label>
            <textarea
              id="merge-reason-input"
              required
              rows={3}
              placeholder="e.g., Duplicate record created during emergency intake without Aadhaar/National ID verification."
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={executing || loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:opacity-50"
            >
              <GitMerge className="w-4 h-4" />
              {executing ? 'Executing Atomic Merge...' : 'Execute Atomic Patient Merge'}
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Historical Merge Audit Ledger */}
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Patient Merge Audit Ledger</h2>
              <p className="text-xs text-slate-500">Historical provenance of merged clinical identities</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {mergeHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No patient merges recorded in the governance ledger.
            </div>
          ) : (
            mergeHistory.map((m) => (
              <div
                key={m.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {m.sourceMrn}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      {m.targetMrn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(m.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                <div className="text-slate-800">
                  <strong className="text-slate-900">Reassigned Records:</strong>{' '}
                  <span className="font-semibold text-indigo-900">
                    {m.reassignedCounts?.total || 0} items
                  </span>{' '}
                  ({m.reassignedCounts?.orders || 0} orders, {m.reassignedCounts?.studies || 0} studies,{' '}
                  {m.reassignedCounts?.invoices || 0} invoices)
                </div>

                <div className="text-slate-600 bg-white p-2 rounded border border-slate-200/80">
                  <strong className="text-slate-700">Justification:</strong> {m.reason}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    Merged By: {m.mergedBy}
                  </span>
                  <span className="font-mono text-slate-400">{m.id.slice(0, 10)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import {
  Archive,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus,
  CheckCircle2,
  Scale
} from 'lucide-react';
import { RetentionRule, adminService } from '../../services/adminService';

interface ConsentRetentionTabProps {
  retentionRules: RetentionRule[];
  retentionAudit: any;
  consentSummary: any;
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, isErr?: boolean) => void;
}

export const ConsentRetentionTab: React.FC<ConsentRetentionTabProps> = ({
  retentionRules,
  retentionAudit,
  consentSummary,
  loading,
  onRefresh,
  onNotify,
}) => {
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newRuleData, setNewRuleData] = useState({
    dataCategory: 'DIAGNOSTIC_REPORTS',
    policyName: 'Statutory Diagnostic Reports Retention Policy',
    retentionYears: 10,
    legalBasis: 'National Medical Commission (NMC) Regulations & Clinical Establishments Act',
    actionOnExpiry: 'COLD_ARCHIVE',
    description: 'Statutory non-destructive retention policy for radiology reports',
  });

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await adminService.createRetentionRule({
        dataCategory: newRuleData.dataCategory,
        policyName: newRuleData.policyName,
        retentionYears: Number(newRuleData.retentionYears),
        legalBasis: newRuleData.legalBasis,
        actionOnExpiry: newRuleData.actionOnExpiry,
        description: newRuleData.description,
      });
      onNotify('Retention policy rule recorded.');
      setIsAddRuleOpen(false);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to record rule', true);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Retention Audit Summary */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Data Preservation
              </span>
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Active Preservation
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Total Audited Records:{' '}
            <strong className="text-slate-900 font-mono">
              {retentionAudit?.totalRecordsAudited ?? 'Verified'}
            </strong>
          </p>
          <p className="text-xs text-slate-500">
            Destructively Purged:{' '}
            <span className="text-emerald-700 font-bold font-mono">0</span> (Destructive purge disabled by policy)
          </p>
        </div>

        {/* Consent Compliance */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Patient Consent
              </span>
              <p className="text-sm font-bold text-indigo-700">Contrast & Share Verifications</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Safety Screenings Verified:{' '}
            <strong className="text-slate-900 font-mono">
              {consentSummary?.safetyScreenings?.total ?? 'Logged'}
            </strong>
          </p>
          <p className="text-xs text-slate-500">
            Diagnostic Study Share Consents:{' '}
            <strong className="text-slate-900 font-mono">
              {consentSummary?.shareConsents?.total ?? 'Logged'}
            </strong>
          </p>
        </div>

        {/* Statutory Standards Authority */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Legal Framework
              </span>
              <p className="text-sm font-bold text-slate-900">National Healthcare Rules</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            NMC Radiology Record Guidelines & AERB Radiation Safety Directives.
          </p>
        </div>
      </div>

      {/* Retention Policies Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Clinical Data Retention Policies</h2>
            <p className="text-xs text-slate-500">
              Statutory preservation rules: Non-destructive policy flags expired records for governance review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setIsAddRuleOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Policy Rule
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Data Category</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Policy Name</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Retention Period</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Legal Authority</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Action on Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {retentionRules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No retention policies recorded.
                  </td>
                </tr>
              ) : (
                retentionRules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-indigo-700 font-mono">
                      {r.dataCategory}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.policyName}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {r.retentionYears} Years
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.legalBasis}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        {r.actionOnExpiry}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Retention Policy Modal */}
      {isAddRuleOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Add Retention Policy Rule
            </h3>
            <form onSubmit={handleCreateRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data Category</label>
                <select
                  value={newRuleData.dataCategory}
                  onChange={(e) => setNewRuleData({ ...newRuleData, dataCategory: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                >
                  <option value="DIAGNOSTIC_REPORTS">DIAGNOSTIC_REPORTS</option>
                  <option value="DICOM_IMAGES">DICOM_IMAGES</option>
                  <option value="BILLING_RECORDS">BILLING_RECORDS</option>
                  <option value="AUDIT_LOGS">AUDIT_LOGS</option>
                  <option value="PATIENT_CONSENTS">PATIENT_CONSENTS</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy Name</label>
                <input
                  type="text"
                  required
                  value={newRuleData.policyName}
                  onChange={(e) => setNewRuleData({ ...newRuleData, policyName: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Retention Duration (Years)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={newRuleData.retentionYears}
                    onChange={(e) => setNewRuleData({ ...newRuleData, retentionYears: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Action on Expiry</label>
                  <select
                    value={newRuleData.actionOnExpiry}
                    onChange={(e) => setNewRuleData({ ...newRuleData, actionOnExpiry: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <option value="COLD_ARCHIVE">COLD_ARCHIVE</option>
                    <option value="GOVERNANCE_REVIEW">GOVERNANCE_REVIEW</option>
                    <option value="PERMANENT_ARCHIVE">PERMANENT_ARCHIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Legal Basis & Authority</label>
                <input
                  type="text"
                  required
                  value={newRuleData.legalBasis}
                  onChange={(e) => setNewRuleData({ ...newRuleData, legalBasis: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="px-4 py-2 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

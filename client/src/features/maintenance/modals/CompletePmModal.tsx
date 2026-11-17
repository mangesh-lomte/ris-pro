import React, { useState } from 'react';
import { PmScheduleRecord } from '../../../services/maintenanceService';

interface CompletePmModalProps {
  isOpen: boolean;
  pm: PmScheduleRecord | null;
  onClose: () => void;
  onSubmit: (id: string, data: any) => Promise<void>;
}

export const CompletePmModal: React.FC<CompletePmModalProps> = ({
  isOpen,
  pm,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    findings: '',
    workDone: '',
    partsReplaced: '',
    outcome: 'PASS',
    nextDueDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !pm) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      await onSubmit(pm.id, {
        notes: [formData.workDone, formData.findings, formData.partsReplaced ? `Parts: ${formData.partsReplaced}` : ''].filter(Boolean).join('\n'),
        completedChecklist: [{ item: 'Preventive maintenance completion outcome', status: formData.outcome, actual: formData.workDone, remarks: formData.findings || undefined }],
        nextDueDate: new Date(formData.nextDueDate).toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete PM schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Complete PM Inspection</h3>
            <p className="text-xs text-slate-500">{pm.scheduleNumber} • {pm.equipment?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Next Cycle Due Date *</label>
              <input
                type="date"
                required
                value={formData.nextDueDate}
                onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Checklist Outcome *</label>
            <select required value={formData.outcome} onChange={(e) => setFormData({ ...formData, outcome: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="PASS">Pass - safe to return to service</option>
              <option value="WARNING">Warning - completed with monitored findings</option>
              <option value="FAIL">Fail - keep equipment out of service</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Work Done Summary *</label>
            <textarea
              rows={2}
              required
              value={formData.workDone}
              onChange={(e) => setFormData({ ...formData, workDone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Engineer Findings & Radiation Survey</label>
            <textarea
              rows={2}
              value={formData.findings}
              onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Parts Replaced / Serviced</label>
            <input
              type="text"
              placeholder="e.g. None required / Filters replaced"
              value={formData.partsReplaced}
              onChange={(e) => setFormData({ ...formData, partsReplaced: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs disabled:opacity-50"
            >
              {saving ? 'Completing...' : 'Mark PM Completed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


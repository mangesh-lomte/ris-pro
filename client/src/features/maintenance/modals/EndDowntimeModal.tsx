import React, { useState } from 'react';
import { DowntimeLogRecord } from '../../../services/maintenanceService';

interface EndDowntimeModalProps {
  isOpen: boolean;
  downtime: DowntimeLogRecord | null;
  onClose: () => void;
  onSubmit: (id: string, data: any) => Promise<void>;
}

export const EndDowntimeModal: React.FC<EndDowntimeModalProps> = ({
  isOpen,
  downtime,
  onClose,
  onSubmit,
}) => {
  const [resolutionSummary, setResolutionSummary] = useState(
    'Optical pickoff sensor replaced, tilt calibration verified, scanner returned to active clinical service'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !downtime) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      await onSubmit(downtime.id, { resolutionSummary });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore machine to service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-emerald-800">Restore Machine to Service</h3>
            <p className="text-xs text-slate-500">{downtime.downtimeNumber} • {downtime.equipment?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Resolution Summary *</label>
            <textarea
              rows={3}
              required
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
            <strong>Restoration Action:</strong> Ending downtime computes total outage minutes and automatically restores equipment status to <strong>AVAILABLE</strong> in the scheduling directory.
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
              {saving ? 'Restoring...' : 'Confirm Machine Operational'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


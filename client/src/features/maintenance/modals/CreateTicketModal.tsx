import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface CreateTicketModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    title: '',
    description: '',
    errorCodes: '',
    priority: 'HIGH',
    ticketType: 'BREAKDOWN',
    triggerDowntime: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.title || !formData.description) {
      setError('Equipment, title and detailed fault description are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create service ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-rose-800">Report Machine Breakdown / Service Ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Affected Equipment *</label>
            <select
              required
              value={formData.equipmentId}
              onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="">Select Equipment</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.assetTag} - {eq.modality})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Fault Headline *</label>
            <input
              type="text"
              required
              placeholder="e.g. Gantry tilt sensor warning code E-4102 during scan"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority Level *</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-bold"
              >
                <option value="CRITICAL">CRITICAL (Scanner Down)</option>
                <option value="HIGH">HIGH (Degraded Protocol)</option>
                <option value="MEDIUM">MEDIUM (Minor Warning)</option>
                <option value="LOW">LOW (Cosmetic / Periodic)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">OEM Error Code(s)</label>
              <input
                type="text"
                placeholder="e.g. E-4102, ERR_TILT_TIMEOUT"
                value={formData.errorCodes}
                onChange={(e) => setFormData({ ...formData, errorCodes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Detailed Fault Description *</label>
            <textarea
              rows={3}
              required
              placeholder="Describe symptoms, patient protocol when error occurred, unusual noises, console errors..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <label className="flex items-center gap-2 text-rose-800 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={formData.triggerDowntime}
                onChange={(e) => setFormData({ ...formData, triggerDowntime: e.target.checked })}
                className="rounded text-rose-600"
              />
              <span>Trigger Machine Downtime Outage Immediately</span>
            </label>
            <p className="text-[11px] text-rose-600 mt-1 pl-5">
              Automatically flags machine OUT_OF_SERVICE and alerts front desk of colliding appointments.
            </p>
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
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs disabled:opacity-50"
            >
              {saving ? 'Registering...' : 'Submit Breakdown Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface StartDowntimeModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const StartDowntimeModal: React.FC<StartDowntimeModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    causeCategory: 'HARDWARE_FAILURE',
    cause: '',
    impactLevel: 'FULL_STOP',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.cause) {
      setError('Equipment and outage root cause description are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record downtime start');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-rose-800">Log Machine Downtime Outage</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Equipment Unit *</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cause Category *</label>
              <select
                value={formData.causeCategory}
                onChange={(e) => setFormData({ ...formData, causeCategory: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="HARDWARE_FAILURE">Hardware Failure</option>
                <option value="SOFTWARE_CRASH">Software / Console Crash</option>
                <option value="POWER_OUTAGE">Power / Electrical Outage</option>
                <option value="CHILLER_FAULT">Chiller / Cooling Trip</option>
                <option value="TUBE_OVERHEAT">X-Ray Tube Overheat</option>
                <option value="SCHEDULED_PM">Scheduled Preventive Maint</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Impact Level</label>
              <select
                value={formData.impactLevel}
                onChange={(e) => setFormData({ ...formData, impactLevel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-bold"
              >
                <option value="FULL_STOP">FULL STOP (Scanner Offline)</option>
                <option value="PARTIAL_DEGRADATION">Partial Degradation</option>
                <option value="NO_CLINICAL_IMPACT">Auxiliary Only (No Delay)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Outage Cause Summary *</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Optical encoder pickoff sensor fault, gantry stopped rotation"
              value={formData.cause}
              onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
            <strong>Cross-Module Interaction:</strong> Downtime start immediately queries upcoming appointments for this machine and flags collided patient slots for reception rescheduling.
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
              {saving ? 'Recording Outage...' : 'Record Machine Offline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


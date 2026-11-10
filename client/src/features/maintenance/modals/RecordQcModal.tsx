import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface RecordQcModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const RecordQcModal: React.FC<RecordQcModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    frequency: 'DAILY',
    overallResult: 'PASS',
    temperatureC: '21.0',
    humidityPercent: '45.0',
    chillerTempC: '8.5',
    ctNumberWaterHu: '0.2',
    noiseVariance: '1.2',
    heliumLevelPercent: '88.0',
    phantomScanPassed: true,
    laserAlignmentPassed: true,
    emergencyStopPassed: true,
    notes: 'Standard morning AAPM / ACR QA protocol verified within tolerance limits',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId) {
      setError('Target equipment is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        ...formData,
        temperatureC: formData.temperatureC ? parseFloat(formData.temperatureC) : undefined,
        humidityPercent: formData.humidityPercent ? parseFloat(formData.humidityPercent) : undefined,
        chillerTempC: formData.chillerTempC ? parseFloat(formData.chillerTempC) : undefined,
        ctNumberWaterHu: formData.ctNumberWaterHu ? parseFloat(formData.ctNumberWaterHu) : undefined,
        noiseVariance: formData.noiseVariance ? parseFloat(formData.noiseVariance) : undefined,
        heliumLevelPercent: formData.heliumLevelPercent ? parseFloat(formData.heliumLevelPercent) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record QC check');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Record Daily / Weekly QC Inspection</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Equipment Target *</label>
              <select
                required
                value={formData.equipmentId}
                onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.modality})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Check Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="DAILY">Daily Morning QC</option>
                <option value="WEEKLY">Weekly Routine QC</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="font-semibold text-slate-800">Inspection Verifications</div>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.phantomScanPassed}
                onChange={(e) => setFormData({ ...formData, phantomScanPassed: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Phantom Scan QA & Geometric Accuracy Passed</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.laserAlignmentPassed}
                onChange={(e) => setFormData({ ...formData, laserAlignmentPassed: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Laser Crosshair & Gantry Alignment &plusmn;1mm Passed</span>
            </label>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.emergencyStopPassed}
                onChange={(e) => setFormData({ ...formData, emergencyStopPassed: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Emergency Stop Cutoff Circuit Verified Active</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Room Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={formData.temperatureC}
                onChange={(e) => setFormData({ ...formData, temperatureC: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Relative Humidity (%)</label>
              <input
                type="number"
                step="1"
                value={formData.humidityPercent}
                onChange={(e) => setFormData({ ...formData, humidityPercent: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chiller Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={formData.chillerTempC}
                onChange={(e) => setFormData({ ...formData, chillerTempC: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Water CT Number (HU)</label>
              <input
                type="number"
                step="0.1"
                value={formData.ctNumberWaterHu}
                onChange={(e) => setFormData({ ...formData, ctNumberWaterHu: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Overall QC Result *</label>
            <select
              value={formData.overallResult}
              onChange={(e) => setFormData({ ...formData, overallResult: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
            >
              <option value="PASS">PASS (Within AAPM / OEM Tolerance)</option>
              <option value="WARNING">WARNING (Monitor Drift)</option>
              <option value="FAIL">FAIL (Immediate Service Action Required)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">QC Notes / Technologist Remarks</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Submit QC Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


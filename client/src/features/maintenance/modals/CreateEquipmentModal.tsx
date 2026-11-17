import React, { useState } from 'react';

interface CreateEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateEquipmentModal: React.FC<CreateEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    modality: 'CT',
    assetCategory: 'SCANNER',
    manufacturer: '',
    model: '',
    serialNumber: '',
    assetTag: '',
    roomNumber: '',
    department: 'Radiology',
    powerRatingKva: '',
    operatingTempMin: '18',
    operatingTempMax: '24',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.serialNumber || !formData.manufacturer || !formData.model || !formData.roomNumber) {
      setError('Name, serial number, manufacturer, model, and room are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        ...formData,
        powerRatingKva: formData.powerRatingKva ? parseFloat(formData.powerRatingKva) : undefined,
        operatingTempMin: formData.operatingTempMin ? parseFloat(formData.operatingTempMin) : undefined,
        operatingTempMax: formData.operatingTempMax ? parseFloat(formData.operatingTempMax) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to register equipment asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Register New Equipment Asset</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Equipment Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Siemens Somatom Force Dual Source CT"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Modality Type *</label>
              <select
                value={formData.modality}
                onChange={(e) => setFormData({ ...formData, modality: e.target.value, assetCategory: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="CT">Computed Tomography (CT)</option>
                <option value="MRI">Magnetic Resonance (MRI)</option>
                <option value="XRAY">Digital X-Ray</option>
                <option value="ULTRASOUND">Ultrasound</option>
                <option value="MAMMOGRAPHY">Mammography</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Asset Category</label>
              <select
                value={formData.assetCategory}
                onChange={(e) => setFormData({ ...formData, assetCategory: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="SCANNER">Primary Imaging Scanner</option>
                <option value="INJECTOR">Power Contrast Injector</option>
                <option value="CHILLER">Helium / Water Chiller</option>
                <option value="UPS">Medical UPS Plant</option>
                <option value="AUXILIARY">Auxiliary Plant Equipment</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Serial Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. SN-SIEM-99214"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Asset Tag (Internal)</label>
              <input
                type="text"
                placeholder="e.g. AST-CT-02"
                value={formData.assetTag}
                onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">OEM Manufacturer *</label>
              <input
                type="text"
                required
                placeholder="e.g. Siemens Healthineers / GE Healthcare"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Model Name / Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. Somatom Force DS"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Room / Suite *</label>
              <input
                type="text"
                required
                placeholder="e.g. CT Suite 1 (Room 102)"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Power Rating (kVA)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 125.0"
                value={formData.powerRatingKva}
                onChange={(e) => setFormData({ ...formData, powerRatingKva: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Operating Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                value={formData.operatingTempMin}
                onChange={(e) => setFormData({ ...formData, operatingTempMin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Operating Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                value={formData.operatingTempMax}
                onChange={(e) => setFormData({ ...formData, operatingTempMax: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Technical Notes / Specifications</label>
              <textarea
                rows={2}
                placeholder="Additional OEM specifications, warranty references, special calibration parameters..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
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
              {saving ? 'Registering...' : 'Save Equipment Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


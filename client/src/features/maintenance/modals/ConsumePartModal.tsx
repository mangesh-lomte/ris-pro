import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface ConsumePartModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const ConsumePartModal: React.FC<ConsumePartModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    inventoryItemId: '',
    quantityUsed: '1',
    location: 'GENERAL_STORE',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.inventoryItemId || !formData.quantityUsed) {
      setError('Equipment, inventory item ID and quantity are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        ...formData,
        quantityUsed: parseInt(formData.quantityUsed, 10),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record part consumption');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Consume Maintenance Spare Part</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Equipment *</label>
            <select
              required
              value={formData.equipmentId}
              onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <label className="block font-semibold text-slate-700 mb-1">Inventory Item Code / ID *</label>
            <input
              type="text"
              required
              placeholder="e.g. PART-TEST-001 or Inventory Item ID"
              value={formData.inventoryItemId}
              onChange={(e) => setFormData({ ...formData, inventoryItemId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity Used *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantityUsed}
                onChange={(e) => setFormData({ ...formData, quantityUsed: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Workshop Location</label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="GENERAL_STORE">General Central Store</option>
                <option value="CT_SCANNER">CT Suite Storage</option>
                <option value="MRI_SCANNER">MRI Suite Storage</option>
                <option value="XRAY_ROOM">X-Ray Suite Storage</option>
                <option value="PHARMACY">Pharmacy</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Replacement Reason / Notes *</label>
            <textarea
              rows={2}
              required
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs">
            <strong>Inventory Integration:</strong> Consuming a part automatically creates an auditable <code>MAINTENANCE_PARTS</code> StockTransaction and decrements physical stock balance.
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
              {saving ? 'Deducting Stock...' : 'Confirm Consumption'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


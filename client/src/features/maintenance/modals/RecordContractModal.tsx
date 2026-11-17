import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface RecordContractModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const RecordContractModal: React.FC<RecordContractModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    contractType: 'CMC',
    contractNumber: '',
    vendorName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    annualCost: '',
    responseSlaHours: '4',
    coverageDetails: '',
    contactPerson: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.vendorName || !formData.startDate || !formData.endDate || !formData.coverageDetails.trim()) {
      setError('Equipment, vendor, contract dates, and coverage scope are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        ...formData,
        annualCost: formData.annualCost ? parseFloat(formData.annualCost) : undefined,
        responseSlaHours: parseInt(formData.responseSlaHours, 10),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record maintenance contract');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Register Service Contract / AMC / Warranty</h3>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contract Type *</label>
              <select
                value={formData.contractType}
                onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
              >
                <option value="CMC">Comprehensive Maintenance (CMC)</option>
                <option value="AMC_COMPREHENSIVE">Annual Maintenance (AMC)</option>
                <option value="WARRANTY">OEM Factory Warranty</option>
                <option value="ON_DEMAND">On-Demand Support</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contract Number</label>
              <input
                type="text"
                placeholder="e.g. CMC-SIE-2026-9021"
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vendor / Service Provider *</label>
              <input
                type="text"
                required
                placeholder="e.g. Siemens Healthcare Pvt Ltd"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Key Account Lead</label>
              <input
                type="text"
                placeholder="e.g. Sunil Verma (Regional Manager)"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Cost (₹)</label>
              <input
                type="number"
                step="1000"
                placeholder="e.g. 850000"
                value={formData.annualCost}
                onChange={(e) => setFormData({ ...formData, annualCost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Onsite SLA (Hours)</label>
              <input
                type="number"
                min="1"
                value={formData.responseSlaHours}
                onChange={(e) => setFormData({ ...formData, responseSlaHours: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Coverage Scope & Inclusions *</label>
            <textarea
              rows={2}
              required
              value={formData.coverageDetails}
              onChange={(e) => setFormData({ ...formData, coverageDetails: e.target.value })}
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
              {saving ? 'Recording...' : 'Register Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


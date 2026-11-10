import React, { useState } from 'react';
import { EquipmentRecord } from '../../../services/maintenanceService';

interface RecordCertificateModalProps {
  isOpen: boolean;
  equipment: EquipmentRecord[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const RecordCertificateModal: React.FC<RecordCertificateModalProps> = ({
  isOpen,
  equipment,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    equipmentId: equipment[0]?.id || '',
    certificationType: 'RADIATION_SAFETY_AERB',
    certificateNumber: '',
    issuingAuthority: 'Atomic Energy Regulatory Board (AERB)',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    certifiedByName: 'Dr. S. K. Raman (RSO Grade I)',
    remarks: 'Annual radiation survey and quality assurance certification completed',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.certificateNumber || !formData.issueDate || !formData.expiryDate) {
      setError('Equipment, certificate number and valid dates are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        ...formData,
        issueDate: new Date(formData.issueDate).toISOString(),
        expiryDate: new Date(formData.expiryDate).toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record certificate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Record Regulatory / QA Certificate</h3>
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
              <label className="block font-semibold text-slate-700 mb-1">Certification Type *</label>
              <select
                value={formData.certificationType}
                onChange={(e) => setFormData({ ...formData, certificationType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
              >
                <option value="RADIATION_SAFETY_AERB">AERB Radiation Safety</option>
                <option value="DOSIMETRY_CALIBRATION">Dosimetry Calibration</option>
                <option value="ELECTRICAL_SAFETY">Electrical Safety (IEC 60601)</option>
                <option value="QA_PHANTOM_ALIGNMENT">AAPM Geometric Alignment</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Certificate Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. AERB-QA-2026-0881"
                value={formData.certificateNumber}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Issuing Authority / Agency *</label>
            <input
              type="text"
              required
              placeholder="e.g. Atomic Energy Regulatory Board (AERB)"
              value={formData.issuingAuthority}
              onChange={(e) => setFormData({ ...formData, issuingAuthority: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Issue Date *</label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valid Until / Expiry *</label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Certifying Physicist / RSO Name</label>
            <input
              type="text"
              placeholder="e.g. Dr. S. K. Raman (RSO Grade I)"
              value={formData.certifiedByName}
              onChange={(e) => setFormData({ ...formData, certifiedByName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes & Survey Parameters</label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
              {saving ? 'Recording...' : 'Save Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


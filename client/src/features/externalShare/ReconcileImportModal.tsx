import React, { useState } from 'react';
import { OutsideStudyImportRecord } from '../../services/externalShareService';
import { X, CheckCircle2, XCircle, Link } from 'lucide-react';

interface ReconcileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importRecord: OutsideStudyImportRecord | null;
  patients: Array<{
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: string;
  }>;
  onReconcile: (id: string, payload: {
    action: 'ATTACH_TO_PATIENT' | 'REJECT';
    patientId?: string;
    notes?: string;
    rejectionReason?: string;
  }) => Promise<void>;
}

export const ReconcileImportModal: React.FC<ReconcileImportModalProps> = ({
  isOpen,
  onClose,
  importRecord,
  patients,
  onReconcile,
}) => {
  const [action, setAction] = useState<'ATTACH_TO_PATIENT' | 'REJECT'>('ATTACH_TO_PATIENT');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    importRecord?.matchedPatientId || ''
  );
  const [rejectionReason, setRejectionReason] = useState('Corrupted DICOM pixel data or missing essential sequences');
  const [notes, setNotes] = useState('Reconciled outside scan to master patient record for prior comparison');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !importRecord) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === 'ATTACH_TO_PATIENT' && !selectedPatientId) {
      setError('Please select an internal patient to attach this study to.');
      return;
    }
    if (action === 'REJECT' && !rejectionReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onReconcile(importRecord.id, {
        action,
        patientId: action === 'ATTACH_TO_PATIENT' ? selectedPatientId : undefined,
        rejectionReason: action === 'REJECT' ? rejectionReason.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reconcile outside DICOM study.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Reconcile Outside Study</h2>
              <p className="text-xs text-gray-500">Attach to internal patient chart or reject outside media</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Outside Study Demographics Banner */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-xs">
            <div className="font-bold text-blue-900 flex items-center justify-between">
              <span>{importRecord.importNumber} — {importRecord.patientName}</span>
              <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{importRecord.modality}</span>
            </div>
            <div className="text-blue-800">
              Exam: {importRecord.studyDescription || 'Imported Scan'} ({importRecord.seriesCount || 1} Series, {importRecord.instancesCount || 1} Images)
            </div>
            <div className="text-blue-700 text-[11px]">
              Facility: {importRecord.sourceFacility} • Outside ID: {importRecord.patientIdOutside || 'None'}
            </div>
          </div>

          {/* Reconcile Action Choice */}
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                action === 'ATTACH_TO_PATIENT'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-semibold shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="action"
                value="ATTACH_TO_PATIENT"
                checked={action === 'ATTACH_TO_PATIENT'}
                onChange={() => setAction('ATTACH_TO_PATIENT')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs">Attach to Patient</span>
            </label>

            <label
              className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                action === 'REJECT'
                  ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-semibold shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="action"
                value="REJECT"
                checked={action === 'REJECT'}
                onChange={() => setAction('REJECT')}
                className="text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs">Reject Outside Scan</span>
            </label>
          </div>

          {action === 'ATTACH_TO_PATIENT' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Select Internal Patient <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientId} — {p.firstName} {p.lastName} {p.gender ? `(${p.gender})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">
                  Reconciliation safely generates an internal historical imaging order record for comparison.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Clinical Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="Corrupted DICOM pixel data or missing essential sequences">
                    Corrupted DICOM pixel data or missing essential sequences
                  </option>
                  <option value="Unverifiable patient identity on DICOM header">
                    Unverifiable patient identity on DICOM header
                  </option>
                  <option value="Duplicate imaging series already archived in PACS">
                    Duplicate imaging series already archived in PACS
                  </option>
                  <option value="Non-diagnostic image quality or truncated scan">
                    Non-diagnostic image quality or truncated scan
                  </option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition disabled:opacity-50 ${
                action === 'ATTACH_TO_PATIENT'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {action === 'ATTACH_TO_PATIENT' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? 'Reconciling...' : 'Confirm Reconciliation'}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {loading ? 'Rejecting...' : 'Reject Study'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, ArrowDownLeft } from 'lucide-react';

interface ReceiveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    patientNameRaw: string;
    patientIdRaw?: string;
    accessionRaw?: string;
    modality: 'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND';
    studyDescription: string;
    studyDate: string;
    sourceInstitution: string;
    studyInstanceUid: string;
    numberOfInstances: number;
    fileSize: number;
    storagePath: string;
  }) => Promise<void>;
}

export const ReceiveImportModal: React.FC<ReceiveImportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [patientName, setPatientName] = useState('');
  const [patientIdOutside, setPatientIdOutside] = useState('');
  const [accessionOutside, setAccessionOutside] = useState('');
  const [modality, setModality] = useState<'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND'>('MRI');
  const [studyDescription, setStudyDescription] = useState('');
  const [studyDate, setStudyDate] = useState(new Date().toISOString().split('T')[0]);
  const [sourceFacility, setSourceFacility] = useState('');
  const [studyInstanceUid, setStudyInstanceUid] = useState('');
  const [instancesCount, setInstancesCount] = useState(1);
  const [fileSize, setFileSize] = useState(1);
  const [storagePath, setStoragePath] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setError('Patient name on outside DICOM header is required.');
      return;
    }
    if (!sourceFacility.trim()) {
      setError('Source facility is required.');
      return;
    }
    if (!studyInstanceUid.trim() || !studyDescription.trim() || !storagePath.trim()) {
      setError('Study description, DICOM Study Instance UID, and verified storage location are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        patientNameRaw: patientName.trim(),
        patientIdRaw: patientIdOutside.trim() || undefined,
        accessionRaw: accessionOutside.trim() || undefined,
        modality,
        studyDescription: studyDescription.trim(),
        studyDate,
        sourceInstitution: sourceFacility.trim(),
        studyInstanceUid: studyInstanceUid.trim(),
        numberOfInstances: Number(instancesCount),
        fileSize: Number(fileSize),
        storagePath: storagePath.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to intake outside study.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Intake Outside DICOM Study</h2>
              <p className="text-xs text-gray-500">Register CD/DVD or external cloud study transfer for reconciliation</p>
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

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Outside Patient Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Jane Doe"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Outside Patient ID
              </label>
              <input
                type="text"
                placeholder="e.g., EXT-MR-9021"
                value={patientIdOutside}
                onChange={(e) => setPatientIdOutside(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Modality
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as typeof modality)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="MRI">MRI</option>
                <option value="CT">CT</option>
                <option value="XRAY">X-Ray</option>
                <option value="ULTRASOUND">Ultrasound</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Outside Accession #
              </label>
              <input
                type="text"
                placeholder="e.g., EXT-ACC-4029"
                value={accessionOutside}
                onChange={(e) => setAccessionOutside(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Original Study Date
              </label>
              <input
                type="date"
                value={studyDate}
                onChange={(e) => setStudyDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Study Description
            </label>
            <input
              type="text"
              value={studyDescription}
              onChange={(e) => setStudyDescription(e.target.value)}
              placeholder="e.g., MRI Lumbar Spine without Contrast"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Source Facility / Center <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={sourceFacility}
              onChange={(e) => setSourceFacility(e.target.value)}
              placeholder="e.g., Apex Specialty Diagnostic Center"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                File size (bytes)
              </label>
              <input
                type="number"
                min={1}
                value={fileSize}
                onChange={(e) => setFileSize(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Images / Instances
              </label>
              <input
                type="number"
                min={1}
                value={instancesCount}
                onChange={(e) => setInstancesCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">DICOM Study Instance UID <span className="text-rose-500">*</span></label>
            <input value={studyInstanceUid} onChange={(e) => setStudyInstanceUid(e.target.value)} placeholder="1.2.840..." required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Verified storage location <span className="text-rose-500">*</span></label>
            <input value={storagePath} onChange={(e) => setStoragePath(e.target.value)} placeholder="PACS object ID, mounted media path, or ingest reference" required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>

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
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition disabled:opacity-50"
            >
              <ArrowDownLeft className="w-4 h-4" />
              {loading ? 'Receiving...' : 'Register Study'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

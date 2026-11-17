import React, { useState } from 'react';
import { X, ArrowUpRight, HardDrive } from 'lucide-react';

interface InitiateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    orderId: string;
    destination: string;
    packageType: 'DICOM_ZIP' | 'DICOM_DIR' | 'C_STORE' | 'STOW_RS';
    totalFiles: number;
    totalBytes: number;
  }) => Promise<void>;
  orders: Array<{
    id: string;
    accessionNumber: string;
    patientName: string;
    examinationName: string;
  }>;
}

export const InitiateTransferModal: React.FC<InitiateTransferModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  orders,
}) => {
  const [orderId, setOrderId] = useState('');
  const [destination, setDestination] = useState('');
  const [packageType, setPackageType] = useState<'DICOM_ZIP' | 'DICOM_DIR' | 'C_STORE' | 'STOW_RS'>('C_STORE');
  const [totalFiles, setTotalFiles] = useState(1);
  const [totalBytes, setTotalBytes] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError('Please select an examination to transfer.');
      return;
    }
    if (!destination.trim()) {
      setError('Target PACS destination is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        orderId,
        destination: destination.trim(),
        packageType,
        totalFiles,
        totalBytes,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate DICOM transfer.');
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
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Initiate DICOM File Transfer</h2>
              <p className="text-xs text-gray-500">Dispatch complete multi-slice imaging series to external node</p>
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
              Examination Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Select Examination Order --</option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.accessionNumber} — {ord.patientName} ({ord.examinationName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Target Destination System <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Regional Trauma Center PACS / Orthanc Node"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
            </input>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Transfer Protocol
            </label>
            <select
              value={packageType}
              onChange={(e) => setPackageType(e.target.value as typeof packageType)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="C_STORE">DICOM C-STORE</option>
              <option value="STOW_RS">DICOM STOW-RS</option>
              <option value="DICOM_ZIP">DICOM ZIP Package</option>
              <option value="DICOM_DIR">DICOM_DIR Media Package</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Files</label>
              <input type="number" min={1} value={totalFiles} onChange={(e) => setTotalFiles(Number(e.target.value))} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Payload bytes</label>
              <input type="number" min={1} value={totalBytes} onChange={(e) => setTotalBytes(Number(e.target.value))} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
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
              <ArrowUpRight className="w-4 h-4" />
              {loading ? 'Queuing Transfer...' : 'Start Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


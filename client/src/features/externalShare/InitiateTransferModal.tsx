import React, { useState } from 'react';
import { X, ArrowUpRight, HardDrive } from 'lucide-react';

interface InitiateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    orderId: string;
    targetSystem: string;
    transferProtocol: 'DICOM_DIR' | 'C_STORE' | 'TLS_HTTPS' | 'WADO_RS';
    simulateFailure?: boolean;
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
  const [targetSystem, setTargetSystem] = useState('Metro Tertiary PACS (C-STORE)');
  const [transferProtocol, setTransferProtocol] = useState<'DICOM_DIR' | 'C_STORE' | 'TLS_HTTPS' | 'WADO_RS'>('C_STORE');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError('Please select an examination to transfer.');
      return;
    }
    if (!targetSystem.trim()) {
      setError('Target PACS destination is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        orderId,
        targetSystem: targetSystem.trim(),
        transferProtocol,
        simulateFailure,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate DICOM transfer.');
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
              value={targetSystem}
              onChange={(e) => setTargetSystem(e.target.value)}
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
              value={transferProtocol}
              onChange={(e) => setTransferProtocol(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="C_STORE">DICOM C-STORE (Standard Network Push)</option>
              <option value="TLS_HTTPS">TLS HTTPS / WADO-RS Secure Tunnel</option>
              <option value="DICOM_DIR">DICOM_DIR Media Package</option>
              <option value="WADO_RS">WADO-RS Direct REST Handoff</option>
            </select>
          </div>

          <label className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
            />
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-rose-700">Simulate Network Interruption</span> (Demonstrates automated retry recovery)
            </div>
          </label>

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


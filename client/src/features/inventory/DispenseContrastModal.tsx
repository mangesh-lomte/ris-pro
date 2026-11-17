import { useState } from 'react';
import { inventoryService, InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Syringe, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contrastItems: InventoryItemRecord[];
}

export function DispenseContrastModal({ isOpen, onClose, onSuccess, contrastItems }: Props) {
  const [orderId, setOrderId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(contrastItems[0]?.id || '');
  const [location, setLocation] = useState('CT_SCANNER');
  const [quantity, setQuantity] = useState('1');
  const [volumeMl, setVolumeMl] = useState('90');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItem = contrastItems.find((c) => c.id === selectedItemId);

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !patientId.trim()) {
      setError('Order ID and Patient ID are required for clinical traceability');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await inventoryService.issueContrast({
        orderId: orderId.trim(),
        patientId: patientId.trim(),
        itemId: selectedItemId,
        location,
        quantity: parseInt(quantity, 10) || 1,
        volumeMl: parseFloat(volumeMl) || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.data) {
        setSuccess(`Dispensed from Lot: ${res.data.batch?.batchNumber} (Txn: ${res.data.transaction?.transactionNumber})`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Dispensing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Syringe className="w-5 h-5 text-sky-400" />
            <h2 className="font-semibold text-lg">Dispense Contrast to Patient Scan</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dispense modal"
            className="text-slate-400 hover:text-white text-lg p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            ✕
          </button>
        </div>

        {/* Clinical Consumption Context Flow */}
        <div className="bg-sky-50 px-6 py-2.5 border-b border-sky-100 flex items-center justify-between text-[11px] text-sky-950">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Traceability: Scan Order</span>
            <ArrowRight className="w-3 h-3 text-sky-400" />
            <span>FEFO Batch</span>
            <ArrowRight className="w-3 h-3 text-sky-400" />
            <span>Billing Charge</span>
          </div>
          <span className="font-bold text-sky-800">FEFO Active</span>
        </div>

        <form onSubmit={handleDispense} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-xs border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg text-xs border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Imaging Order ID *</label>
              <Input
                placeholder="e.g. cmw... or Order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient ID / MRN *</label>
              <Input
                placeholder="e.g. PAT-2026-..."
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contrast Agent *</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              {contrastItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.concentration || c.subCategory})
                </option>
              ))}
            </select>
            {currentItem && (
              <p className="text-[11px] text-slate-500 mt-1">
                Concentration: {currentItem.concentration || 'Standard'} • Pack: {currentItem.packSize || 'Single vial'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location Room</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="CT_SCANNER">CT Scanner</option>
                <option value="MRI_SCANNER">MRI Scanner</option>
                <option value="GENERAL_STORE">General Store</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vials</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volume (mL)</label>
              <Input
                type="number"
                value={volumeMl}
                onChange={(e) => setVolumeMl(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 space-y-1 border border-slate-200">
            <span className="font-semibold block text-slate-900">First-Expiry, First-Out (FEFO) Protocol:</span>
            <span className="text-slate-600">The server-side inventory engine automatically draws from the earliest valid, non-expired batch located in the selected scanner room.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Technologist Notes</label>
            <Input
              placeholder="e.g. Injected 90 mL via dual-head power injector at 3.5 mL/s"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="focus-visible:ring-2 focus-visible:ring-cyan-500"
            />
          </div>

          <div className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-sky-600 hover:bg-sky-700 text-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {loading ? 'Dispensing...' : 'Confirm Administration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

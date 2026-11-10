import { useState } from 'react';
import { inventoryService, InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRightLeft, ArrowRight, AlertCircle, MapPin } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items: InventoryItemRecord[];
  initialLocation?: string;
}

const LOCATIONS = ['CT_SCANNER', 'MRI_SCANNER', 'XRAY_ROOM', 'PHARMACY', 'GENERAL_STORE'];

export function TransferStockModal({ isOpen, onClose, onSuccess, items, initialLocation }: Props) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [batchId, setBatchId] = useState('');
  const [sourceLocation, setSourceLocation] = useState(initialLocation || 'GENERAL_STORE');
  const [targetLocation, setTargetLocation] = useState('CT_SCANNER');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItem = items.find((it) => it.id === selectedItemId);
  const eligibleBatches = currentItem?.batches || [];

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !batchId) {
      setError('Item and batch must be selected');
      return;
    }
    if (sourceLocation === targetLocation) {
      setError('Source and target locations cannot be the same');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inventoryService.transferStock({
        itemId: selectedItemId,
        batchId,
        sourceLocation,
        targetLocation,
        quantity: parseInt(quantity, 10) || 1,
        reason: reason.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-sky-400" />
            <h2 className="font-semibold text-lg">Transfer Stock Between Rooms</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close transfer modal"
            className="text-slate-400 hover:text-white text-lg p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleTransfer} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-xs border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Visual Route Indicator: Location A → Location B */}
          <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-lg flex items-center justify-between text-xs font-semibold text-sky-950">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Source: <strong className="text-slate-900">{sourceLocation.replace(/_/g, ' ')}</strong></span>
            </div>
            <ArrowRight className="w-4 h-4 text-sky-600 shrink-0" />
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Destination: <strong className="text-slate-900">{targetLocation.replace(/_/g, ' ')}</strong></span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Item *</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setBatchId('');
              }}
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.itemCode} — {it.name} ({it.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Batch / Lot *</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            >
              <option value="">-- Choose active batch --</option>
              {eligibleBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  Lot: {b.batchNumber} (Expires: {formatDate(b.expiryDate)}, Stock: {b.currentQuantity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">From Location *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={sourceLocation}
                onChange={(e) => setSourceLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">To Location *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Quantity *</label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Purpose / Reason</label>
            <Input
              placeholder="e.g. Daily warmer replenishment for CT room"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
              {loading ? 'Transferring...' : 'Execute Transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

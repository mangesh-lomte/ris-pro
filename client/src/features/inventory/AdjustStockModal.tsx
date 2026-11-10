import { useState } from 'react';
import { inventoryService, InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Wrench, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items: InventoryItemRecord[];
}

const LOCATIONS = ['CT_SCANNER', 'MRI_SCANNER', 'XRAY_ROOM', 'PHARMACY', 'GENERAL_STORE'];

export function AdjustStockModal({ isOpen, onClose, onSuccess, items }: Props) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [batchId, setBatchId] = useState('');
  const [location, setLocation] = useState('GENERAL_STORE');
  const [adjustmentType, setAdjustmentType] = useState<'DAMAGE' | 'RETURN' | 'CORRECTION'>('DAMAGE');
  const [quantityChange, setQuantityChange] = useState('-1');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItem = items.find((it) => it.id === selectedItemId);
  const eligibleBatches = currentItem?.batches || [];

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A detailed audit reason is strictly mandatory for stock adjustments');
      return;
    }
    if (!batchId) {
      setError('Batch must be selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inventoryService.adjustStock({
        itemId: selectedItemId,
        batchId,
        location,
        adjustmentType,
        quantityChange: parseInt(quantityChange, 10) || 0,
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-lg">Stock Adjustment & Correction (Admin)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form onSubmit={handleAdjust} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-sm border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Item *</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setBatchId('');
              }}
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.itemCode} — {it.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch / Lot *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
              >
                <option value="">-- Choose batch --</option>
                {eligibleBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Lot: {b.batchNumber} (Stock: {b.currentQuantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Type</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
              >
                <option value="DAMAGE">DAMAGE (Write-off)</option>
                <option value="RETURN">RETURN (To Vendor)</option>
                <option value="CORRECTION">CORRECTION (Shelf Audit)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity Change (+/-)</label>
              <Input
                type="number"
                value={quantityChange}
                onChange={(e) => setQuantityChange(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Auditable Reason *</label>
            <Input
              placeholder="e.g. Broken vial during shelf reorganization / Return to Bracco"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading ? 'Adjusting...' : 'Record Adjustment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


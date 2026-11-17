import { useState, useEffect, useCallback } from 'react';
import { inventoryService, InventoryItemRecord, InventoryBatchRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Truck, CheckCircle2, AlertCircle, Clock, AlertTriangle, Sparkles, Package } from 'lucide-react';
import { formatINR, formatDate } from '../../utils/formatters';

interface Props {
  items: InventoryItemRecord[];
  onRefresh: () => void;
}

const LOCATIONS = ['GENERAL_STORE', 'CT_SCANNER', 'MRI_SCANNER', 'XRAY_ROOM', 'PHARMACY'];

export function StockReceiptTab({ items, onRefresh }: Props) {
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [location, setLocation] = useState('GENERAL_STORE');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Batches list state
  const [batches, setBatches] = useState<InventoryBatchRecord[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await inventoryService.listBatches();
      if (res.success && res.data) {
        setBatches(res.data);
      }
    } catch {
      // safe fallback if empty
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !selectedItemId || !batchNumber.trim() || !expiryDate) {
      setError('Supplier, item, batch/lot number, and expiry date are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await inventoryService.recordReceipt({
        supplierName: supplierName.trim(),
        invoiceNumber: invoiceNumber.trim() || undefined,
        itemId: selectedItemId,
        batchNumber: batchNumber.trim(),
        expiryDate,
        quantity: parseInt(quantity, 10) || 1,
        unitCost: parseFloat(unitCost) || 0,
        location,
        notes: notes.trim() || undefined,
      });

      if (res.data) {
        setSuccess(`Receipt logged! Batch ${batchNumber} added with ${quantity} units in ${location.replace(/_/g, ' ')}`);
        setBatchNumber('');
        setInvoiceNumber('');
        loadBatches();
        onRefresh();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record receipt');
    } finally {
      setLoading(false);
    }
  };

  const parsedQty = parseInt(quantity, 10) || 0;
  const parsedCost = parseFloat(unitCost) || 0;
  const totalCost = parsedQty * parsedCost;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Inward Receipt Form Card */}
      <div className="bg-white p-6 rounded border border-slate-200 shadow-sm space-y-4 max-w-4xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-semibold text-base text-slate-900">Purchase Receipt & Inward Stock Entry</h3>
              <p className="text-xs text-slate-500">Record incoming goods from pharmaceutical suppliers and assign storage locations</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
            INR Invoicing
          </span>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier / Vendor Name *</label>
              <Input
                placeholder="e.g. GE Healthcare / Bayer Pharma / Bracco"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vendor Invoice / PO Ref</label>
              <Input
                placeholder="e.g. INV-2026-9044"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Inventory Item *</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.itemCode} — {it.name} ({it.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batch / Lot Number *</label>
              <Input
                placeholder="e.g. LOT-2026-881"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expiration Date *</label>
              <Input
                type="date"
                min={tomorrow}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Received Quantity *</label>
              <Input
                type="number"
                min="1"
                max="1000000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Cost (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100000000"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Storage Location *</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Valuation Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Estimated Purchase Valuation:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {formatINR(totalCost)}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Receiving Remarks / Storage Notes</label>
            <Input
              placeholder="e.g. Delivered in cold chain container, temperature verified at 4°C"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="focus-visible:ring-2 focus-visible:ring-cyan-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-2 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <Truck className="w-4 h-4" />
              <span>{loading ? 'Recording...' : 'Receive & Post to Stock Ledger'}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Batches & Expiry Ledger Card */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-600" />
            <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
              Batches & Expiry Tracking Ledger (FEFO Sorted)
            </h4>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {batches.length} active batches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Batch / Lot #</th>
                <th className="p-3">Item Description</th>
                <th className="p-3">Supplier / Invoice</th>
                <th className="p-3">Received Date</th>
                <th className="p-3">Expiration Date</th>
                <th className="p-3 text-right">Remaining Stock</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-center">Batch Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingBatches ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading batch ledger...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No active batches currently logged. Use the form above to record receipt.
                  </td>
                </tr>
              ) : (
                batches.map((b, idx) => {
                  const isFirst = idx === 0 && !b.isExpired && !b.isBlocked;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-medium text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900 font-mono font-bold text-[11px]">
                          {b.batchNumber}
                        </span>
                        {isFirst && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            <Sparkles className="w-3 h-3 text-emerald-600" /> FEFO Priority
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {b.item?.name || 'Item'}
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {b.item?.itemCode}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        <span>{b.supplierName || '—'}</span>
                        {b.purchaseInvoice && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Ref: {b.purchaseInvoice}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {formatDate(b.receivedDate)}
                      </td>
                      <td className="p-3 font-medium">
                        <span className={b.isExpired ? 'text-rose-600 font-bold' : b.isNearExpiry ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                          {formatDate(b.expiryDate)}
                        </span>
                        {b.daysUntilExpiry !== undefined && (
                          <span className="block text-[10px] text-slate-400">
                            {b.daysUntilExpiry > 0 ? `${b.daysUntilExpiry} days left` : 'Expired'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 font-mono">
                        {b.currentQuantity}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700 font-mono">
                        {formatINR(b.unitCost)}
                      </td>
                      <td className="p-3 text-center">
                        {b.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> BLOCKED
                          </span>
                        ) : b.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" /> EXPIRED
                          </span>
                        ) : b.isNearExpiry ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> NEAR EXPIRY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> HEALTHY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

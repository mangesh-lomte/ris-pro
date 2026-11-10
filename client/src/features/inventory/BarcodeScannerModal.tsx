import { useState } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Barcode, Search, AlertCircle, CheckCircle2, Package, Calendar } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScannerModal({ isOpen, onClose }: Props) {
  const [scanCode, setScanCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanCode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await inventoryService.scanCode(scanCode.trim());
      if (res.data) {
        setResult(res.data);
      } else {
        setError('No record found for this identifier');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Resolution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-teal-400" />
            <h2 className="font-semibold text-lg">Barcode / QR Scanner Simulator</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            Scan or type an Item Barcode (e.g. <code>890123400101</code>), SKU (e.g. <code>INV-CON-OMNI350</code>), or Batch Lot (e.g. <code>LOT-...</code>).
          </p>

          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Scan or type barcode / lot number..."
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading || !scanCode.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
              {loading ? <Search className="w-4 h-4 animate-spin" /> : 'Resolve'}
            </Button>
          </form>

          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-sm border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-base">
                  {result.item?.name || result.batch?.item?.name}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                  {result.matchType} RESOLVED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Item Code:</span>{' '}
                  <span className="font-mono font-medium">{result.item?.itemCode || result.batch?.item?.itemCode}</span>
                </div>
                <div>
                  <span className="text-slate-400">Category:</span>{' '}
                  <span>{result.item?.category || result.batch?.item?.category}</span>
                </div>
                <div>
                  <span className="text-slate-400">Unit:</span>{' '}
                  <span>{result.item?.unit || result.batch?.item?.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400">Price / Unit:</span>{' '}
                  <span>{formatINR(result.item?.unitPrice || result.batch?.item?.unitPrice || 0)}</span>
                </div>
              </div>

              {result.batch && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>Batch: {result.batch.batchNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Expires: {new Date(result.batch.expiryDate).toLocaleDateString()}
                    </span>
                    {result.batch.isExpired ? (
                      <span className="px-1.5 py-0.5 rounded text-rose-700 bg-rose-100 text-[10px] font-bold">EXPIRED</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-100 text-[10px] font-bold">VALID</span>
                    )}
                  </div>
                </div>
              )}

              {result.locations && result.locations.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700 block mb-1">Available in Rooms:</span>
                  <div className="flex flex-wrap gap-2">
                    {result.locations.map((loc: any, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded border border-slate-200 text-xs text-slate-700">
                        {loc.location.replace('_', ' ')}: <strong>{loc.quantity}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-emerald-700 pt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ready for clinical dispensing or stock movement</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}


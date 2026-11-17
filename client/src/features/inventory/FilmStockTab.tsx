import { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Film, Printer, AlertTriangle, CheckCircle2, Plus, RefreshCw, X } from 'lucide-react';

export function FilmStockTab() {
  const [filmItems, setFilmItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Usage Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [location, setLocation] = useState('XRAY_ROOM');
  const [printedQty, setPrintedQty] = useState(0);
  const [spoiledQty, setSpoiledQty] = useState(0);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getFilmStock();
      if (res.success && res.data) {
        setFilmItems(res.data);
        if (res.data.length > 0 && !selectedItemId) {
          setSelectedItemId(res.data[0].id || res.data[0].itemId);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load film inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (printedQty <= 0 && spoiledQty <= 0) {
      setModalError('Please enter at least 1 printed or spoiled sheet.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await inventoryService.recordFilmUsage({
        itemId: selectedItemId,
        location,
        printedQty: Number(printedQty),
        spoiledQty: Number(spoiledQty),
        orderId: orderId.trim() || undefined,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        setIsModalOpen(false);
        setPrintedQty(0);
        setSpoiledQty(0);
        setOrderId('');
        setReason('');
        loadData();
      }
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err.message || 'Failed to record film usage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-[#2563EB] rounded-md">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Film Stock & Accounting</h2>
            <p className="text-xs text-slate-500">Carestream DryView film counters, print tracking, and spoilage ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#2563EB] hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs py-1.5 h-auto"
          >
            <Plus className="w-4 h-4" /> Record Print / Spoilage
          </Button>

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs py-1.5 h-auto text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Film Size Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filmItems.map((film) => {
          const isLow = (film.currentPhysicalStock || 0) < (film.reorderLevel || 10);
          return (
            <div key={film.id || film.itemId || film.itemCode} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded">
                    {film.filmSize || 'Standard'}
                  </span>
                  <h4 className="font-semibold text-slate-800 mt-1">{film.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{film.itemCode}</p>
                </div>
                <Printer className="w-5 h-5 text-slate-400" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                <div>
                  <div className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                    {film.currentPhysicalStock || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">Available</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-slate-700">{film.totalPrinted || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Printed</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{film.totalSpoiled || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Spoiled</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500">Reorder Level: {film.reorderLevel} sheets</span>
                {isLow ? (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> REORDER REQUIRED
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> IN STOCK
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Film Inventory Master Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-700">Carestream Laser Film Ledger</h3>
          <span className="text-xs text-slate-500">{filmItems.length} film sizes registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-2.5">Item Code</th>
                <th className="px-4 py-2.5">Film Size & Name</th>
                <th className="px-4 py-2.5 text-right">Available Sheets</th>
                <th className="px-4 py-2.5 text-right">Min Threshold</th>
                <th className="px-4 py-2.5 text-right">Total Printed</th>
                <th className="px-4 py-2.5 text-right">Total Spoiled</th>
                <th className="px-4 py-2.5">Active Batches</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filmItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No film items registered.
                  </td>
                </tr>
              ) : (
                filmItems.map((film) => {
                  const qty = film.currentPhysicalStock || 0;
                  const isLow = qty < (film.reorderLevel || 10);
                  const batchesCount = film.batches?.length || 0;

                  return (
                    <tr key={film.id || film.itemId || film.itemCode} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{film.itemCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{film.name}</div>
                        <div className="text-[11px] text-[#2563EB] font-medium">{film.filmSize}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={isLow ? 'text-red-600' : 'text-slate-800'}>{qty}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">{film.reorderLevel}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{film.totalPrinted || 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">{film.totalSpoiled || 0}</td>
                      <td className="px-4 py-3 text-slate-600">{batchesCount} batches</td>
                      <td className="px-4 py-3">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3" /> REORDER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> OK
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

      {/* Record Usage Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-semibold text-slate-800">Record Film Printing & Spoilage</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordUsage} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Film Size / Item *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white"
                  required
                >
                  {filmItems.map((f) => (
                    <option key={f.id || f.itemId || f.itemCode} value={f.id || f.itemId}>
                      {f.name} ({f.filmSize}) — Stock: {f.currentPhysicalStock || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laser Imager Location *</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white"
                  required
                >
                  <option value="XRAY_ROOM">X-Ray Imager Room</option>
                  <option value="CT_SCANNER">CT DryView Imager</option>
                  <option value="MRI_SCANNER">MRI Laser Imager</option>
                  <option value="GENERAL_STORE">Central Film Store</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Printed Sheets *</label>
                  <Input
                    type="number"
                    min="0"
                    value={printedQty}
                    onChange={(e) => setPrintedQty(parseInt(e.target.value) || 0)}
                    className="text-xs"
                    required
                  />
                  <span className="text-[10px] text-slate-500">Delivered to patient</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Spoiled / Damaged Sheets</label>
                  <Input
                    type="number"
                    min="0"
                    value={spoiledQty}
                    onChange={(e) => setSpoiledQty(parseInt(e.target.value) || 0)}
                    className="text-xs"
                  />
                  <span className="text-[10px] text-slate-500">Jam / artifact / repeat</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Order / Accession (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. ACC-20261107-001"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Spoilage Reason</label>
                <Input
                  type="text"
                  placeholder="e.g. Printer feed roller smudge, repeat exposure"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs"
                >
                  {submitting ? 'Recording...' : 'Save Consumption'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useCallback } from 'react';
import { inventoryService, StockAuditRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ClipboardList, CheckCircle2, AlertTriangle, RefreshCw, Scale, History, Plus } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

export function StockAuditTab() {
  const [location, setLocation] = useState<string>('CT_SCANNER');
  const [locationStocks, setLocationStocks] = useState<any[]>([]);
  const [audits, setAudits] = useState<StockAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Audit Form State
  const [isAuditing, setIsAuditing] = useState(false);
  const [counts, setCounts] = useState<Record<string, { counted: number; reason: string }>>({});
  const [reconcile, setReconcile] = useState(true);
  const [auditNotes, setAuditNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stocksRes, auditsRes] = await Promise.all([
        inventoryService.getLocationStocks(location),
        inventoryService.listAudits(location),
      ]);

      if (stocksRes.success && stocksRes.data) {
        setLocationStocks(stocksRes.data);
        const initCounts: Record<string, { counted: number; reason: string }> = {};
        for (const s of stocksRes.data) {
          initCounts[s.id] = { counted: s.quantity, reason: '' };
        }
        setCounts(initCounts);
      }

      if (auditsRes.success && auditsRes.data) {
        setAudits(auditsRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load stock audit data');
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    loadData();
    setIsAuditing(false);
  }, [loadData]);

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const itemsPayload = locationStocks.map((s) => {
        const c = counts[s.id] || { counted: s.quantity, reason: '' };
        return {
          itemId: s.itemId,
          batchId: s.batchId || undefined,
          countedQty: Number(c.counted),
          discrepancyReason: c.reason.trim() || undefined,
          autoReconcile: reconcile,
        };
      });

      const res = await inventoryService.recordAudit({
        location,
        notes: auditNotes.trim() || undefined,
        items: itemsPayload,
      });

      if (res.success) {
        setIsAuditing(false);
        setAuditNotes('');
        loadData();
      }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || err.message || 'Failed to submit physical stock audit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-50 text-sky-700 rounded-md border border-sky-100">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Physical Stock Audit & Discrepancy Reconciliation</h2>
            <p className="text-xs text-slate-500">Conduct physical inventory counts, calculate variance, and auto-reconcile ledger balances</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isAuditing}
            className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="CT_SCANNER">CT Scanner Console Room</option>
            <option value="MRI_SCANNER">MRI Scanner Control Room</option>
            <option value="XRAY_ROOM">X-Ray Procedure Room</option>
            <option value="PHARMACY">Pharmacy Store</option>
            <option value="GENERAL_STORE">Central Warehouse</option>
          </select>

          {!isAuditing ? (
            <Button
              onClick={() => setIsAuditing(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5 text-xs py-1.5 h-auto whitespace-nowrap shadow-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <Plus className="w-4 h-4" /> Start Physical Count
            </Button>
          ) : (
            <Button
              onClick={() => setIsAuditing(false)}
              variant="outline"
              className="text-slate-600 text-xs py-1.5 h-auto focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Cancel Audit
            </Button>
          )}

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs py-1.5 h-auto text-slate-600 focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Audit Form */}
      {isAuditing && (
        <form onSubmit={handleAuditSubmit} className="bg-white rounded border-2 border-sky-400 p-5 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-semibold text-sky-950 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-sky-600" />
                Physical Count in Progress — {location.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-slate-500">
                Count items physically present. Variance is calculated against current system balance.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded border border-sky-200">
              <label className="text-xs font-semibold text-sky-950 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcile}
                  onChange={(e) => setReconcile(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-cyan-500"
                />
                Auto-reconcile discrepancies into ledger
              </label>
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Item Code & Name</th>
                  <th className="p-3">Batch / Lot</th>
                  <th className="p-3 text-right">System Expected</th>
                  <th className="p-3 text-right w-32">Physical Count</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 w-64">Discrepancy Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locationStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No stock records currently registered in {location.replace(/_/g, ' ')}.
                    </td>
                  </tr>
                ) : (
                  locationStocks.map((s) => {
                    const c = counts[s.id] || { counted: s.quantity, reason: '' };
                    const diff = Number(c.counted) - Number(s.quantity);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 block">{s.item?.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{s.item?.itemCode}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{s.batch?.batchNumber || '—'}</td>
                        <td className="p-3 text-right font-bold text-slate-900 font-mono">{s.quantity} {s.item?.unit}</td>
                        <td className="p-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            value={c.counted}
                            onChange={(e) => {
                              setCounts({
                                ...counts,
                                [s.id]: { ...c, counted: Number(e.target.value) },
                              });
                            }}
                            className="text-right font-bold font-mono h-8 text-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-600">+{diff}</span>
                          ) : (
                            <span className="text-rose-600">{diff}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder={diff !== 0 ? 'Mandatory reason...' : 'Optional notes...'}
                            value={c.reason}
                            onChange={(e) => {
                              setCounts({
                                ...counts,
                                [s.id]: { ...c, reason: e.target.value },
                              });
                            }}
                            className={`h-8 text-xs focus-visible:ring-2 focus-visible:ring-cyan-500 ${diff !== 0 && !c.reason ? 'border-amber-400 bg-amber-50/30' : ''}`}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes / Summary</label>
            <Input
              type="text"
              placeholder="e.g. Monthly routine audit completed for CT procedure room"
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              className="text-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAuditing(false)}
              disabled={submitting}
              className="text-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || locationStocks.length === 0}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {submitting ? 'Submitting Audit...' : 'Finalize & Record Audit'}
            </Button>
          </div>
        </form>
      )}

      {/* Historical Stock Audits */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Stock Audit Log ({audits.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Location: {location.replace(/_/g, ' ')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Audit #</th>
                <th className="px-4 py-2.5">Date & Time</th>
                <th className="px-4 py-2.5">Auditor</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5 text-right">Items Audited</th>
                <th className="px-4 py-2.5 text-right">Total Variance</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No physical audits recorded yet for {location.replace(/_/g, ' ')}.
                  </td>
                </tr>
              ) : (
                audits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px]">
                        {a.auditNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(a.auditedAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{a.auditedByName}</td>
                    <td className="px-4 py-3 text-slate-600">{a.location.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right font-medium font-mono">{a.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono">
                      {a.totalVariance === 0 ? (
                        <span className="text-emerald-600">0</span>
                      ) : a.totalVariance < 0 ? (
                        <span className="text-rose-600">{a.totalVariance}</span>
                      ) : (
                        <span className="text-sky-600">+{a.totalVariance}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> RECONCILED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {a.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{a.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  CashierSummary,
  CashierClosingRecord,
  billingService,
} from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Lock, Unlock, AlertCircle, CheckCircle2, IndianRupee, Wallet } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface CashierClosingTabProps {
  onRefreshParent: () => void;
}

export function CashierClosingTab({ onRefreshParent }: CashierClosingTabProps) {
  const [summary, setSummary] = useState<CashierSummary | null>(null);
  const [closings, setClosings] = useState<CashierClosingRecord[]>([]);
  const [, setLoading] = useState(false);
  const [closingDrawer, setClosingDrawer] = useState(false);
  const [actualCash, setActualCash] = useState<number>(0);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, closingsRes] = await Promise.all([
        billingService.getCashierSummary(),
        billingService.listCashierClosings().catch(() => ({ data: [] })),
      ]);
      setSummary(sumRes.data);
      setOpeningFloat(0);
      const expectedInDrawer = Number(sumRes.data?.expectedCash ?? 0);
      setActualCash(isNaN(expectedInDrawer) ? 0 : expectedInDrawer);
      if (closingsRes.data) {
        setClosings(closingsRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load cashier status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCloseDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary) return;
    if (variance !== 0 && notes.trim().length < 5) {
      setError('Explain the cash shortage or surplus before closing the drawer.');
      return;
    }

    setClosingDrawer(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await billingService.closeCashierDrawer({
        openingFloat,
        actualCash: Number(actualCash),
        notes: notes.trim() || undefined,
      });

      if (res.data) {
        setSuccessMsg(`Drawer closed successfully! Record: ${res.data.closingNumber}`);
        loadData();
        onRefreshParent();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to close cashier drawer');
    } finally {
      setClosingDrawer(false);
    }
  };

  const expectedInDrawer = Number(summary?.expectedCash || 0) + openingFloat;
  const currentActual = Number(actualCash || 0);
  const variance = summary ? (currentActual - expectedInDrawer) : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shift Summary Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-100 text-cyan-800 rounded">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Current Cashier Shift Summary</h3>
                    <p className="text-2xs text-slate-500">
                      Cashier: <strong className="text-slate-800">{summary.cashierName}</strong> • Date: <span className="font-mono">{summary.businessDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {summary.isClosed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs uppercase">
                      <Lock className="w-3.5 h-3.5" /> Shift Closed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase">
                      <Unlock className="w-3.5 h-3.5" /> Shift Open
                    </span>
                  )}
                </div>
              </div>

              {/* Tenders Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-400 block">Opening Cash Float</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatINR(openingFloat)}
                  </span>
                </div>
                <div className="p-3 rounded bg-emerald-50/50 border border-emerald-200">
                  <span className="text-3xs uppercase font-bold text-emerald-700 block">Cash Tender Received</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {formatINR(Number(summary.cashCollected) || 0)}
                  </span>
                </div>
                <div className="p-3 rounded bg-cyan-50/50 border border-cyan-200">
                  <span className="text-3xs uppercase font-bold text-cyan-700 block">UPI Collections</span>
                  <span className="font-mono font-bold text-cyan-800 text-sm">
                    {formatINR(Number(summary.upiCollected) || 0)}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-400 block">Credit / Debit Cards</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatINR(Number(summary.cardCollected) || 0)}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <span className="text-3xs uppercase font-bold text-slate-400 block">Online / Gateway</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatINR(Number(summary.onlineCollected) || 0)}
                  </span>
                </div>
                <div className="p-3 rounded bg-blue-50/50 border border-blue-200">
                  <span className="text-3xs uppercase font-bold text-blue-700 block">Total Collections</span>
                  <span className="font-mono font-extrabold text-blue-900 text-sm">
                    {formatINR(Number(summary.totalCollected) || 0)}
                  </span>
                </div>
              </div>

              {/* Cash Reconciliation Highlight */}
              <div className="p-4 rounded bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-3xs uppercase font-bold tracking-wider text-slate-400 block">
                    Total Physical Cash Expected In Drawer
                  </span>
                  <p className="text-2xs text-slate-400 mt-0.5">Declared opening float + net cash collections</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-extrabold text-cyan-400">
                    {formatINR(expectedInDrawer)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Reconciliation & Closing Form */}
          <div className="rounded border border-slate-200 bg-white p-5 shadow-sm space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-600" />
              Reconcile & Close Cash Drawer
            </h4>

            {summary.isClosed ? (
              <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2 text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h5 className="font-bold text-slate-800">Shift Completed & Locked</h5>
                <p className="text-2xs text-slate-500">
                  Your register closing record has been finalized for business date {summary.businessDate}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCloseDrawer} className="space-y-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Opening Cash Float (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingFloat}
                    onChange={(event) => setOpeningFloat(Number(event.target.value) || 0)}
                    className="min-h-11 font-mono font-bold text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Actual Counted Physical Cash (₹) *</label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualCash}
                      onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                      className="pl-8 font-mono font-bold text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Variance Display */}
                <div className="p-3 rounded border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="font-medium text-slate-600">Reconciliation Variance:</span>
                  <span
                    className={`font-mono font-bold ${
                      variance === 0
                        ? 'text-emerald-700'
                        : variance > 0
                        ? 'text-cyan-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {variance >= 0 ? `+${formatINR(variance)}` : `-${formatINR(Math.abs(variance))}`}
                    <span className="text-3xs font-normal block text-right">
                      {variance === 0 ? 'Balanced' : variance > 0 ? 'Surplus' : 'Shortage'}
                    </span>
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Closing Remarks {variance !== 0 ? '*' : '(Optional)'}</label>
                  <Input
                    placeholder="e.g. End of morning counter shift"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs"
                    required={variance !== 0}
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={closingDrawer}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  {closingDrawer ? 'Finalizing Closing...' : 'Lock & Finalize Shift Drawer'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Historical Closings */}
      <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Historical Cashier Closings</h4>
          <span className="text-2xs text-slate-500">{closings.length} records</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Closing #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Business Date</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Opening Float</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Expected Cash</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Actual Counted</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Variance</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Closed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                  No historical drawer closings recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              closings.map((cl) => (
                <TableRow key={cl.id} className="hover:bg-slate-50/50 text-xs">
                  <TableCell className="font-mono font-bold text-cyan-900">{cl.closingNumber}</TableCell>
                  <TableCell className="font-mono">{cl.businessDate || (cl.closingDate ? new Date(cl.closingDate).toISOString().slice(0, 10) : 'N/A')}</TableCell>
                  <TableCell className="font-mono text-right">{formatINR(cl.openingFloat ?? 0)}</TableCell>
                  <TableCell className="font-mono text-right">{formatINR(cl.expectedCash ?? 0)}</TableCell>
                  <TableCell className="font-mono font-bold text-right">{formatINR(cl.actualCash ?? 0)}</TableCell>
                  <TableCell className="font-mono font-bold text-right">
                    <span className={Number(cl.variance ?? 0) === 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {formatINR(cl.variance ?? 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-2xs text-slate-500">
                    {new Date(cl.closedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

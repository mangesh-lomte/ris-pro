import { useState } from 'react';
import { inventoryService, BatchTraceResult } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, AlertOctagon, User, FileText, Ban, CheckCircle2, ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';

export function RecallTraceabilityTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState<BatchTraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quarantine action state
  const [quarantining, setQuarantining] = useState(false);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [showQuarantineConfirm, setShowQuarantineConfirm] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setTraceData(null);
    setShowQuarantineConfirm(false);

    try {
      const res = await inventoryService.traceBatch(searchQuery.trim());
      if (res.success && res.data) {
        setTraceData(res.data);
      } else {
        setError(res.error?.message || 'Batch not found');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Batch not found or failed to trace');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (shouldBlock: boolean) => {
    if (!traceData) return;
    setQuarantining(true);

    try {
      const res = await inventoryService.updateBatchStatus(traceData.batch.id, {
        isBlocked: shouldBlock,
        blockReason: shouldBlock ? (quarantineReason.trim() || 'Manufacturer recall / safety advisory') : undefined,
      });

      if (res.success) {
        // refresh trace data
        const updated = await inventoryService.traceBatch(traceData.batch.batchNumber);
        if (updated.success && updated.data) {
          setTraceData(updated.data);
        }
        setShowQuarantineConfirm(false);
        setQuarantineReason('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update batch status');
    } finally {
      setQuarantining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-md">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Batch Recall & Clinical Traceability</h2>
            <p className="text-xs text-slate-500">
              Instantly trace any batch/lot across all administered patients, orders, locations, and quarantine recalled stock.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Enter Batch Number or Lot # (e.g. VISI-2026-B1, OMNI-2026-X1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-4"
          >
            {loading ? 'Searching...' : 'Trace Batch'}
          </Button>
        </form>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Trace Results */}
      {traceData && (
        <div className="space-y-6">
          {/* Batch Identity & Quarantine Banner */}
          <div className={`p-5 rounded-lg border shadow-sm ${
            traceData.batch.isBlocked
              ? 'bg-rose-50 border-rose-300'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold">
                    {traceData.batch.itemCode}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{traceData.batch.itemName}</h3>
                  {traceData.batch.isBlocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-600 text-white">
                      <Ban className="w-3.5 h-3.5" /> QUARANTINED / RECALLED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE & USABLE
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Batch Number:</span>
                    <span className="font-mono font-bold text-slate-800">{traceData.batch.batchNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Supplier:</span>
                    <span className="font-medium text-slate-800">{traceData.batch.supplierName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Expiry Date:</span>
                    <span className="font-semibold text-slate-800">{new Date(traceData.batch.expiryDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Remaining Stock:</span>
                    <span className="font-bold text-slate-800">{traceData.batch.currentQuantity} / {traceData.batch.initialQuantity}</span>
                  </div>
                </div>

                {traceData.batch.isBlocked && traceData.batch.blockReason && (
                  <div className="mt-3 text-xs bg-rose-100 text-rose-800 p-2 rounded border border-rose-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Quarantine Reason:</strong> {traceData.batch.blockReason}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-shrink-0">
                {!traceData.batch.isBlocked ? (
                  <Button
                    onClick={() => setShowQuarantineConfirm(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 text-xs py-2"
                  >
                    <Ban className="w-4 h-4" /> Issue Recall / Quarantine
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleToggleBlock(false)}
                    disabled={quarantining}
                    variant="outline"
                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs py-2"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Lift Quarantine
                  </Button>
                )}
              </div>
            </div>

            {/* Quarantine Reason Input Box */}
            {showQuarantineConfirm && (
              <div className="mt-4 pt-4 border-t border-rose-200 space-y-3">
                <div className="text-xs font-semibold text-rose-900">
                  Enter Mandatory Recall Notice / Reason for Quarantining:
                </div>
                <Input
                  type="text"
                  placeholder="e.g. CDSCO recall notice, particulate matter reported by supplier..."
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                  className="text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuarantineConfirm(false)}
                    disabled={quarantining}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleToggleBlock(true)}
                    disabled={quarantining}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                  >
                    {quarantining ? 'Quarantining...' : 'Confirm Immediate Quarantine'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Location Breakdown & Impact Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Affected Patients</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{traceData.affectedPatientCount}</div>
              <p className="text-xs text-slate-400 mt-1">Administered during imaging scans</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Remaining Stock Locations</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {traceData.currentStockLocations.length === 0 ? (
                  <span className="text-slate-400">Zero remaining stock</span>
                ) : (
                  traceData.currentStockLocations.map((loc) => (
                    <div key={loc.location} className="flex justify-between py-0.5">
                      <span className="text-slate-600">{loc.location}:</span>
                      <span className="font-bold text-slate-900">{loc.quantity} units</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Ledger Transactions</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{traceData.transactionCount}</div>
              <p className="text-xs text-slate-400 mt-1">{traceData.wastageCount} wastage / opened-vial logs</p>
            </div>
          </div>

          {/* Affected Patients Clinical Roster */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-red-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Clinical Exposure Roster — Patients Administered This Batch ({traceData.affectedPatients.length})
                </h3>
              </div>
              <span className="text-xs text-red-600 font-semibold">Priority Patient Safety Follow-up</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Patient ID</th>
                    <th className="px-4 py-2.5">Patient Name</th>
                    <th className="px-4 py-2.5">Phone Number</th>
                    <th className="px-4 py-2.5">Accession Number</th>
                    <th className="px-4 py-2.5">Modality & Procedure</th>
                    <th className="px-4 py-2.5">Order Status</th>
                    <th className="px-4 py-2.5">Report Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {traceData.affectedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No clinical administrations recorded for this batch.
                      </td>
                    </tr>
                  ) : (
                    traceData.affectedPatients.map((p) => (
                      <tr key={p.orderId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{p.patientId}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.patientName}</td>
                        <td className="px-4 py-3 text-slate-600">{p.phone || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{p.accessionNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">{p.modality}</span>
                          <span className="text-slate-500 block text-[11px]">{p.examinationName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.hasFinalReport ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> FINALIZED
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">PENDING</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Audit Trail Transactions */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Batch Movement Ledger ({traceData.transactions.length})</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Tx Number</th>
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Location / Flow</th>
                    <th className="px-4 py-2.5 text-right">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {traceData.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{tx.transactionNumber}</td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{tx.type}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {tx.sourceLocation && tx.targetLocation ? (
                          <span className="flex items-center gap-1">
                            {tx.sourceLocation} <ArrowRight className="w-3 h-3 text-slate-400" /> {tx.targetLocation}
                          </span>
                        ) : (
                          tx.targetLocation || tx.sourceLocation || '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{tx.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 font-mono">
                        {tx.balanceBefore} → {tx.balanceAfter}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{tx.performedByName || 'Staff'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


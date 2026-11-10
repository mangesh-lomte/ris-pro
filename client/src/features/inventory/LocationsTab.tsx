import { useState } from 'react';
import { InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Building2, ArrowRightLeft, Wrench, ShieldCheck, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';
import { TransferStockModal } from './TransferStockModal';
import { AdjustStockModal } from './AdjustStockModal';
import { formatDate } from '../../utils/formatters';

interface Props {
  items: InventoryItemRecord[];
  locationData: any;
  onRefresh: () => void;
  isAdmin: boolean;
}

export function LocationsTab({ items, locationData, onRefresh, isAdmin }: Props) {
  const [selectedLoc, setSelectedLoc] = useState<string>('CT_SCANNER');
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  const locations = locationData?.locations || ['CT_SCANNER', 'MRI_SCANNER', 'XRAY_ROOM', 'PHARMACY', 'GENERAL_STORE'];
  const stocksGrouped = locationData?.grouped || {};
  const currentStocks = stocksGrouped[selectedLoc] || [];

  return (
    <div className="space-y-4">
      {/* Location selector pills & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-thin">
          {locations.map((loc: string) => (
            <button
              key={loc}
              onClick={() => setSelectedLoc(loc)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                selectedLoc === loc
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{loc.replace(/_/g, ' ')}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsTransferOpen(true)}
            className="flex items-center gap-1.5 text-xs border-sky-300 text-sky-800 hover:bg-sky-50 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <ArrowRightLeft className="w-4 h-4 text-sky-600" />
            <span>Transfer Stock</span>
          </Button>

          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setIsAdjustOpen(true)}
              className="flex items-center gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>Stock Adjustment</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stocks Table for Selected Location */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50/70 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <h4 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
              {selectedLoc.replace(/_/g, ' ')} Active Cabinet Inventory
            </h4>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {currentStocks.length} distinct items/lots currently stored
          </span>
        </div>

        <div className="table-scroll-container thin-scroll overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[650px]">
          <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Item Code</th>
              <th className="p-3">Item Description</th>
              <th className="p-3">Batch / Lot</th>
              <th className="p-3">Expiration Date</th>
              <th className="p-3 text-right">Room Stock</th>
              <th className="p-3">Unit</th>
              <th className="p-3 text-center">Lot Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentStocks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No stock currently placed in {selectedLoc.replace(/_/g, ' ')}. Use 'Transfer Stock' to replenish.
                </td>
              </tr>
            ) : (
              currentStocks.map((s: any) => {
                const isExp = s.batch ? new Date(s.batch.expiryDate) <= new Date() : false;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-medium text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-[11px]">
                        {s.item?.itemCode}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{s.item?.name}</td>
                    <td className="p-3 font-mono text-slate-700">{s.batch?.batchNumber || '—'}</td>
                    <td className="p-3 text-slate-600 font-medium">
                      {s.batch ? formatDate(s.batch.expiryDate) : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-slate-900 text-sm font-mono">{s.quantity}</span>
                    </td>
                    <td className="p-3 text-slate-500">{s.item?.unit}</td>
                    <td className="p-3 text-center">
                      {s.batch?.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Ban className="w-3 h-3" /> QUARANTINED
                        </span>
                      ) : isExp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> EXPIRED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> READY
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

      <TransferStockModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={onRefresh}
        items={items}
        initialLocation={selectedLoc}
      />

      <AdjustStockModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        onSuccess={onRefresh}
        items={items}
      />
    </div>
  );
}


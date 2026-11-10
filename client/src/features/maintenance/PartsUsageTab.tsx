import React, { useState } from 'react';
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Boxes
} from 'lucide-react';
import { MaintenancePartUsageRecord } from '../../services/maintenanceService';
import { formatINR } from '../../utils/formatters';

interface PartsUsageTabProps {
  partUsages: MaintenancePartUsageRecord[];
  loading: boolean;
  onRefresh: () => void;
  onOpenConsumeModal: () => void;
}

export const PartsUsageTab: React.FC<PartsUsageTabProps> = ({
  partUsages,
  loading,
  onRefresh,
  onOpenConsumeModal,
}) => {
  const [search, setSearch] = useState('');

  const totalCost = partUsages.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);

  const filtered = partUsages.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.equipment?.name && p.equipment.name.toLowerCase().includes(q)) ||
      (p.equipment?.assetTag && p.equipment.assetTag.toLowerCase().includes(q)) ||
      (p.inventoryItem?.name && p.inventoryItem.name.toLowerCase().includes(q)) ||
      (p.inventoryItem?.itemCode && p.inventoryItem.itemCode.toLowerCase().includes(q)) ||
      (p.batch?.batchNumber && p.batch.batchNumber.toLowerCase().includes(q)) ||
      (p.installedByName && p.installedByName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Module 11 Inventory Linkage Traceability Banner */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-sky-950">
            <Boxes className="w-4 h-4 text-sky-600" />
            <span>Biomedical Parts & Inventory Integration (Module 11 Unified Stock)</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 text-slate-700 font-medium">
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">1. Maintenance Work Order</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">2. Item Master Verification</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">3. FEFO Batch Ledger Deduction</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">4. Equipment Service Ledger</span>
          </div>
        </div>
        <span className="text-[11px] text-sky-800 bg-white px-2.5 py-1 rounded border border-sky-200 shrink-0 font-medium">
          Real-Time Physical Stock Sync
        </span>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search part name, code, lot, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Parts Installed: <strong className="text-slate-900">{partUsages.length}</strong> | Total Spares Valuation:{' '}
            <strong className="text-emerald-700 font-bold">{formatINR(totalCost)}</strong>
          </div>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh
          </button>
        </div>

        <button
          onClick={onOpenConsumeModal}
          className="px-3.5 py-1.5 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold flex items-center gap-1.5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Plus className="w-4 h-4" />
          <span>Consume Maintenance Spare</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading maintenance parts consumption ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No maintenance parts consumption records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Installed Date</th>
                  <th className="py-3 px-3.5">Equipment Unit</th>
                  <th className="py-3 px-3.5">Inventory Part & SKU</th>
                  <th className="py-3 px-3.5">Batch / Lot Reference</th>
                  <th className="py-3 px-3.5">Installed Location</th>
                  <th className="py-3 px-3.5 text-right">Quantity</th>
                  <th className="py-3 px-3.5 text-right">Unit Price</th>
                  <th className="py-3 px-3.5 text-right">Total Valuation</th>
                  <th className="py-3 px-3.5">Biomedical Engineer</th>
                  <th className="py-3 px-3.5">Reason / Service Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      {new Date(p.installedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{p.equipment?.name || 'Equipment'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.equipment?.assetTag}</div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700">
                      <div className="font-semibold text-slate-900">{p.inventoryItem?.name || 'Spare Part'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.inventoryItem?.itemCode}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {p.batch?.batchNumber || 'Standard Stock'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {p.location}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {p.quantityUsed}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                      {formatINR(Number(p.unitCost))}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {formatINR(Number(p.totalCost))}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap font-medium">
                      {p.installedByName}
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 max-w-xs truncate">
                      {p.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

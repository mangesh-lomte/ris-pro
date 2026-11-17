import { useState } from 'react';
import { InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Syringe, Droplets, CheckCircle2, AlertTriangle, AlertOctagon, ArrowRight, ShieldCheck } from 'lucide-react';
import { DispenseContrastModal } from './DispenseContrastModal';
import { formatINR } from '../../utils/formatters';

interface Props {
  contrastItems: InventoryItemRecord[];
  onRefresh: () => void;
}

export function ContrastCatalogTab({ contrastItems, onRefresh }: Props) {
  const [selectedType, setSelectedType] = useState<'ALL' | 'IODINATED' | 'GADOLINIUM'>('ALL');
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);

  const filtered = contrastItems.filter(
    (c) => selectedType === 'ALL' || c.contrastType === selectedType || c.subCategory === selectedType
  );

  return (
    <div className="space-y-4">
      {/* Contrast Clinical Pipeline Context Card */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-sky-950">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Contrast Lifecycle & Clinical Traceability Pipeline</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 text-slate-700 font-medium">
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">1. Technologist Administration</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">2. FEFO Auto-Allocation</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">3. Stock Ledger Deduction</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-900 font-semibold">4. Billing Clinical Charge</span>
          </div>
        </div>
        <span className="text-[11px] text-sky-800 bg-white px-2.5 py-1 rounded border border-sky-200 shrink-0 font-medium">
          FEFO Enforcement Active
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-sm text-slate-900">Contrast Media Formulations (CT & MRI)</h3>
          <div className="flex items-center gap-1 ml-4 text-xs">
            {(['ALL', 'IODINATED', 'GADOLINIUM'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selectedType === t
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => setIsDispenseOpen(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Syringe className="w-4 h-4" />
          <span>Dispense to Patient Scan</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const totalStock = c.totalPhysicalStock !== undefined ? c.totalPhysicalStock : c.quantity;
          const isOutOfStock = totalStock === 0;
          const isLow = totalStock <= c.reorderLevel;

          return (
            <div
              key={c.id}
              className="bg-white rounded border border-slate-200 p-5 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900 leading-tight">{c.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                    c.contrastType === 'GADOLINIUM' || c.subCategory === 'GADOLINIUM'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  }`}>
                    {c.contrastType || c.subCategory || 'CONTRAST'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-semibold text-[11px] text-slate-800">
                    {c.itemCode}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Concentration</span>
                    <span className="font-medium text-slate-800">{c.concentration || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Pack Size</span>
                    <span className="font-medium text-slate-800">{c.packSize || '100 mL'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Price / Unit</span>
                    <span className="font-semibold text-slate-800 font-mono">{formatINR(c.unitPrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Reorder Min</span>
                    <span className="font-medium text-slate-800 font-mono">{c.reorderLevel} {c.unit}s</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Usable Stock</span>
                  <span className="text-lg font-bold text-slate-900 font-mono">{totalStock}</span>
                  <span className="text-xs text-slate-500 ml-1">{c.unit}s</span>
                </div>

                <div>
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      DEPLETED
                    </span>
                  ) : isLow ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      LOW STOCK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      READY
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DispenseContrastModal
        isOpen={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        onSuccess={onRefresh}
        contrastItems={contrastItems}
      />
    </div>
  );
}


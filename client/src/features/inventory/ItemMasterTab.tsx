import { useState } from 'react';
import { InventoryItemRecord } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PlusCircle, Search, AlertTriangle, AlertOctagon, CheckCircle2, Tag } from 'lucide-react';
import { CreateItemModal } from './CreateItemModal';
import { formatINR } from '../../utils/formatters';

interface Props {
  items: InventoryItemRecord[];
  onRefresh: () => void;
  isAdmin: boolean;
}

export function ItemMasterTab({ items, onRefresh, isAdmin }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredItems = items.filter((it) => {
    const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
    const matchSearch =
      !search.trim() ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      (it.barcode && it.barcode.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Search by item code, name, barcode..."
              className="pl-9 text-xs focus-visible:ring-2 focus-visible:ring-cyan-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search item catalog"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-thin">
            {['ALL', 'CONTRAST', 'MEDICINE', 'FILM', 'CONSUMABLE', 'EMERGENCY_KIT'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Item Master</span>
          </Button>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
        <div className="table-scroll-container thin-scroll overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Item Code</th>
              <th className="p-3">Item Name & Formulation</th>
              <th className="p-3">Category</th>
              <th className="p-3">Unit</th>
              <th className="p-3 text-right">Unit Price</th>
              <th className="p-3 text-right">Physical Stock</th>
              <th className="p-3 text-right">Reorder Level</th>
              <th className="p-3 text-center">Stock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  No inventory items found matching filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => {
                const stock = it.totalPhysicalStock !== undefined ? it.totalPhysicalStock : it.quantity;
                const isOutOfStock = stock === 0;
                const isLowStock = it.reorderAlert || stock <= it.reorderLevel;

                return (
                  <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-medium text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900 font-mono font-bold text-[11px] inline-block">
                        {it.itemCode}
                      </span>
                      {it.barcode && (
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                          BC: {it.barcode}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{it.name}</span>
                      {it.concentration && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                          {it.concentration}
                        </span>
                      )}
                      {it.isEmergencyKit && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                          Emergency Kit
                        </span>
                      )}
                      {it.packSize && (
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          Pack: {it.packSize}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {it.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{it.unit}</td>
                    <td className="p-3 text-right font-medium text-slate-800 font-mono">
                      {formatINR(it.unitPrice)}
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-slate-900 text-sm font-mono">
                        {stock}
                      </span>
                      <span className="text-slate-400 ml-1">{it.unit}</span>
                    </td>
                    <td className="p-3 text-right text-slate-600 font-mono">
                      {it.reorderLevel} {it.unit}
                    </td>
                    <td className="p-3 text-center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertOctagon className="w-3 h-3" />
                          OUT OF STOCK
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          LOW STOCK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          IN STOCK
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

      <CreateItemModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={onRefresh}
      />
    </div>
  );
}


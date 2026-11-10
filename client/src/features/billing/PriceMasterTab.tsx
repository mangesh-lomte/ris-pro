import { useState } from 'react';
import { PriceMasterItem, billingService } from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Tag, Plus, Search, Edit2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatINR } from '../../utils/formatters';

interface PriceMasterTabProps {
  prices: PriceMasterItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function PriceMasterTab({ prices, loading, onRefresh }: PriceMasterTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('ALL');

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceMasterItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [modality, setModality] = useState('CT');
  const [category, setCategory] = useState('DIAGNOSTIC');
  const [basePrice, setBasePrice] = useState<number>(100);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setModality('CT');
    setCategory('DIAGNOSTIC');
    setBasePrice(100);
    setTaxRate(0);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: PriceMasterItem) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setModality(item.modality);
    setCategory(item.category);
    setBasePrice(Number(item.basePrice));
    setTaxRate(Number(item.taxRate));
    setModalError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setModalLoading(true);
    setModalError(null);

    try {
      if (editingItem) {
        await billingService.updatePrice(editingItem.id, {
          name,
          basePrice,
          taxRate,
          category,
        });
      } else {
        await billingService.createPrice({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          modality,
          category,
          basePrice,
          taxRate,
        });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.message || 'Failed to save price item');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredPrices = prices.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());
    const matchesModality = selectedModality === 'ALL' || p.modality === selectedModality;
    return matchesSearch && matchesModality;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Search code or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          <select
            value={selectedModality}
            onChange={(e) => setSelectedModality(e.target.value)}
            className="rounded-lg border border-slate-300 text-xs px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="ALL">All Modalities</option>
            <option value="CT">CT</option>
            <option value="MRI">MRI</option>
            <option value="XRAY">X-Ray</option>
            <option value="ULTRASOUND">Ultrasound</option>
            <option value="MAMMOGRAPHY">Mammography</option>
            <option value="OTHER">Consumables / Other</option>
          </select>
        </div>

        {isAdmin ? (
          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-cyan-700 hover:bg-cyan-800 text-white text-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Price Master Item
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-2xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Price edits restricted to Administrators</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Service Code</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Service Description</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Modality</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Category</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Base Price (₹)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Tax Rate (%)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Status</TableHead>
              {isAdmin && <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-400">
                  Loading service price master...
                </TableCell>
              </TableRow>
            ) : filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-400">
                  No pricing records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold text-cyan-900 text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium text-slate-900 text-xs">{item.name}</TableCell>
                  <TableCell>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-3xs uppercase">
                      {item.modality}
                    </span>
                  </TableCell>
                  <TableCell className="text-2xs text-slate-500 uppercase">{item.category}</TableCell>
                  <TableCell className="font-mono font-bold text-slate-900 text-xs text-right">
                    {formatINR(item.basePrice)}
                  </TableCell>
                  <TableCell className="font-mono text-slate-600 text-xs text-right">
                    {Number(item.taxRate).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-3xs font-bold uppercase ${
                        item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(item)}
                        className="h-7 px-2 text-2xs gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit / Create Price Item Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen} maxWidth="md">
        <form onSubmit={handleSave}>
          <DialogHeader onClose={() => setModalOpen(false)}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>{editingItem ? 'Edit Price Master Item' : 'New Price Master Item'}</DialogTitle>
                <p className="text-2xs text-slate-500">Service item fee and taxation definition</p>
              </div>
            </div>
          </DialogHeader>

          <DialogContent className="p-6 space-y-4 text-xs">
            {modalError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {modalError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Service Code *</label>
                <Input
                  placeholder="e.g. CT-BRAIN-NC"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingItem}
                  className="font-mono text-xs uppercase"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Modality *</label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full rounded-lg border border-slate-300 text-xs px-2.5 py-2 bg-white"
                >
                  <option value="CT">CT</option>
                  <option value="MRI">MRI</option>
                  <option value="XRAY">X-Ray</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                  <option value="MAMMOGRAPHY">Mammography</option>
                  <option value="OTHER">Consumables / Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Service Name / Description *</label>
              <Input
                placeholder="e.g. CT Brain Non-Contrast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Base Price (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                  className="font-mono font-bold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tax Rate (%) *</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 text-xs px-2 py-2 bg-white"
                >
                  <option value="DIAGNOSTIC">Diagnostic</option>
                  <option value="CONSUMABLE">Consumable</option>
                  <option value="PROCEDURE">Procedure</option>
                </select>
              </div>
            </div>
          </DialogContent>

          <DialogFooter>
            <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={modalLoading} className="bg-cyan-700 hover:bg-cyan-800 text-white">
              {modalLoading ? 'Saving...' : 'Save Item'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}


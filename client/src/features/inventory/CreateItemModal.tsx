import { useState } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PlusCircle, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateItemModal({ isOpen, onClose, onSuccess }: Props) {
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONTRAST');
  const [subCategory, setSubCategory] = useState('IODINATED');
  const [unit, setUnit] = useState('VIAL');
  const [barcode, setBarcode] = useState('');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [unitPrice, setUnitPrice] = useState('0.00');
  const [concentration, setConcentration] = useState('');
  const [packSize, setPackSize] = useState('');
  const [filmSize, setFilmSize] = useState('');
  const [isEmergencyKit, setIsEmergencyKit] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !name.trim()) {
      setError('Item code and name are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inventoryService.createItem({
        itemCode: itemCode.trim(),
        name: name.trim(),
        category,
        subCategory: subCategory.trim() || undefined,
        unit,
        barcode: barcode.trim() || undefined,
        reorderLevel: parseInt(reorderLevel, 10) || 10,
        unitPrice: parseFloat(unitPrice) || 0,
        contrastType: category === 'CONTRAST' ? subCategory : undefined,
        concentration: concentration.trim() || undefined,
        packSize: packSize.trim() || undefined,
        filmSize: category === 'FILM' ? filmSize.trim() || undefined : undefined,
        isEmergencyKit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-teal-400" />
            <h2 className="font-semibold text-lg">Add New Item to Master</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg text-sm border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Code *</label>
              <Input
                placeholder="e.g. INV-CON-001"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode / SKU</label>
              <Input
                placeholder="e.g. 890123400999"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
            <Input
              placeholder="e.g. Omnipaque 350 mg I/mL (100 mL)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="CONTRAST">CONTRAST</option>
                <option value="MEDICINE">MEDICINE</option>
                <option value="FILM">FILM</option>
                <option value="CONSUMABLE">CONSUMABLE</option>
                <option value="EMERGENCY_KIT">EMERGENCY_KIT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory</label>
              <Input
                placeholder="e.g. IODINATED / SYRINGE"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="VIAL">VIAL</option>
                <option value="AMPOULE">AMPOULE</option>
                <option value="SHEET">SHEET</option>
                <option value="PIECE">PIECE</option>
                <option value="KIT">KIT</option>
                <option value="BAG">BAG</option>
                <option value="BOX">BOX</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Point (Min Stock)</label>
              <Input
                type="number"
                min="1"
                placeholder="10"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
              />
            </div>
          </div>

          {category === 'CONTRAST' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-teal-50/50 rounded-lg border border-teal-200">
              <div>
                <label className="block text-xs font-semibold text-teal-900 mb-1">Concentration</label>
                <Input
                  placeholder="e.g. 350 mg/mL or 1.0 mmol/mL"
                  value={concentration}
                  onChange={(e) => setConcentration(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-teal-900 mb-1">Pack Size</label>
                <Input
                  placeholder="e.g. 100 mL vial"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                />
              </div>
            </div>
          )}

          {category === 'FILM' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Film Dimensions</label>
              <Input
                placeholder="e.g. 14x17, 8x10, 10x12"
                value={filmSize}
                onChange={(e) => setFilmSize(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="emergencyCheck"
              checked={isEmergencyKit}
              onChange={(e) => setIsEmergencyKit(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="emergencyCheck" className="text-xs font-medium text-slate-700">
              Part of Contrast-Reaction Emergency Kit / Crash Cart
            </label>
          </div>

          <div className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
              {loading ? 'Creating...' : 'Save Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


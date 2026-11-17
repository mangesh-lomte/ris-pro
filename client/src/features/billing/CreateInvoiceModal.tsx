import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { billingService, PriceMasterItem, InvoiceRecord } from '../../services/billingService';
import { FilePlus, Plus, Trash2, AlertCircle } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prices: PriceMasterItem[];
  onInvoiceCreated: (invoice: InvoiceRecord) => void;
}

interface SelectedItem {
  priceItemId?: string;
  code: string;
  description: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
}

export function CreateInvoiceModal({
  open,
  onOpenChange,
  prices,
  onInvoiceCreated,
}: CreateInvoiceModalProps) {
  const [patientId, setPatientId] = useState('');
  const [accessionNumber, setAccessionNumber] = useState('');
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [selectedPriceCode, setSelectedPriceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPatientId('');
      setAccessionNumber('');
      setItems([]);
      setSelectedPriceCode('');
      setError(null);
    }
  }, [open]);

  const handleAddItem = () => {
    const found = prices.find((p) => p.code === selectedPriceCode);
    if (!found) return;

    setItems([
      ...items,
      {
        priceItemId: found.id,
        code: found.code,
        description: found.name,
        unitPrice: Number(found.basePrice),
        quantity: 1,
        taxRate: Number(found.taxRate),
      },
    ]);
    setSelectedPriceCode('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, quantity);
    setItems(updated);
  };

  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity * (item.taxRate / 100), 0);
  const netTotal = grossTotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim()) {
      setError('Patient ID is mandatory.');
      return;
    }
    if (!accessionNumber.trim()) {
      setError('Accession Number is mandatory.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one line item to the invoice.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await billingService.createInvoice({
        patientId: patientId.trim(),
        accessionNumber: accessionNumber.trim(),
        items,
      });

      if (res.data) {
        onOpenChange(false);
        onInvoiceCreated(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Generate New RIS Invoice</DialogTitle>
              <p className="text-2xs text-slate-500">
                Itemized invoice linked to persistent Patient ID and Accession Number
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogContent className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Patient ID (MRN) *</label>
              <Input
                placeholder="e.g. PAT-2026-DEMO01"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="font-mono text-xs uppercase"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Accession Number *</label>
              <Input
                placeholder="e.g. ACC-2026-DEMO01"
                value={accessionNumber}
                onChange={(e) => setAccessionNumber(e.target.value)}
                className="font-mono text-xs uppercase"
                required
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Itemized Fee Schedule</span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPriceCode}
                  onChange={(e) => setSelectedPriceCode(e.target.value)}
                  className="rounded-lg border border-slate-300 text-xs px-2 py-1 bg-white"
                >
                  <option value="">Select from Price Master...</option>
                  {prices.map((p) => (
                    <option key={p.id} value={p.code}>
                      [{p.modality}] {p.name} - {formatINR(p.basePrice)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddItem}
                  disabled={!selectedPriceCode}
                  className="h-7 text-2xs gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-slate-400 italic text-center py-4">No services added yet. Select a service above.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-2xs"
                  >
                    <div className="flex-1">
                      <span className="font-mono font-bold text-slate-800 mr-2">{item.code}</span>
                      <span className="text-slate-700">{item.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                          className="w-12 text-center rounded border border-slate-300 px-1 py-0.5 text-xs font-mono"
                        />
                      </div>
                      <span className="font-mono font-semibold text-slate-800 w-24 text-right">
                        {formatINR(item.unitPrice * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="border-t border-slate-200 pt-2 flex flex-col items-end text-2xs space-y-1">
                  <div className="flex justify-between w-48">
                    <span className="text-slate-500">Gross:</span>
                    <span className="font-mono">{formatINR(grossTotal)}</span>
                  </div>
                  <div className="flex justify-between w-48">
                    <span className="text-slate-500">Tax:</span>
                    <span className="font-mono">{formatINR(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between w-48 font-bold text-xs text-slate-900 border-t pt-1">
                    <span>Net Total:</span>
                    <span className="font-mono text-cyan-800">{formatINR(netTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={loading || items.length === 0}
            className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
          >
            {loading ? 'Creating...' : 'Issue Invoice'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


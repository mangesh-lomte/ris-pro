import { useState } from 'react';
import { Quotation, PriceMasterItem, billingService } from '../../services/billingService';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Calculator, Plus, Trash2, Printer } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface QuotationTabProps {
  quotations: Quotation[];
  prices: PriceMasterItem[];
  loading: boolean;
  onRefresh: () => void;
}

interface SelectedQuoteItem {
  priceItemId?: string;
  code: string;
  description: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
}

export function QuotationTab({ quotations, prices, loading, onRefresh }: QuotationTabProps) {
  const [patientId, setPatientId] = useState('');
  const [validityDays, setValidityDays] = useState(14);
  const [items, setItems] = useState<SelectedQuoteItem[]>([]);
  const [selectedPriceCode, setSelectedPriceCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);

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
        discount: 0,
        taxRate: Number(found.taxRate),
      },
    ]);
    setSelectedPriceCode('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const grossTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const taxable = Math.max(0, grossTotal - discountTotal);
  const taxTotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity * (item.taxRate / 100)), 0);
  const netEstimate = taxable + taxTotal;

  const handleGenerateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim() || items.length === 0) return;

    setCreating(true);
    try {
      const res = await billingService.createQuotation({
        patientId: patientId.trim(),
        validityDays,
        items,
      });

      if (res.data) {
        setActiveQuotation(res.data);
        setItems([]);
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to generate quotation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quotation Generator Card */}
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <div className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Patient Fee Estimate & Quotation Calculator</h3>
            <p className="text-2xs text-slate-500">
              Provide formal pre-exam cost estimates without creating unbilled invoices or orders
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerateQuotation} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <label className="font-semibold text-slate-700">Estimate Validity Period</label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-300 text-xs px-2.5 py-2 bg-white"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days (Standard)</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <div className="flex gap-2">
                <select
                  value={selectedPriceCode}
                  onChange={(e) => setSelectedPriceCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 text-xs px-2.5 py-2 bg-white"
                >
                  <option value="">Select Service / Exam...</option>
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
                  className="gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-2">
              <span className="font-semibold text-slate-800 block text-2xs uppercase">Estimated Procedure Line Items</span>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-2xs"
                >
                  <div className="flex-1">
                    <span className="font-mono font-bold text-slate-800 mr-2">{item.code}</span>
                    <span className="text-slate-700">{item.description}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].quantity = parseInt(e.target.value) || 1;
                          setItems(updated);
                        }}
                        className="w-12 text-center rounded border border-slate-300 px-1 py-0.5 text-xs font-mono"
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-900 w-24 text-right">
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

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs">
                <span className="text-slate-500">
                  Gross: <strong className="font-mono text-slate-800">{formatINR(grossTotal)}</strong> | Tax: <strong className="font-mono text-slate-800">{formatINR(taxTotal)}</strong>
                </span>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-2xs text-slate-500 block">Total Estimated Fee:</span>
                    <span className="font-mono font-extrabold text-cyan-800 text-sm">{formatINR(netEstimate)}</span>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={creating}
                    className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
                  >
                    {creating ? 'Saving...' : 'Issue Estimate / Quotation'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Quotation Detail View if selected */}
      {activeQuotation && (
        <div className="rounded border border-cyan-200 bg-cyan-50/40 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-cyan-200 text-cyan-900 font-bold text-3xs uppercase mr-2">
                {activeQuotation.status}
              </span>
              <strong className="font-mono text-sm text-cyan-900">{activeQuotation.quotationNumber}</strong>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="text-2xs gap-1 border-cyan-300"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Estimate
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-2xs text-slate-600">
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Patient</span>
              <span className="font-bold text-slate-800">
                {activeQuotation.patient ? `${activeQuotation.patient.firstName} ${activeQuotation.patient.lastName}` : activeQuotation.patientId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-3xs uppercase font-bold">Expires On</span>
              <span>{new Date(activeQuotation.expiresAt).toLocaleDateString()}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-3xs uppercase font-bold">Total Estimated Amount</span>
              <span className="font-mono font-extrabold text-sm text-cyan-900">
                {formatINR(activeQuotation.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Past Quotations Table */}
      <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Historical Quotations & Estimates</h4>
          <span className="text-2xs text-slate-500">{quotations.length} records</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Quote #</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient ID</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Patient Name</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">Estimated Total (₹)</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500">Expires</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-center">Status</TableHead>
              <TableHead className="text-3xs uppercase font-bold text-slate-500 text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-slate-400">Loading quotations...</TableCell>
              </TableRow>
            ) : quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-slate-400">No quotation records generated yet.</TableCell>
              </TableRow>
            ) : (
              quotations.map((q) => (
                <TableRow key={q.id} className="hover:bg-slate-50/50 text-xs">
                  <TableCell className="font-mono font-bold text-cyan-900">{q.quotationNumber}</TableCell>
                  <TableCell className="font-mono text-blue-700">{q.patientId}</TableCell>
                  <TableCell className="font-medium text-slate-800">
                    {q.patient ? `${q.patient.firstName} ${q.patient.lastName}` : 'Walk-in'}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-900 text-right">
                    {formatINR(q.totalAmount)}
                  </TableCell>
                  <TableCell className="text-slate-500 text-2xs">
                    {new Date(q.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-3xs font-bold uppercase bg-slate-100 text-slate-700">
                      {q.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveQuotation(q)}
                      className="h-7 text-2xs text-cyan-700 hover:text-cyan-900"
                    >
                      Inspect
                    </Button>
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


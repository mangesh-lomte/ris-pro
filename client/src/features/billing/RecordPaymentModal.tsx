import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InvoiceRecord, billingService, PaymentRecord, ReceiptRecord } from '../../services/billingService';
import { CreditCard, IndianRupee, AlertCircle, Smartphone } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRecord | null;
  onPaymentSuccess: (payment: PaymentRecord, receipt?: ReceiptRecord | null) => void;
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  invoice,
  onPaymentSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'ONLINE' | 'INSURANCE'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setAmount(Number(invoice.balance) > 0 ? Number(invoice.balance) : 0);
      setReferenceNumber('');
      setNotes('');
      setError(null);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (amount > Number(invoice.balance)) {
      setError(`Payment cannot exceed outstanding balance of ${formatINR(invoice.balance)}.`);
      return;
    }
    if (!method) {
      setError('Please select a payment method.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idempotencyKey = `PAY-${invoice.id}-${Date.now()}`;
      const res = await billingService.recordPayment(invoice.id, {
        amount,
        method,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        idempotencyKey,
      });

      if (res.data) {
        onOpenChange(false);
        onPaymentSuccess(res.data, res.data.receipt);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-100 text-cyan-800 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Record Payment</DialogTitle>
              <p className="text-2xs text-slate-500">
                Invoice <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span> • Outstanding: <span className="font-bold text-rose-600">{formatINR(invoice.balance)}</span>
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

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Patient ID</span>
              <span className="font-mono font-bold text-indigo-700">{invoice.patientId}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Accession Number</span>
              <span className="font-mono font-bold text-slate-900">{invoice.accessionNumber}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Total Invoice</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(invoice.total)}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Current Balance</span>
              <span className="font-mono font-bold text-rose-600">{formatINR(invoice.balance)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Payment Amount (₹)</label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={Number(invoice.balance)}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="pl-8 font-mono font-bold text-sm"
                required
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setAmount(Number(invoice.balance))}
                className="text-3xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
              >
                Full Outstanding ({formatINR(invoice.balance)})
              </button>
              {Number(invoice.balance) > 50 && (
                <button
                  type="button"
                  onClick={() => setAmount(Number((Number(invoice.balance) / 2).toFixed(2)))}
                  className="text-3xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                >
                  50% Partial Payment
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Payment Tender / Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'ONLINE', 'INSURANCE'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={`py-2 px-2 text-2xs font-semibold rounded-lg border text-center transition whitespace-nowrap ${
                    method === m
                      ? 'border-cyan-600 bg-cyan-50 text-cyan-800 ring-1 ring-cyan-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m === 'UPI' && <Smartphone className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-700" />}
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Reference / UTR / Auth Code</label>
            <Input
              placeholder={method === 'UPI' ? 'UPI UTR / Transaction ID' : 'Card Auth / Cheque / Ref Number'}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Notes / Remarks (Optional)</label>
            <Input
              placeholder="e.g. Counter deposit, counter cashier"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={loading || amount <= 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {loading ? 'Recording...' : `Record Payment (${formatINR(amount)})`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


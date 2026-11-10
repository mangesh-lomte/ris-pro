import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InvoiceRecord, billingService } from '../../services/billingService';
import { Tag, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatINR } from '../../utils/formatters';

interface ApplyDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRecord | null;
  onSuccess: (updatedInvoice: InvoiceRecord) => void;
}

export function ApplyDiscountModal({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: ApplyDiscountModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [discount, setDiscount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive accurate gross amount before discount
  const grossAmount = invoice
    ? Number(invoice.grossAmount) > 0
      ? Number(invoice.grossAmount)
      : Math.max(0, Number(invoice.total) + Number(invoice.discount || 0) - Number(invoice.taxAmount || 0))
    : 0;

  useEffect(() => {
    if (invoice) {
      setDiscount(Number(invoice.discount) || 0);
      setReason(invoice.discountReason || '');
      setError(null);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Discount approval strictly requires Administrator privileges.');
      return;
    }
    if (discount <= 0) {
      setError('Discount must be greater than zero.');
      return;
    }
    if (discount > grossAmount) {
      setError(`Discount cannot exceed eligible gross amount of ${formatINR(grossAmount)}.`);
      return;
    }
    const paidAmount = Number(invoice.paidAmount ?? (Number(invoice.total) - Number(invoice.balance ?? invoice.outstandingAmount ?? 0))) || 0;
    const taxAmount = Number(invoice.taxAmount) || 0;
    const newNetTotal = grossAmount - discount + taxAmount;
    if (newNetTotal < paidAmount) {
      setError(`New net total (${formatINR(newNetTotal)}) is lower than already paid amount (${formatINR(paidAmount)}). Process a refund first.`);
      return;
    }
    if (!reason.trim()) {
      setError('Audit justification reason is mandatory for discount approvals.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await billingService.applyDiscount(invoice.id, {
        discount,
        reason: reason.trim(),
      });

      if (res.data) {
        onOpenChange(false);
        onSuccess(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to approve discount');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Discount Approval</DialogTitle>
              <p className="text-2xs text-slate-500">
                Invoice <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogContent className="p-6 space-y-4 text-xs">
          {!isAdmin && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>
                <strong>Admin Clearance Required:</strong> Only users with the ADMIN role can authorize fee discounts per compliance policy.
              </span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Gross Amount</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(grossAmount)}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Current Total</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(invoice.total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Approved Discount Amount (₹) *</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={grossAmount}
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              disabled={!isAdmin}
              className="font-mono font-bold text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Approval Reason / Clinical Justification *</label>
            <Input
              placeholder="e.g. Senior citizen concession, staff discount, hardship"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isAdmin}
              required
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
            disabled={loading || !isAdmin || discount <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
          >
            {loading ? 'Approving...' : 'Authorize Discount'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


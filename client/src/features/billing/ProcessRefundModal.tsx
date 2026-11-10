import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InvoiceRecord, billingService } from '../../services/billingService';
import { Undo2, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatINR } from '../../utils/formatters';

interface ProcessRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRecord | null;
  onSuccess: () => void;
}

export function ProcessRefundModal({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: ProcessRefundModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = invoice?.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalRefunded = invoice?.refunds?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const maxRefundable = Math.max(0, totalPaid - totalRefunded);

  useEffect(() => {
    if (invoice) {
      setAmount(maxRefundable);
      setReason('');
      setError(null);
    }
  }, [invoice, maxRefundable]);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Refund processing strictly requires Administrator privileges.');
      return;
    }
    if (amount <= 0) {
      setError('Refund amount must be greater than zero.');
      return;
    }
    if (amount > maxRefundable) {
      setError(`Refund cannot exceed maximum refundable amount of ${formatINR(maxRefundable)}.`);
      return;
    }
    if (!reason.trim()) {
      setError('Mandatory audit reason required for refund or cancellation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await billingService.processRefund(invoice.id, {
        amount,
        reason: reason.trim(),
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
              <Undo2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Refund & Cancellation Billing</DialogTitle>
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
                <strong>Admin Clearance Required:</strong> Only users with the ADMIN role can execute payment refunds.
              </span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Total Paid</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(totalPaid)}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Prev. Refunded</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(totalRefunded)}</span>
            </div>
            <div>
              <span className="text-3xs uppercase font-bold text-slate-400 block">Max Refundable</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(maxRefundable)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Refund Amount (₹) *</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxRefundable}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              disabled={!isAdmin || maxRefundable <= 0}
              className="font-mono font-bold text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Reason for Cancellation / Refund *</label>
            <Input
              placeholder="e.g. Study cancelled by referring physician, double tender"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isAdmin || maxRefundable <= 0}
              required
            />
          </div>

          <p className="text-3xs text-slate-500 italic">
            * All prior payment records remain preserved and immutable for financial auditing.
          </p>
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={loading || !isAdmin || amount <= 0 || maxRefundable <= 0}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
          >
            {loading ? 'Processing...' : `Issue Refund (${formatINR(amount)})`}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


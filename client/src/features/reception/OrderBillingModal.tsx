import { useEffect, useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { CreditCard, CheckCircle2, Receipt, Plus } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { safeRandomUUID } from '../../utils/uuid';

interface BillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  accessionNumber: string;
  patientName: string;
  onPaymentSuccess?: () => void;
}

export function OrderBillingModal({
  open,
  onOpenChange,
  orderId,
  accessionNumber,
  patientName,
  onPaymentSuccess,
}: BillingModalProps) {
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'ONLINE'>('CASH');
  const [reference, setReference] = useState('');
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [paymentAttemptKey, setPaymentAttemptKey] = useState(() => safeRandomUUID());

  useEffect(() => {
    if (open && orderId) {
      loadBilling();
    }
  }, [open, orderId]);

  const loadBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await receptionDeliveryService.getOrderBilling(orderId);
      setBilling(data);
      if (data.invoice?.outstandingAmount > 0) {
        setAmount(data.invoice.outstandingAmount);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load billing details');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await receptionDeliveryService.recordOrderPayment(orderId, {
        amount: Number(amount),
        paymentMethod,
        reference: reference.trim() || undefined,
        authorizationConfirmed: paymentMethod === 'CASH' ? undefined : authorizationConfirmed,
        idempotencyKey: paymentAttemptKey,
      });
      setSuccessMsg(`Payment of ${formatINR(res.amountPaid)} recorded successfully. Receipt: ${res.receiptNumber}`);
      setReference('');
      setAuthorizationConfirmed(false);
      setPaymentAttemptKey(safeRandomUUID());
      loadBilling();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 bg-white dark:bg-slate-900 border rounded shadow-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#2563EB] text-white rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Billing & Payment Management
              </DialogTitle>
              <p className="text-2xs text-slate-500">
                Accession: <span className="font-mono font-bold text-blue-700">{accessionNumber}</span> • Patient: {patientName}
              </p>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-2 p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs">{error}</div>
        )}
        {successMsg && (
          <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading && !billing ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading billing ledger...</div>
        ) : billing ? (
          <div className="space-y-4 py-3">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <span className="text-3xs text-slate-500 uppercase block">Total Due</span>
                <span className="text-sm font-bold font-mono text-slate-900">{formatINR(billing.invoice.total)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-3xs text-emerald-700 uppercase block">Paid</span>
                <span className="text-sm font-bold font-mono text-emerald-800">{formatINR(billing.invoice.paidAmount)}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <span className="text-3xs text-amber-700 uppercase block">Balance Due</span>
                <span className="text-sm font-bold font-mono text-amber-800">{formatINR(billing.invoice.outstandingAmount)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border">
                <span className="text-3xs text-slate-500 uppercase block">Status</span>
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${
                  billing.invoice.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {billing.invoice.status}
                </span>
              </div>
            </div>

            {/* Collect Payment Form (if balance remains) */}
            {billing.invoice.outstandingAmount > 0 && (
              <form onSubmit={handleCollectPayment} className="p-3 bg-slate-50 rounded border space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#2563EB]" /> Collect Front Desk Payment
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-3xs font-semibold mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={billing.invoice.outstandingAmount}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full p-1.5 border rounded text-xs bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-semibold mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full p-1.5 border rounded text-xs bg-white"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                      <option value="DEBIT_CARD">Debit Card</option>
                      <option value="ONLINE">UPI / Online</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-3xs font-semibold mb-1">External authorization reference</label>
                    <input
                      type="text"
                      placeholder="e.g. POS Txn #4829"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      required={paymentMethod !== 'CASH'}
                      disabled={paymentMethod === 'CASH'}
                      className="w-full p-1.5 border rounded text-xs bg-white"
                    />
                  </div>
                </div>

                {paymentMethod !== 'CASH' && (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950">
                    <input type="checkbox" checked={authorizationConfirmed} onChange={(e) => setAuthorizationConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4" />
                    <span>I verified this payment was approved by the external POS terminal, UPI application, insurer, or bank. The RIS does not authorize the transaction itself.</span>
                  </label>
                )}

                <div className="flex justify-end pt-1">
                  <Button type="submit" disabled={loading || amount <= 0 || amount > billing.invoice.outstandingAmount || (paymentMethod !== 'CASH' && (!reference.trim() || !authorizationConfirmed))} size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs">
                    {loading ? 'Processing...' : `Collect ${formatINR(amount)} Payment`}
                  </Button>
                </div>
              </form>
            )}

            {/* Payment History */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-500" /> Payment History & Receipts ({billing.invoice.payments?.length || 0})
              </h4>
              {billing.invoice.payments?.length === 0 ? (
                <div className="p-2.5 bg-slate-50 border rounded-lg text-2xs text-slate-500 text-center">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {billing.invoice.payments.map((p: any) => (
                    <div key={p.id} className="p-2 bg-slate-50 border rounded-lg text-xs flex items-center justify-between font-mono">
                      <div>
                        <span className="font-bold text-slate-900">{formatINR(p.amount)}</span>
                        <span className="text-2xs text-slate-500 ml-2 font-sans">({p.paymentMethod} • Receipt: {p.receiptNumber || 'Pending'} • Ref: {p.reference || 'Cash'})</span>
                      </div>
                      <span className="text-3xs text-slate-400">{new Date(p.paidAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

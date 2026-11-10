import { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InvoiceRecord, billingService } from '../../services/billingService';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface CreateClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRecord | null;
  onSuccess: () => void;
}

export function CreateClaimModal({ open, onOpenChange, invoice, onSuccess }: CreateClaimModalProps) {
  const [tpaProvider, setTpaProvider] = useState('MEDICARE / STAR HEALTH');
  const [policyNumber, setPolicyNumber] = useState('POL-99201-X');
  const [approvalCode, setApprovalCode] = useState('AUTH-7721');
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice && open) {
      const eligible = Number(invoice.outstandingAmount ?? invoice.balance ?? invoice.total ?? 0);
      setClaimedAmount(eligible > 0 ? eligible : Number(invoice.total ?? 0));
      setError(null);
    }
  }, [invoice, open]);

  if (!invoice) return null;

  const eligibleBalance = Number(invoice.outstandingAmount ?? invoice.balance ?? invoice.total ?? 0);
  const maxAllowed = eligibleBalance > 0 ? eligibleBalance : Number(invoice.total ?? 0);
  const patientIdentifier = invoice.patientId || invoice.patient?.patientId || invoice.patient?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientIdentifier) {
      setError('This invoice is not linked to a valid patient.');
      return;
    }

    if (!tpaProvider.trim() || !policyNumber.trim() || claimedAmount <= 0) {
      setError('TPA provider, policy number, and claimed amount are required.');
      return;
    }

    if (claimedAmount > maxAllowed) {
      setError(`Claim amount (${formatINR(claimedAmount)}) cannot exceed eligible invoice balance (${formatINR(maxAllowed)}).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await billingService.createClaim({
        invoiceId: invoice.id,
        patientId: patientIdentifier,
        tpaProvider: tpaProvider.trim(),
        payerName: tpaProvider.trim(),
        policyNumber: policyNumber.trim(),
        approvalCode: approvalCode.trim() || undefined,
        preAuthCode: approvalCode.trim() || undefined,
        claimedAmount: Number(claimedAmount),
        claimAmount: Number(claimedAmount),
        notes: notes.trim() || undefined,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Submit TPA / Insurance Claim</DialogTitle>
              <p className="text-2xs text-slate-500">
                Invoice <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span> • Patient <span className="font-mono text-indigo-700">{patientIdentifier || '—'}</span>
                {invoice.patient ? ` (${invoice.patient.firstName} ${invoice.patient.lastName})` : ''}
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

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">TPA / Insurance Provider *</label>
            <Input
              placeholder="e.g. Star Health, Max Bupa, Medicare"
              value={tpaProvider}
              onChange={(e) => setTpaProvider(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Policy / Card Number *</label>
              <Input
                placeholder="e.g. POL-8829-01"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="font-mono uppercase"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Pre-Authorization Code</label>
              <Input
                placeholder="e.g. AUTH-55102"
                value={approvalCode}
                onChange={(e) => setApprovalCode(e.target.value)}
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">Claim Amount (₹) *</label>
              <span className="text-3xs text-slate-500 font-mono">Max eligible: {formatINR(maxAllowed)}</span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAllowed}
              value={claimedAmount}
              onChange={(e) => setClaimedAmount(parseFloat(e.target.value) || 0)}
              className="font-mono font-bold text-sm"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Claim Notes / Remarks</label>
            <Input
              placeholder="e.g. Cashless approval requested"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            disabled={loading || claimedAmount <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            {loading ? 'Submitting...' : 'Submit Claim'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


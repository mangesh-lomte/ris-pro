import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { billingService } from '../../services/billingService';
import { Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AttachClinicalChargesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderAccession?: string;
  onSuccess: () => void;
}

export function AttachClinicalChargesModal({
  open,
  onOpenChange,
  orderAccession = '',
  onSuccess,
}: AttachClinicalChargesModalProps) {
  const [accession, setAccession] = useState(orderAccession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accession.trim()) {
      setError('Accession Number is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await billingService.attachClinicalCharges(accession.trim());

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to attach clinical charges');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Attach Contrast & Film Charges</DialogTitle>
              <p className="text-2xs text-slate-500">
                Itemize clinical consumable usage onto study invoice
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

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Clinical charges attached successfully to invoice!</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Accession Number or Order ID *</label>
            <Input
              placeholder="e.g. ACC-2026-DEMO01"
              value={accession}
              onChange={(e) => setAccession(e.target.value)}
              className="font-mono text-xs uppercase"
              required
            />
          </div>

          <div className="rounded border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
            Contrast and film charges are calculated from recorded contrast administrations and inventory film-print transactions. Rates come only from the active price master.
          </div>
        </DialogContent>

        <DialogFooter>
          <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={loading}
            className="bg-[#2563EB] hover:bg-blue-700 text-white gap-1.5"
          >
            {loading ? 'Attaching...' : 'Add Consumable Charges'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


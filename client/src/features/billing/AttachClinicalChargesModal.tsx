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
  const [contrastUsed, setContrastUsed] = useState(true);
  const [contrastVolumeMl, setContrastVolumeMl] = useState(100);
  const [contrastRate, setContrastRate] = useState(0.85);
  const [filmCount, setFilmCount] = useState(2);
  const [filmRate, setFilmRate] = useState(15.0);
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
      await billingService.attachClinicalCharges(accession.trim(), {
        contrastUsed,
        contrastVolumeMl: contrastUsed ? Number(contrastVolumeMl) : 0,
        contrastRate: contrastUsed ? Number(contrastRate) : 0,
        filmCount: Number(filmCount),
        filmRate: Number(filmRate),
      });

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

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">IV Contrast Consumable</span>
              <label className="flex items-center gap-2 text-2xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={contrastUsed}
                  onChange={(e) => setContrastUsed(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Contrast Administered
              </label>
            </div>

            {contrastUsed && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-3xs uppercase font-bold text-slate-400 block">Volume (mL)</span>
                  <Input
                    type="number"
                    min="1"
                    value={contrastVolumeMl}
                    onChange={(e) => setContrastVolumeMl(parseInt(e.target.value) || 0)}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-slate-400 block">Rate / mL (₹)</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={contrastRate}
                    onChange={(e) => setContrastRate(parseFloat(e.target.value) || 0)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <span className="font-semibold text-slate-800 block">Diagnostic Film Prints</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-3xs uppercase font-bold text-slate-400 block">Film Sheet Count</span>
                <Input
                  type="number"
                  min="0"
                  value={filmCount}
                  onChange={(e) => setFilmCount(parseInt(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-3xs uppercase font-bold text-slate-400 block">Rate / Film (₹)</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={filmRate}
                  onChange={(e) => setFilmRate(parseFloat(e.target.value) || 0)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            {loading ? 'Attaching...' : 'Add Consumable Charges'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


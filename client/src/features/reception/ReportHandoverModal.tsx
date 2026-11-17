import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { ReceptionReadyReport } from '../../types';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { Badge } from '../../components/ui/badge';
import { CheckCircle2, UserCheck, Loader2 } from 'lucide-react';

interface ReportHandoverModalProps {
  report: ReceptionReadyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReportHandoverModal({
  report,
  open,
  onOpenChange,
  onSuccess,
}: ReportHandoverModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('PATIENT');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize recipient name to patient name whenever modal opens
  React.useEffect(() => {
    if (report) {
      setRecipientName(report.patientName);
      setRecipientRole('PATIENT');
      setNotes('');
      setError(null);
    }
  }, [report, open]);

  if (!report) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      setError('Recipient name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await receptionDeliveryService.recordDeliveryAcknowledgment(report.orderId, {
        deliveryMethod: 'RECEPTION_HANDOVER',
        recipientName: recipientName.trim(),
        recipientRole,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record delivery acknowledgment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#2563EB]" />
            <span>Record Front-Desk Report Handover</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Acknowledge physical report handover to patient or authorized representative.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Study Demographics Card */}
          <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground text-sm">{report.patientName}</span>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                FINAL REPORT v{report.reportVersion}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <IdentifierPill type="patient" value={report.patientId} />
              <IdentifierPill type="accession" value={report.accessionNumber} />
            </div>
            <div className="text-[11px] text-muted-foreground pt-0.5">
              <span>{report.modality} • {report.examinationName}</span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Recipient Full Name *</label>
            <input
              type="text"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              className="w-full text-xs rounded border bg-background p-2 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Recipient Relationship / Role</label>
            <select
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              className="w-full text-xs rounded border bg-background p-2"
            >
              <option value="PATIENT">Patient (Self)</option>
              <option value="FAMILY_MEMBER">Family Member / Relative</option>
              <option value="LEGAL_GUARDIAN">Legal Guardian / Caregiver</option>
              <option value="COURIER">Authorized Medical Courier</option>
              <option value="CLINICIAN_DESK">Referring Clinician Representative</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Handover Notes / ID Verification</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Identity verified via government ID; signed physical log."
              className="w-full text-xs rounded border bg-background p-2 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Handover & Acknowledge
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


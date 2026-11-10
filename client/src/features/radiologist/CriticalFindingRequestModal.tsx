import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../../services/radiologistService';
import { ClinicianItem } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import {
  AlertTriangle,
  AlertCircle,
  Loader2,
  Send,
  UserCheck,
} from 'lucide-react';

interface CriticalFindingRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  patientName: string;
  patientId: string;
  accessionNumber: string;
  modality: string;
  procedureName: string;
  onSuccess?: () => void;
}

export function CriticalFindingRequestModal({
  isOpen,
  onOpenChange,
  orderId,
  patientName,
  patientId,
  accessionNumber,
  modality,
  procedureName,
  onSuccess,
}: CriticalFindingRequestModalProps) {
  const queryClient = useQueryClient();
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [findingText, setFindingText] = useState<string>('');
  const [severity, setSeverity] = useState<string>('CRITICAL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch active eligible clinicians
  const { data: clinicians, isLoading: isCliniciansLoading } = useQuery({
    queryKey: ['activeClinicians'],
    queryFn: () => radiologistService.getActiveClinicians(),
    enabled: isOpen,
  });

  // Mutation to create critical alert
  const alertMutation = useMutation({
    mutationFn: () =>
      radiologistService.createCriticalFinding({
        imagingOrderId: orderId,
        recipientId: selectedRecipientId,
        findingText: findingText.trim(),
        severity,
      }),
    onSuccess: () => {
      setErrorMessage(null);
      setFindingText('');
      setSelectedRecipientId('');
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      queryClient.invalidateQueries({ queryKey: ['orderCriticalFinding', orderId] });
      queryClient.invalidateQueries({ queryKey: ['criticalFindingQueue'] });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to create critical finding alert.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientId) {
      setErrorMessage('Please select a responsible clinician.');
      return;
    }
    if (!findingText.trim()) {
      setErrorMessage('Please enter the critical finding text.');
      return;
    }
    alertMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Create Critical Finding Alert
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Urgent clinical notification with mandatory acknowledgment tracking.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Study Context Banner */}
        <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-lg space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {patientName}
            </span>
            <div className="flex items-center gap-1.5">
              <IdentifierPill type="patient" value={patientId} />
              <IdentifierPill type="accession" value={accessionNumber} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              [{modality}] {procedureName}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Responsible Clinician Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-red-600" />
              <span>Responsible Clinician <span className="text-red-500">*</span></span>
            </label>
            {isCliniciansLoading ? (
              <div className="flex items-center gap-2 p-2.5 border rounded bg-muted/40 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                <span>Loading eligible clinicians...</span>
              </div>
            ) : (
              <select
                aria-label="Responsible Clinician"
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-red-600"
                value={selectedRecipientId}
                onChange={(e) => {
                  setSelectedRecipientId(e.target.value);
                  setErrorMessage(null);
                }}
              >
                <option value="">Select Responsible Clinician...</option>
                {clinicians?.map((c: ClinicianItem) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Select the referring or attending physician responsible for patient follow-up.
            </p>
          </div>

          {/* Finding Text */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 dark:text-slate-200 flex items-center justify-between">
              <span>Critical Finding Description <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {findingText.length}/5000
              </span>
            </label>
            <textarea
              aria-label="Critical Finding Description"
              rows={4}
              placeholder="Describe urgent or critical findings requiring immediate clinician acknowledgment..."
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-red-600 resize-none font-sans"
              value={findingText}
              onChange={(e) => {
                setFindingText(e.target.value);
                setErrorMessage(null);
              }}
              maxLength={5000}
            />
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 dark:text-slate-200">
              Urgency / Severity Level
            </label>
            <select
              aria-label="Urgency Severity Level"
              className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-red-600"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="CRITICAL">CRITICAL (Immediate Action Required)</option>
              <option value="URGENT">URGENT (Action Required within 2-4 Hours)</option>
              <option value="SIGNIFICANT">SIGNIFICANT (Non-emergent notification)</option>
            </select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={alertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
              disabled={alertMutation.isPending || !selectedRecipientId || !findingText.trim()}
            >
              {alertMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending Alert...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Critical Alert</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../../services/radiologistService';
import { useAuth } from '../../hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';

interface CriticalFindingDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  findingId?: string | null;
  orderId?: string | null;
}

export function CriticalFindingDetailModal({
  isOpen,
  onOpenChange,
  findingId,
  orderId,
}: CriticalFindingDetailModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Query either by findingId directly, or by orderId
  const { data: finding, isLoading, isError } = useQuery({
    queryKey: ['criticalFindingDetail', findingId, orderId],
    queryFn: async () => {
      if (findingId) {
        return await radiologistService.getCriticalFindingById(findingId);
      }
      if (orderId) {
        return await radiologistService.getOrderCriticalFinding(orderId);
      }
      return null;
    },
    enabled: isOpen && (!!findingId || !!orderId),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      radiologistService.acknowledgeCriticalFinding(id, acknowledgmentNotes.trim() || undefined),
    onSuccess: () => {
      setErrorMessage(null);
      setAcknowledgmentNotes('');
      queryClient.invalidateQueries({ queryKey: ['criticalFindingDetail'] });
      queryClient.invalidateQueries({ queryKey: ['orderCriticalFinding'] });
      queryClient.invalidateQueries({ queryKey: ['criticalFindingQueue'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to acknowledge critical finding.');
    },
  });

  const isRecipient = user?.id === finding?.recipient.id;
  const isAdmin = user?.role === 'ADMIN';
  const canAcknowledge = (isRecipient || isAdmin) && finding?.status === 'PENDING';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Critical Finding Record
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Documented urgent communication & acknowledgment audit.
                </DialogDescription>
              </div>
            </div>
            {finding && (
              <Badge
                className={`text-[10px] font-semibold px-2 py-0.5 ${
                  finding.status === 'ACKNOWLEDGED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white animate-pulse'
                }`}
              >
                {finding.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'PENDING ACKNOWLEDGMENT'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-red-600 mb-2" />
            <span>Loading critical finding details...</span>
          </div>
        ) : isError || !finding ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <AlertCircle className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
            <span>No active critical finding record found.</span>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            {/* Patient & Accession Context */}
            {finding.order && (
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {finding.order.patientName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <IdentifierPill type="patient" value={finding.order.patientId} />
                    <IdentifierPill type="accession" value={finding.order.accessionNumber} />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  [{finding.order.modality}] {finding.order.examinationName}
                </div>
              </div>
            )}

            {/* Finding Text Box */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Critical Finding Description
              </span>
              <div className="p-3 bg-red-50/40 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-lg text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                {finding.findingText}
              </div>
            </div>

            {/* Sender & Recipient Details */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Reporting Radiologist
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {finding.createdBy.name}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {finding.createdBy.email}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Sent {new Date(finding.sentAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Responsible Clinician (Recipient)
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {finding.recipient.name}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {finding.recipient.email}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Severity: <span className="font-semibold text-red-600">{finding.severity}</span>
                </span>
              </div>
            </div>

            {/* Acknowledgment Status Section */}
            {finding.status === 'ACKNOWLEDGED' ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Acknowledged by {finding.acknowledgedBy?.name || finding.recipient.name}</span>
                </div>
                {finding.acknowledgedAt && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-5">
                    Timestamp: {new Date(finding.acknowledgedAt).toLocaleString()}
                  </p>
                )}
                {finding.acknowledgmentNotes && (
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 pl-5 italic mt-1">
                    "{finding.acknowledgmentNotes}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Status: PENDING ACKNOWLEDGMENT</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Awaiting formal acknowledgment from {finding.recipient.name}.
                </p>

                {canAcknowledge && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-2">
                    <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                      Clinician Acknowledgment Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter clinical action taken or acknowledgment notes..."
                      className="w-full rounded border border-amber-200 bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                      value={acknowledgmentNotes}
                      onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5"
                      onClick={() => acknowledgeMutation.mutate(finding.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      {acknowledgeMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Recording Acknowledgment...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Acknowledge</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

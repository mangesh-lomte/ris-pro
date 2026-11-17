import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  radiologistService,
  CreateReportAmendmentPayload,
} from '../../services/radiologistService';
import {
  AlertTriangle,
  PlusCircle,
  Clock,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface ReportAmendmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  patientId?: string;
  accessionNumber?: string;
  currentVersion: number;
  initialType?: 'CORRECTION' | 'ADDENDUM';
  onSuccess?: () => void;
}

export const ReportAmendmentModal: React.FC<ReportAmendmentModalProps> = ({
  open,
  onOpenChange,
  orderId,
  patientId,
  accessionNumber,
  currentVersion,
  initialType = 'CORRECTION',
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [amendmentType, setAmendmentType] = useState<'CORRECTION' | 'ADDENDUM'>(initialType);
  const [reason, setReason] = useState('');
  const [content, setContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmendmentType(initialType);
      setReason('');
      setContent('');
      setErrorMsg(null);
    }
  }, [open, initialType]);

  const nextVersion = (currentVersion || 1) + 1;

  const mutation = useMutation({
    mutationFn: (payload: CreateReportAmendmentPayload) =>
      radiologistService.createReportAmendment(orderId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportWorkspace', orderId] });
      queryClient.invalidateQueries({ queryKey: ['reportVersionHistory', orderId] });
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      if (onSuccess) {
        onSuccess();
      }
      onOpenChange(false);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to submit amendment. Please verify inputs.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please specify an amendment reason.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Please enter the amendment content.');
      return;
    }

    setErrorMsg(null);
    mutation.mutate({
      amendmentType,
      reason: reason.trim(),
      content: content.trim(),
      targetVersion: currentVersion || 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh] min-w-0">
        <DialogHeader onClose={() => onOpenChange(false)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 pr-8">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`p-2 rounded-full shrink-0 ${
                  amendmentType === 'CORRECTION'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    : 'bg-indigo-100 text-blue-700 dark:bg-indigo-950 dark:text-indigo-400'
                }`}
              >
                {amendmentType === 'CORRECTION' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <PlusCircle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold flex flex-wrap items-center gap-2 break-words">
                  <span>
                    {amendmentType === 'CORRECTION'
                      ? 'CREATE REPORT CORRECTION'
                      : 'CREATE REPORT ADDENDUM'}
                  </span>
                  <Badge variant="outline" className="text-xs font-mono shrink-0">
                    v{currentVersion} → v{nextVersion}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 break-words [overflow-wrap:anywhere]">
                  {amendmentType === 'CORRECTION'
                    ? 'Correct an error in an existing finalized report without destroying original findings.'
                    : 'Append supplemental findings or clinical clarifications to an existing finalized report.'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <IdentifierPill
                type="patient"
                value={patientId || 'UNKNOWN'}
              />
              <IdentifierPill
                type="accession"
                value={accessionNumber || 'UNKNOWN'}
              />
            </div>
          </div>
        </DialogHeader>

        <DialogContent className="p-5 space-y-4 overflow-y-auto overflow-x-hidden flex-1 min-w-0 max-h-none">
          {errorMsg && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="break-words [overflow-wrap:anywhere]">{errorMsg}</span>
            </div>
          )}

          {/* Amendment Type Selector */}
          <div className="min-w-0">
            <label className="text-xs font-semibold block mb-1.5 text-foreground">
              Amendment Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <button
                type="button"
                className={`p-3 text-left border rounded-lg transition-all flex items-start gap-2.5 min-w-0 ${
                  amendmentType === 'CORRECTION'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 ring-1 ring-amber-400'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setAmendmentType('CORRECTION')}
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    amendmentType === 'CORRECTION' ? 'text-amber-600' : 'text-muted-foreground'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">Correction</div>
                  <div className="text-[11px] text-muted-foreground break-words [overflow-wrap:anywhere]">
                    Fix an error, typo, or inaccurate measurement in findings.
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`p-3 text-left border rounded-lg transition-all flex items-start gap-2.5 min-w-0 ${
                  amendmentType === 'ADDENDUM'
                    ? 'border-indigo-500 bg-blue-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-400'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setAmendmentType('ADDENDUM')}
              >
                <PlusCircle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    amendmentType === 'ADDENDUM' ? 'text-[#2563EB]' : 'text-muted-foreground'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground">Addendum</div>
                  <div className="text-[11px] text-muted-foreground break-words [overflow-wrap:anywhere]">
                    Append additional clinical findings or later clarifications.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Reason Input */}
          <div className="min-w-0">
            <label className="text-xs font-semibold block mb-1 text-foreground">
              Reason / Clinical Context <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-0 box-border break-words"
              placeholder={
                amendmentType === 'CORRECTION'
                  ? 'e.g. Corrected measurement description; slice coordinate typo resolved'
                  : 'e.g. Additional clinical clarification following multidisciplinary review'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Content Input */}
          <div className="min-w-0">
            <label className="text-xs font-semibold block mb-1 text-foreground">
              {amendmentType === 'CORRECTION' ? 'Corrected Report Content' : 'Addendum Content'}{' '}
              <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border rounded-md text-xs font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-0 box-border resize-y break-words [overflow-wrap:anywhere]"
              placeholder={
                amendmentType === 'CORRECTION'
                  ? 'Enter corrected findings / description...'
                  : 'Enter supplemental addendum findings / observations to append...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Live Preview Card */}
          {(reason || content) && (
            <div className="border border-border/80 rounded-lg p-3 bg-muted/30 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5 min-w-0">
                <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">Amendment Preview (Will be logged as Version {nextVersion})</span>
              </div>
              <div className="text-xs font-mono space-y-1 bg-background p-2.5 rounded border border-border/40 min-w-0 overflow-hidden">
                <div className="text-[11px] text-muted-foreground font-sans break-words [overflow-wrap:anywhere]">
                  <strong>Type:</strong> {amendmentType} | <strong>Reason:</strong> {reason || '(None)'}
                </div>
                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-foreground/90 pt-1 border-t border-border/30 mt-1 max-h-48 overflow-y-auto">
                  {content || '(No content entered)'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>

        <DialogFooter className="p-4 border-t flex flex-wrap items-center justify-end gap-2 bg-[#f8faf9] shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className={
              amendmentType === 'CORRECTION'
                ? 'bg-amber-600 hover:bg-amber-700 text-white shrink-0'
                : 'bg-[#2563EB] hover:bg-blue-700 text-white shrink-0'
            }
            disabled={mutation.isPending || !reason.trim() || !content.trim()}
          >
            {mutation.isPending ? (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin mr-1 shrink-0" />
                Submitting Amendment...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                Submit {amendmentType === 'CORRECTION' ? 'Correction' : 'Addendum'} (v{nextVersion})
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
};

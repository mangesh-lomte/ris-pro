import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-full ${
                  amendmentType === 'CORRECTION'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                }`}
              >
                {amendmentType === 'CORRECTION' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <PlusCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  {amendmentType === 'CORRECTION'
                    ? 'CREATE REPORT CORRECTION'
                    : 'CREATE REPORT ADDENDUM'}
                  <Badge variant="outline" className="text-xs font-mono">
                    v{currentVersion} → v{nextVersion}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {amendmentType === 'CORRECTION'
                    ? 'Correct an error in an existing finalized report without destroying original findings.'
                    : 'Append supplemental findings or clinical clarifications to an existing finalized report.'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amendment Type Selector */}
          <div>
            <label className="text-xs font-semibold block mb-1.5 text-foreground">
              Amendment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`p-3 text-left border rounded-lg transition-all flex items-start gap-2.5 ${
                  amendmentType === 'CORRECTION'
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 ring-1 ring-amber-400'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setAmendmentType('CORRECTION')}
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 ${
                    amendmentType === 'CORRECTION' ? 'text-amber-600' : 'text-muted-foreground'
                  }`}
                />
                <div>
                  <div className="font-semibold text-xs text-foreground">Correction</div>
                  <div className="text-[11px] text-muted-foreground">
                    Fix an error, typo, or inaccurate measurement in findings.
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`p-3 text-left border rounded-lg transition-all flex items-start gap-2.5 ${
                  amendmentType === 'ADDENDUM'
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-400'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setAmendmentType('ADDENDUM')}
              >
                <PlusCircle
                  className={`h-4 w-4 mt-0.5 ${
                    amendmentType === 'ADDENDUM' ? 'text-indigo-600' : 'text-muted-foreground'
                  }`}
                />
                <div>
                  <div className="font-semibold text-xs text-foreground">Addendum</div>
                  <div className="text-[11px] text-muted-foreground">
                    Append additional clinical findings or later clarifications.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-xs font-semibold block mb-1 text-foreground">
              Reason / Clinical Context <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
          <div>
            <label className="text-xs font-semibold block mb-1 text-foreground">
              {amendmentType === 'CORRECTION' ? 'Corrected Report Content' : 'Addendum Content'}{' '}
              <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border rounded-md text-xs font-mono bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
            <div className="border border-border/80 rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>Amendment Preview (Will be logged as Version {nextVersion})</span>
              </div>
              <div className="text-xs font-mono space-y-1 bg-background p-2.5 rounded border border-border/40">
                <div className="text-[11px] text-muted-foreground font-sans">
                  <strong>Type:</strong> {amendmentType} | <strong>Reason:</strong> {reason || '(None)'}
                </div>
                <div className="whitespace-pre-wrap text-foreground/90 pt-1 border-t border-border/30 mt-1">
                  {content || '(No content entered)'}
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-3 flex items-center justify-end gap-2">
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
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }
              disabled={mutation.isPending || !reason.trim() || !content.trim()}
            >
              {mutation.isPending ? (
                <>
                  <Clock className="h-3.5 w-3.5 animate-spin mr-1" />
                  Submitting Amendment...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Submit {amendmentType === 'CORRECTION' ? 'Correction' : 'Addendum'} (v{nextVersion})
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

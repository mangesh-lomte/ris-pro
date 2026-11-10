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
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import {
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  UserCheck,
} from 'lucide-react';

interface PeerReviewWorkspaceModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  peerReviewId: string | null;
  onSuccess?: () => void;
}

export function PeerReviewWorkspaceModal({
  isOpen,
  onOpenChange,
  peerReviewId,
  onSuccess,
}: PeerReviewWorkspaceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState<string>('');
  const [decision, setDecision] = useState<string>('CONCUR');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch full context for this peer review request
  const { data: context, isLoading, isError } = useQuery({
    queryKey: ['peerReviewContext', peerReviewId],
    queryFn: () => radiologistService.getPeerReviewContext(peerReviewId!),
    enabled: isOpen && !!peerReviewId,
  });

  // Launch PACS Viewer
  const openViewerMutation = useMutation({
    mutationFn: () => radiologistService.getViewerLaunch(context!.order.id),
    onSuccess: (data) => {
      window.open(data.viewerUrl, 'manrad-pacs-viewer');
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Unable to open PACS viewer.');
    },
  });

  // Claim Request Mutation
  const claimMutation = useMutation({
    mutationFn: () => radiologistService.claimPeerReview(peerReviewId!),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['peerReviewContext', peerReviewId] });
      queryClient.invalidateQueries({ queryKey: ['peerReviewQueue'] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to claim peer review.');
    },
  });

  // Submit Second Opinion Mutation
  const submitMutation = useMutation({
    mutationFn: () =>
      radiologistService.submitPeerReview(peerReviewId!, {
        reviewComment: comment.trim(),
        decision,
      }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['peerReviewContext', peerReviewId] });
      queryClient.invalidateQueries({ queryKey: ['peerReviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to submit second opinion.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setActionError('Second opinion comment is required.');
      return;
    }
    submitMutation.mutate();
  };

  const isAssignedReviewer = user?.id === context?.reviewer.id;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <DialogTitle className="text-base font-bold tracking-tight">
                PEER REVIEW / SECOND OPINION WORKSPACE
              </DialogTitle>
            </div>
            {context && (
              <Badge
                className={`text-[10px] font-semibold ${
                  context.status === 'COMPLETED'
                    ? 'bg-emerald-600 text-white'
                    : context.status === 'IN_REVIEW'
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {context.status}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Independent clinical evaluation requested by peer radiologist.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-xs">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600 mb-2" />
              <span>Loading review context...</span>
            </div>
          ) : isError || !context ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs">
              Unable to load peer review study context.
            </div>
          ) : (
            <>
              {/* Study Info Card */}
              <div className="p-3 bg-muted/30 border rounded-lg space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{context.patient.name}</span>
                    <PriorityBadge priority={context.order.priority} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IdentifierPill type="patient" value={context.patient.patientId} />
                    <IdentifierPill type="accession" value={context.order.accessionNumber} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                    {context.order.modality}
                  </Badge>
                  <span>{context.order.procedureName}</span>
                  <span>• {context.order.bodyPart}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Requesting Radiologist</span>
                    <span className="font-medium text-foreground">{context.requester.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Requested At</span>
                    <span className="text-muted-foreground">{new Date(context.requestedAt).toLocaleString()}</span>
                  </div>
                </div>

                {context.reason && (
                  <div className="p-2 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded text-xs text-indigo-950 dark:text-indigo-200 italic mt-2">
                    <strong className="not-italic font-semibold text-indigo-800 dark:text-indigo-300 block text-[10px] uppercase">
                      Clinical Consultation Reason:
                    </strong>
                    &ldquo;{context.reason}&rdquo;
                  </div>
                )}
              </div>

              {/* Action Error */}
              {actionError && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Viewer Launcher Bar */}
              <div className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm">
                <div className="text-xs">
                  <span className="font-semibold block text-foreground">Diagnostic DICOM Images</span>
                  <span className="text-[11px] text-muted-foreground">
                    Launch validated study in OHIF PACS viewer
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1.5 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                  onClick={() => openViewerMutation.mutate()}
                  disabled={openViewerMutation.isPending}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {openViewerMutation.isPending ? 'Launching...' : 'Open Images'}
                </Button>
              </div>

              {/* Primary Draft Summary Preview (Read-Only) */}
              {context.primaryDraftSummary && (
                <div className="space-y-1.5 border rounded-lg p-3 bg-muted/10 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      Primary Report Draft (Read-Only Reference)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      v{context.primaryDraftSummary.version}
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-2 bg-background p-2.5 rounded border text-[11px]">
                    {Object.entries(context.primaryDraftSummary.content)
                      .filter(([sec, val]) => !sec.startsWith('_') && typeof val === 'string')
                      .map(([sec, txt]) => (
                      <div key={sec} className="space-y-0.5">
                        <span className="font-semibold text-foreground/80 text-[10px] uppercase">{sec}:</span>
                        <div className="text-muted-foreground whitespace-pre-wrap pl-1">
                          {txt || <span className="italic text-muted-foreground/60">Not entered</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer Action Area */}
              {context.status === 'PENDING' ? (
                <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center space-y-3">
                  <p className="text-xs text-muted-foreground">
                    This peer review request is currently pending. Claim the case to begin your evaluation.
                  </p>
                  {isAssignedReviewer && (
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 mx-auto"
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {claimMutation.isPending ? 'Claiming...' : 'Claim & Begin Review'}
                    </Button>
                  )}
                </div>
              ) : context.status === 'IN_REVIEW' ? (
                <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                      Second Opinion Decision / Recommendation
                    </label>
                    <select
                      className="text-xs border rounded h-8 px-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    >
                      <option value="CONCUR">Concur with Primary Findings</option>
                      <option value="DISCREPANT">Discrepancy / Alternative Finding</option>
                      <option value="SECOND_OPINION">Consultative Second Opinion</option>
                      <option value="ADDITIONAL_VIEWS_RECOMMENDED">Additional Views Recommended</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Reviewer Findings & Comments <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      rows={4}
                      className="w-full text-xs border rounded-md p-2.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                      placeholder="Enter concise second opinion findings, differential diagnostic impressions, or specific recommendations..."
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        setActionError(null);
                      }}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Submitting this second opinion will complete the peer review record. It will NOT overwrite or finalize the primary radiologist&apos;s draft.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5"
                      disabled={!comment.trim() || submitMutation.isPending}
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Submit Second Opinion
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Completed State */
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Completed Second Opinion Record
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-300 text-emerald-700 bg-emerald-50">
                      {context.decision}
                    </Badge>
                  </div>
                  <div className="p-3 bg-muted/20 border rounded-lg text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {context.reviewComment}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>Completed by {context.reviewer.name}</span>
                    <span>• {context.completedAt ? new Date(context.completedAt).toLocaleString() : ''}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-3 border-t bg-muted/10 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

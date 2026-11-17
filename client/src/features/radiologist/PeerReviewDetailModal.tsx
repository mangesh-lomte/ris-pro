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
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  FileText,
} from 'lucide-react';

interface PeerReviewDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

export function PeerReviewDetailModal({
  isOpen,
  onOpenChange,
  orderId,
}: PeerReviewDetailModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: review, isLoading, isError } = useQuery({
    queryKey: ['orderPeerReview', orderId],
    queryFn: () => radiologistService.getOrderPeerReview(orderId),
    enabled: isOpen && !!orderId,
  });

  const cancelMutation = useMutation({
    mutationFn: (peerReviewId: string) => radiologistService.cancelPeerReview(peerReviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderPeerReview', orderId] });
      queryClient.invalidateQueries({ queryKey: ['peerReviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
    },
  });

  const isRequester = user?.id === review?.requester.id;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#2563EB]" />
              <DialogTitle className="text-base font-bold">PEER REVIEW / SECOND OPINION</DialogTitle>
            </div>
            {review && (
              <Badge
                className={`text-[10px] font-semibold ${
                  review.status === 'COMPLETED'
                    ? 'bg-emerald-600 text-white'
                    : review.status === 'IN_REVIEW'
                    ? 'bg-blue-600 text-white'
                    : review.status === 'PENDING'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-600 text-white'
                }`}
              >
                {review.status}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Secondary clinical consultation record.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mb-2" />
            <span>Loading peer review record...</span>
          </div>
        ) : isError || !review ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <AlertCircle className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
            <span>No active peer review record found for this study.</span>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            {/* Parties & Dates */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Requested By
                </span>
                <span className="font-semibold text-foreground">{review.requester.name}</span>
                <span className="text-muted-foreground block text-[10px]">
                  {new Date(review.requestedAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Reviewer
                </span>
                <span className="font-semibold text-foreground">{review.reviewer.name}</span>
                {review.completedAt && (
                  <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Completed {new Date(review.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {/* Requested Clinical Context / Reason */}
            {review.reason && (
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wider block">
                  Clinical Context / Reason
                </span>
                <div className="p-2.5 bg-muted/20 border rounded text-xs leading-relaxed italic text-foreground/90">
                  &ldquo;{review.reason}&rdquo;
                </div>
              </div>
            )}

            {/* Completed Second Opinion Response */}
            {review.status === 'COMPLETED' ? (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200">
                    <FileText className="h-3.5 w-3.5 text-[#2563EB]" />
                    Second Opinion Response
                  </span>
                  {review.decision && (
                    <Badge variant="outline" className="text-[10px] font-bold border-indigo-300 text-blue-700 bg-blue-50 dark:bg-indigo-950">
                      {review.decision}
                    </Badge>
                  )}
                </div>
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {review.reviewComment || 'No comment recorded.'}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Note: Peer review comments provide secondary clinical context and do not overwrite or replace the primary diagnostic report.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  {review.status === 'IN_REVIEW'
                    ? 'Reviewer is currently reviewing this case.'
                    : 'Awaiting reviewer pickup.'}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex items-center justify-between">
          <div>
            {review && review.status === 'PENDING' && isRequester && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs flex items-center gap-1"
                onClick={() => cancelMutation.mutate(review.id)}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel Request
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

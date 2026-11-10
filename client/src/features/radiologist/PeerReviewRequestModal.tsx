import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../../services/radiologistService';
import { useAuth } from '../../hooks/useAuth';
import { RadiologistUserOption } from '../../types';
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
  Users,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface PeerReviewRequestModalProps {
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

export function PeerReviewRequestModal({
  isOpen,
  onOpenChange,
  orderId,
  patientName,
  patientId,
  accessionNumber,
  modality,
  procedureName,
  onSuccess,
}: PeerReviewRequestModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch active radiologists for reviewer selection
  const { data: radiologists, isLoading: isRadsLoading } = useQuery({
    queryKey: ['activeRadiologists'],
    queryFn: () => radiologistService.getActiveRadiologists(),
    enabled: isOpen,
  });

  // Filter out current radiologist (cannot review self)
  const eligibleReviewers = (radiologists || []).filter((r: RadiologistUserOption) => r.id !== user?.id);

  // Mutation to create request
  const requestMutation = useMutation({
    mutationFn: () =>
      radiologistService.requestPeerReview({
        imagingOrderId: orderId,
        reviewerId: selectedReviewerId,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      queryClient.invalidateQueries({ queryKey: ['orderPeerReview', orderId] });
      queryClient.invalidateQueries({ queryKey: ['peerReviewQueue'] });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to submit peer review request.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewerId) {
      setErrorMessage('Please select an eligible peer reviewer.');
      return;
    }
    requestMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-lg font-bold">Request Peer Review / Second Opinion</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Route this difficult or equivocal case to a colleague for additional clinical review.
          </DialogDescription>
        </DialogHeader>

        {/* Study Context Summary */}
        <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground text-sm">{patientName}</span>
            <div className="flex items-center gap-1.5">
              <IdentifierPill type="patient" value={patientId} />
              <IdentifierPill type="accession" value={accessionNumber} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
              {modality}
            </Badge>
            <span>{procedureName}</span>
          </div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t">
            <span>Current Radiologist: </span>
            <strong className="text-foreground">{user?.firstName ? `Dr. ${user.firstName} ${user.lastName}` : 'Dr. Elena Rostova'}</strong>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Reviewer Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Assign Peer Reviewer <span className="text-destructive">*</span>
            </label>
            {isRadsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading available radiologists...</span>
              </div>
            ) : eligibleReviewers.length === 0 ? (
              <div className="text-xs text-amber-600 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded">
                No other active radiologists are currently available in the system.
              </div>
            ) : (
              <select
                className="w-full text-xs border rounded-md h-9 px-2.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={selectedReviewerId}
                onChange={(e) => {
                  setSelectedReviewerId(e.target.value);
                  setErrorMessage(null);
                }}
                required
              >
                <option value="">-- Select Radiologist --</option>
                {eligibleReviewers.map((r: RadiologistUserOption) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Only active certified radiologists excluding yourself are eligible for selection.
            </p>
          </div>

          {/* Reason / Review Context */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Clinical Context / Question for Reviewer <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full text-xs border rounded-md p-2.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              placeholder="e.g. Equivocal RUL nodule vs summation artifact on slice #45. Requesting second opinion on recommendation for CT follow-up."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={requestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5"
              disabled={!selectedReviewerId || requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Route for Second Opinion
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

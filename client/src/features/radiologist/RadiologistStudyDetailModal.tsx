import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { radiologistService } from '../../services/radiologistService';
import { calculateAge, formatDate, formatDuration } from '../../utils/formatters';
import { formatSafeErrorMessage } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import {
  User,
  Clock,
  AlertCircle,
  Building,
  CheckCircle2,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  Syringe,
  RefreshCw,
  UserCheck,
  UserPlus,
  Layers,
  History,
  Activity,
  ExternalLink,
  FileText,
  Users,
} from 'lucide-react';
import { RadiologistReportModal } from './RadiologistReportModal';
import { PeerReviewRequestModal } from './PeerReviewRequestModal';
import { PeerReviewDetailModal } from './PeerReviewDetailModal';
import { CriticalFindingRequestModal } from './CriticalFindingRequestModal';
import { CriticalFindingDetailModal } from './CriticalFindingDetailModal';

interface RadiologistStudyDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function RadiologistStudyDetailModal({
  open,
  onOpenChange,
  orderId,
}: RadiologistStudyDetailModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedAdminRadiologist, setSelectedAdminRadiologist] = useState<string>('');
  const [reassignmentReason, setReassignmentReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: studyContext,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['radiologistStudyContext', orderId],
    queryFn: () => radiologistService.getStudyContext(orderId!),
    enabled: open && !!orderId,
  });

  const { data: radiologistsList } = useQuery({
    queryKey: ['activeRadiologists'],
    queryFn: () => radiologistService.getActiveRadiologists(),
    enabled: open && user?.role === 'ADMIN',
  });

  // Phase 4.6 — Peer Review / Second Opinion
  const [isPeerReviewRequestOpen, setIsPeerReviewRequestOpen] = useState(false);
  const [isPeerReviewDetailOpen, setIsPeerReviewDetailOpen] = useState(false);

  const { data: orderPeerReview } = useQuery({
    queryKey: ['orderPeerReview', orderId],
    queryFn: () => radiologistService.getOrderPeerReview(orderId!),
    enabled: open && !!orderId,
  });

  // Phase 4.7 — Critical Findings Alert
  const [isCriticalFindingRequestOpen, setIsCriticalFindingRequestOpen] = useState(false);
  const [isCriticalFindingDetailOpen, setIsCriticalFindingDetailOpen] = useState(false);

  const { data: orderCriticalFinding } = useQuery({
    queryKey: ['orderCriticalFinding', orderId],
    queryFn: () => radiologistService.getOrderCriticalFinding(orderId!),
    enabled: open && !!orderId,
  });

  const claimMutation = useMutation({
    mutationFn: () => radiologistService.claimStudy(orderId!),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistStudyContext', orderId] });
    },
    onError: (err: any) => {
      setActionError(formatSafeErrorMessage(err, 'Failed to claim study.'));
    },
  });

  const assignMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      radiologistService.assignStudy(orderId!, targetUserId, studyContext?.activeAssignment ? reassignmentReason : undefined),
    onSuccess: () => {
      setActionError(null);
      setSelectedAdminRadiologist('');
      setReassignmentReason('');
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistStudyContext', orderId] });
    },
    onError: (err: any) => {
      setActionError(formatSafeErrorMessage(err, 'Failed to assign study.'));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => radiologistService.releaseStudy(orderId!),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
      queryClient.invalidateQueries({ queryKey: ['radiologistStudyContext', orderId] });
    },
    onError: (err: any) => {
      setActionError(formatSafeErrorMessage(err, 'Failed to release assignment.'));
    },
  });

  const [viewerError, setViewerError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedPriorReportId, setSelectedPriorReportId] = useState<string | null>(null);
  const [launchingPriorId, setLaunchingPriorId] = useState<string | null>(null);

  const openImagesMutation = useMutation({
    mutationFn: () => radiologistService.getViewerLaunch(orderId!),
    onSuccess: (data) => {
      setViewerError(null);
      if (data?.viewerUrl) {
        window.open(data.viewerUrl, 'radaxis-pacs-viewer');
      }
    },
    onError: (err: any) => {
      const msg = formatSafeErrorMessage(
        err,
        'Image viewer is currently unavailable.'
      );
      setViewerError(msg);
    },
  });

  const compareImagesMutation = useMutation({
    mutationFn: (priorId: string) => {
      setLaunchingPriorId(priorId);
      return radiologistService.getViewerLaunch(orderId!, priorId);
    },
    onSuccess: (data) => {
      setComparisonError(null);
      setLaunchingPriorId(null);
      if (data?.viewerUrl) {
        window.open(data.viewerUrl, 'radaxis-pacs-viewer');
      }
    },
    onError: (err: any) => {
      setLaunchingPriorId(null);
      const msg = formatSafeErrorMessage(
        err,
        'Multi-study image viewer is currently unavailable.'
      );
      setComparisonError(msg);
    },
  });

  const { data: priorReportDetail, isLoading: isLoadingPriorReport } = useQuery({
    queryKey: ['radiologistPriorReport', orderId, selectedPriorReportId],
    queryFn: () => radiologistService.getPriorReport(orderId!, selectedPriorReportId!),
    enabled: !!orderId && !!selectedPriorReportId,
  });

  if (!open) return null;

  const isRadiologist = user?.role === 'RADIOLOGIST';
  const isAdmin = user?.role === 'ADMIN';

  const isPacsUnavailable = studyContext?.pacsIntegrationState.status === 'PACS_UNAVAILABLE';
  const hasStudyInstanceUid = Boolean(studyContext?.pacsIntegrationState.studyInstanceUid);
  const isLinkedOrMatched =
    studyContext?.pacsIntegrationState.status === 'MATCHED' ||
    studyContext?.pacsIntegrationState.status === 'COMPLETE';
  const canOpenImages =
    (isRadiologist || isAdmin) &&
    Boolean(studyContext) &&
    isLinkedOrMatched &&
    hasStudyInstanceUid &&
    !isPacsUnavailable;

  const activeAssignment = studyContext?.activeAssignment;
  const isAssignedToMe = activeAssignment?.radiologistUserId === user?.id;
  const isAssigned = !!activeAssignment;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="5xl">
      <DialogContent className="max-w-5xl w-full max-h-[88vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <Badge variant="default" className="bg-[#2563EB] text-white font-semibold text-xs tracking-wider shrink-0">
                CURRENT STUDY
              </Badge>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-[#152B42]">
                Radiologist Triage & Clinical Review
              </DialogTitle>
              {studyContext?.order.priority && (
                <PriorityBadge priority={studyContext.order.priority} />
              )}
            </div>
            {studyContext?.order.accessionNumber && (
              <div className="shrink-0">
                <IdentifierPill
                  type="accession"
                  value={studyContext.order.accessionNumber}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="font-semibold text-[#2563EB]">Diagnostic Scope:</span> Current study image viewing, prior study discovery & comparative review.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading clinical study details...
          </div>
        ) : error ? (
          <div className="py-8 px-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="font-semibold">Unable to load study context</p>
            <p className="text-sm mt-1">{formatSafeErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        ) : studyContext ? (
          <div className="space-y-6 py-2">
            {actionError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Assignment Error: </span>
                  {actionError}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/20"
                  onClick={() => setActionError(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* 1. Patient & Order Clinical Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Patient Demographics */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Patient Demographics
                  </span>
                  <IdentifierPill type="patient" value={studyContext.patient.patientId} />
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="font-semibold text-base">
                    {studyContext.patient.firstName} {studyContext.patient.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>
                      DOB: {formatDate(studyContext.patient.dateOfBirth)} (
                      {calculateAge(studyContext.patient.dateOfBirth)} yrs)
                    </span>
                    <span>•</span>
                    <span>Sex: {studyContext.patient.gender}</span>
                  </div>
                  {studyContext.patient.phone && (
                    <div className="text-xs text-muted-foreground">
                      Contact: {studyContext.patient.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Exam & Indication */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                    Examination & Indication
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {studyContext.order.modality}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="font-semibold text-foreground">
                    {studyContext.order.examinationName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Body Part: <span className="font-medium">{studyContext.order.bodyPart}</span>
                    {studyContext.order.contrastRequired && (
                      <span className="ml-2 text-amber-700 dark:text-amber-400 font-medium">
                        (Contrast Required)
                      </span>
                    )}
                  </div>
                  <div className="text-xs bg-muted/40 p-2 rounded border text-foreground/90">
                    <span className="font-semibold text-muted-foreground">Clinical Indication: </span>
                    {studyContext.order.clinicalIndication || 'None provided'}
                  </div>
                  {studyContext.order.referringDoctor && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Building className="h-3 w-3" />
                      Referring:{' '}
                      <span className="font-medium text-foreground">
                        {studyContext.order.referringDoctor.name}
                      </span>
                      {studyContext.order.referringDoctor.organization && (
                        <span>({studyContext.order.referringDoctor.organization})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. PACS Integration State & Triage Waiting Time */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  CURRENT STUDY PACS STATUS & IMAGE ACCESS
                </span>
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {studyContext.order.orderStatus === 'COMPLETED'
                    ? `Reported • TAT ${formatDuration(studyContext.order.waitingMinutes)}`
                    : `Eligible for ${studyContext.order.waitingMinutes} minutes (${formatDuration(studyContext.order.waitingMinutes)})`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  className={
                    studyContext.pacsIntegrationState.status === 'MATCHED'
                      ? 'bg-emerald-600 text-white'
                      : studyContext.pacsIntegrationState.status === 'COMPLETE'
                      ? 'bg-blue-600 text-white'
                      : studyContext.pacsIntegrationState.status === 'PACS_UNAVAILABLE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-600 text-white'
                  }
                >
                  {studyContext.pacsIntegrationState.label}
                </Badge>
                {studyContext.pacsIntegrationState.studyInstanceUid && (
                  <span className="text-xs font-mono text-muted-foreground break-all" title={studyContext.pacsIntegrationState.studyInstanceUid}>
                    <span className="font-semibold text-slate-700">UID:</span> {studyContext.pacsIntegrationState.studyInstanceUid}
                  </span>
                )}
                {studyContext.pacsIntegrationState.orthancStudyId && (
                  <span className="text-xs font-mono text-muted-foreground break-all" title={studyContext.pacsIntegrationState.orthancStudyId}>
                    <span className="font-semibold text-slate-700">Orthanc ID:</span> {studyContext.pacsIntegrationState.orthancStudyId}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Technologist Order Status: <StatusBadge status={studyContext.order.orderStatus} />
                </span>
              </div>
              {studyContext.pacsIntegrationState.status === 'PACS_UNAVAILABLE' && (
                <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-md border border-amber-500/20 text-xs mt-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    PACS Server Temporarily Unavailable
                  </div>
                  <div className="mt-1">
                    {studyContext.pacsIntegrationState.message ||
                      'Orthanc PACS is currently unreachable. RIS assignment and clinical records remain safe.'}
                  </div>
                </div>
              )}

              {/* PACS / Viewer Action Controls */}
              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  {isPacsUnavailable ? (
                    <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      PACS is currently unavailable.
                    </span>
                  ) : !hasStudyInstanceUid ? (
                    <span className="text-muted-foreground italic">
                      PACS study is not yet reconciled.
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      Reconciled DICOM study linked and ready for viewing.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canOpenImages && (
                    <Button
                      size="sm"
                      className="font-semibold flex items-center gap-1.5"
                      onClick={() => openImagesMutation.mutate()}
                      disabled={openImagesMutation.isPending}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {openImagesMutation.isPending ? 'Launching Viewer...' : 'Open Images'}
                    </Button>
                  )}

                  {/* Phase 4.6 — Peer Review Action Button */}
                  {orderPeerReview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`font-semibold flex items-center gap-1.5 ${
                        orderPeerReview.status === 'COMPLETED'
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-amber-300 text-amber-700 bg-amber-50/60 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                      onClick={() => setIsPeerReviewDetailOpen(true)}
                    >
                      <Users className="h-4 w-4" />
                      {orderPeerReview.status === 'COMPLETED'
                        ? 'Second Opinion Available'
                        : `Peer Review (${orderPeerReview.status})`}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-semibold flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-indigo-950/30"
                      onClick={() => setIsPeerReviewRequestOpen(true)}
                    >
                      <Users className="h-4 w-4 text-[#2563EB]" />
                      Request Peer Review
                    </Button>
                  )}

                  {/* Phase 4.7 — Critical Finding Action Button */}
                  {orderCriticalFinding ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`font-semibold flex items-center gap-1.5 ${
                        orderCriticalFinding.status === 'ACKNOWLEDGED'
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-red-300 text-red-700 bg-red-50/60 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 animate-pulse'
                      }`}
                      onClick={() => setIsCriticalFindingDetailOpen(true)}
                    >
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      {orderCriticalFinding.status === 'ACKNOWLEDGED'
                        ? 'Critical Finding (Acknowledged)'
                        : 'Critical Finding (Pending)'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-semibold flex items-center gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => setIsCriticalFindingRequestOpen(true)}
                    >
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Critical Finding
                    </Button>
                  )}
                </div>
              </div>

              {viewerError && (
                <div className="p-2.5 bg-destructive/10 text-destructive rounded border border-destructive/20 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{viewerError}</span>
                </div>
              )}
            </div>

            {/* 3. Acquisition Summary & Repeat History */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Acquisition Attempts & Quality Review
                </span>
                <span className="text-xs text-muted-foreground">
                  {studyContext.repeatHistory.length} attempt
                  {studyContext.repeatHistory.length !== 1 ? 's' : ''}
                </span>
              </div>

              {studyContext.acceptedAcquisition ? (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Authoritative Final Acquisition: Attempt #{studyContext.acceptedAcquisition.attemptNumber}
                    </span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                      QA ACCEPTED
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-2">
                    <div>
                      Acquisition:{' '}
                      <span className="font-medium text-foreground">
                        Attempt #{studyContext.acceptedAcquisition.attemptNumber}
                      </span>
                    </div>
                    <div>
                      QA Decided:{' '}
                      <span className="font-medium text-foreground">
                        {studyContext.acceptedAcquisition.qaReviewedAt
                          ? new Date(studyContext.acceptedAcquisition.qaReviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Recorded'}
                      </span>
                    </div>
                    {studyContext.acceptedAcquisition.qaNotes && (
                      <div className="col-span-2 italic">
                        QA Notes: &quot;{studyContext.acceptedAcquisition.qaNotes}&quot;
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                  No accepted acquisition resolved for this study.
                </div>
              )}

              {studyContext.repeatHistory.length > 1 && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-2">
                    <History className="h-3 w-3" />
                    Attempt Chronology
                  </span>
                  <div className="border rounded divide-y text-xs">
                    {studyContext.repeatHistory.map((att) => (
                      <div
                        key={att.scanLifecycleId}
                        className={`p-2 flex items-center justify-between ${
                          att.isAcceptedAcquisition ? 'bg-muted/30 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">Attempt #{att.attemptNumber}</span>
                          <span>•</span>
                          <span>Status: {att.state}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={att.qaStatus === 'ACCEPTED' ? 'default' : 'outline'}
                            className="text-[10px]"
                          >
                            {att.qaStatus || 'NOT EVALUATED'}
                          </Badge>
                          {att.qaReason && (
                            <span className="text-muted-foreground">Reason: {att.qaReason}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Contrast & Incident Summaries (if applicable) */}
            {(studyContext.contrastSummary.length > 0 || studyContext.incidentSummary.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyContext.contrastSummary.length > 0 && (
                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 border-b pb-2">
                      <Syringe className="h-3.5 w-3.5 text-primary" />
                      Contrast Administration History
                    </span>
                    <div className="space-y-2">
                      {studyContext.contrastSummary.map((c) => (
                        <div key={c.id} className="text-xs border p-2 rounded bg-muted/20">
                          <div className="font-semibold text-foreground">
                            {c.agentName} — {c.volume} {c.volumeUnit} ({c.route})
                          </div>
                          <div className="text-muted-foreground text-[11px] mt-0.5">
                            Administered at {new Date(c.administeredAt).toLocaleTimeString()}
                            {c.administeredBy && ` by ${c.administeredBy}`}
                          </div>
                          {c.notes && <div className="text-[11px] italic mt-1">&quot;{c.notes}&quot;</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {studyContext.incidentSummary.length > 0 && (
                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <span className="text-xs font-semibold tracking-wider text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5 border-b pb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Technologist Incident Documentation
                    </span>
                    <div className="space-y-2">
                      {studyContext.incidentSummary.map((inc) => (
                        <div key={inc.id} className="text-xs border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded">
                          <div className="font-semibold text-amber-900 dark:text-amber-300">
                            {inc.category}
                          </div>
                          <div className="text-foreground text-[11px] mt-0.5">{inc.description}</div>
                          <div className="text-muted-foreground text-[10px] mt-1">
                            Recorded at {new Date(inc.recordedAt).toLocaleTimeString()}
                            {inc.clinicianNotified && ' • Clinician Notified'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Prior Studies Discovery & Comparison */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    PRIOR STUDIES ({studyContext.priorStudyCount})
                  </span>
                  {studyContext.hasPriorStudies && (
                    <Badge variant="outline" className="text-xs text-primary font-medium">
                      Comparison Candidates Available
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Patient ID: {studyContext.patient.patientId}
                </span>
              </div>

              {comparisonError && (
                <div className="p-2.5 bg-destructive/10 text-destructive rounded border border-destructive/20 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{comparisonError}</span>
                </div>
              )}

              {studyContext.hasPriorStudies ? (
                <div className="border rounded divide-y text-xs">
                  {studyContext.priorStudies.map((ps) => {
                    const canCompareThisPrior =
                      canOpenImages &&
                      ps.isImageComparisonEligible &&
                      !isPacsUnavailable;

                    return (
                      <div key={ps.imagingOrderId} className="p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-semibold text-[10px] uppercase tracking-wide">
                              PRIOR STUDY
                            </Badge>
                            <IdentifierPill type="accession" value={ps.accessionNumber} />
                            <span className="font-semibold text-foreground">{ps.procedureName}</span>
                            <span className="text-muted-foreground">({ps.bodyPart})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {ps.modality}
                            </Badge>
                            <span className="text-muted-foreground text-[11px]">
                              {ps.studyDate || ps.date}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-muted/50">
                          <div className="flex items-center gap-2">
                            {ps.pacsStatus === 'LINKED' && ps.isImageComparisonEligible ? (
                              <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Images Available
                              </Badge>
                            ) : ps.pacsStatus === 'UNAVAILABLE' ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 text-[10px] flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> PACS Unavailable
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-muted-foreground text-[10px] flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-muted-foreground" /> Images Not Available for Verified Viewing
                              </Badge>
                            )}

                            {ps.hasPriorReport ? (
                              <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300 text-[10px] flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Prior Report Available
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                No Prior Report
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {ps.hasPriorReport && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs flex items-center gap-1"
                                onClick={() => setSelectedPriorReportId(ps.imagingOrderId)}
                              >
                                <FileText className="h-3.5 w-3.5 text-blue-600" />
                                View Prior Report
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant={canCompareThisPrior ? "default" : "outline"}
                              className={`h-7 text-xs flex items-center gap-1 font-semibold ${
                                !canCompareThisPrior ? 'text-muted-foreground opacity-60 cursor-not-allowed' : ''
                              }`}
                              disabled={!canCompareThisPrior || compareImagesMutation.isPending}
                              onClick={() => canCompareThisPrior && compareImagesMutation.mutate(ps.imagingOrderId)}
                              title={
                                !canCompareThisPrior
                                  ? 'Prior study images are not available for verified viewing.'
                                  : 'Compare current and prior examinations in multi-study viewer'
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {compareImagesMutation.isPending && launchingPriorId === ps.imagingOrderId
                                ? 'Launching...'
                                : 'Compare Images'}
                            </Button>
                          </div>
                        </div>

                        {ps.pacsMessage && !ps.isImageComparisonEligible && (
                          <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                            <span>{ps.pacsMessage}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-3 italic text-center bg-muted/20 rounded border border-dashed">
                  No prior studies available for this patient.
                </div>
              )}
            </div>

            {/* 6. Assignment Management & Actions */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  Radiologist Assignment & Control
                </span>
                <Badge
                  variant={isAssigned ? 'default' : 'outline'}
                  className={
                    isAssignedToMe
                      ? 'bg-emerald-600 text-white'
                      : isAssigned
                      ? 'bg-blue-600 text-white'
                      : 'text-muted-foreground'
                  }
                >
                  {isAssignedToMe
                    ? 'ASSIGNED TO YOU'
                    : isAssigned
                    ? `ASSIGNED: ${activeAssignment?.radiologistName}`
                    : 'UNASSIGNED'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {isAssigned ? (
                    <div>
                      Assigned to <span className="font-semibold text-foreground">{activeAssignment?.radiologistName}</span> on{' '}
                      {new Date(activeAssignment!.assignedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      {activeAssignment?.assignedBy && ` by ${activeAssignment.assignedBy}`}
                    </div>
                  ) : (
                    <div>This study is unassigned. Any active radiologist may claim it.</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Claim Button: Radiologist only when unassigned */}
                  {isRadiologist && !isAssigned && (
                    <Button
                      size="sm"
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      {claimMutation.isPending ? 'Claiming...' : 'Claim Study'}
                    </Button>
                  )}

                  {/* Release Button: Radiologist if assigned to them, or Admin anytime */}
                  {(isAssignedToMe || (isAdmin && isAssigned)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => releaseMutation.mutate()}
                      disabled={releaseMutation.isPending}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      {releaseMutation.isPending ? 'Releasing...' : 'Release Assignment'}
                    </Button>
                  )}

                  {/* Admin Assignment Dropdown */}
                  {isAdmin && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="text-xs font-semibold text-muted-foreground">
                        {isAssigned ? 'Reassign to' : 'Assign to'}
                      <select
                        className="mt-1 block text-xs border rounded min-h-11 px-2 bg-background"
                        value={selectedAdminRadiologist}
                        onChange={(e) => setSelectedAdminRadiologist(e.target.value)}
                      >
                        <option value="">Select Radiologist...</option>
                        {radiologistsList?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      </label>
                      {isAssigned && (
                        <label className="text-xs font-semibold text-muted-foreground">
                          Reassignment reason
                          <input
                            value={reassignmentReason}
                            onChange={(event) => setReassignmentReason(event.target.value)}
                            maxLength={500}
                            placeholder="Shift change or workload balancing"
                            className="mt-1 block min-h-11 min-w-64 rounded border bg-background px-3 text-sm text-foreground"
                          />
                        </label>
                      )}
                      <Button
                        size="sm"
                        className="min-h-11"
                        disabled={!selectedAdminRadiologist || assignMutation.isPending || (isAssigned && reassignmentReason.trim().length < 5)}
                        onClick={() => assignMutation.mutate(selectedAdminRadiologist)}
                      >
                        {assignMutation.isPending ? 'Saving...' : isAssigned ? 'Reassign' : 'Assign'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {viewerError && (
              <span className="text-xs text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {viewerError}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold flex items-center gap-1.5 shadow-xs"
              onClick={() => {
                onOpenChange(false);
                navigate(`/reporting/${orderId}`);
              }}
            >
              <FileText className="h-4 w-4" />
              {studyContext?.order.orderStatus === 'COMPLETED' ? 'View Report' : 'Draft Report'}
            </Button>
            {canOpenImages && (
              <Button
                size="sm"
                onClick={() => openImagesMutation.mutate()}
                disabled={openImagesMutation.isPending}
                className="bg-[#2563EB] hover:bg-[#1b6485] text-white font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="h-4 w-4" />
                {openImagesMutation.isPending ? 'Launching...' : 'Open Images'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Reporting Workspace Modal (Phase 4.3) */}
    <RadiologistReportModal
      open={isReportModalOpen}
      onOpenChange={setIsReportModalOpen}
      orderId={orderId}
    />

    {/* Dedicated Read-Only Prior Report Context Modal */}
    <Dialog open={!!selectedPriorReportId} onOpenChange={(isOpen) => !isOpen && setSelectedPriorReportId(null)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>PRIOR REPORT</span>
            </DialogTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
              READ-ONLY HISTORICAL CONTEXT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Historical final report for comparative interpretation. This clinical record is immutable.
          </p>
        </DialogHeader>

        {isLoadingPriorReport ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-primary" />
            Loading prior report details...
          </div>
        ) : priorReportDetail ? (
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
              <div>
                <span className="text-muted-foreground block text-[11px]">Prior Accession:</span>
                <span className="font-semibold font-mono">{priorReportDetail.priorAccessionNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Examination:</span>
                <span className="font-medium">{priorReportDetail.modality} - {priorReportDetail.examinationName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Reporting Radiologist:</span>
                <span className="font-medium">{priorReportDetail.authorName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Finalized Date:</span>
                <span className="font-medium">
                  {priorReportDetail.finalizedAt ? formatDate(priorReportDetail.finalizedAt) : 'Recorded'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider block">
                Findings
              </span>
              <div className="p-3 bg-card border rounded-md font-sans whitespace-pre-wrap leading-relaxed">
                {priorReportDetail.findings || 'No findings recorded.'}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider block">
                Impression
              </span>
              <div className="p-3 bg-card border rounded-md font-sans whitespace-pre-wrap font-medium leading-relaxed">
                {priorReportDetail.impression || 'No impression recorded.'}
              </div>
            </div>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-800 dark:text-amber-300">
              <strong>Notice:</strong> This prior report is strictly read-only historical context for current study {studyContext?.order.accessionNumber}. No authoring or sign-off operations are active in this comparison view.
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Finalized prior report could not be retrieved.
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedPriorReportId(null)}>
            Close Prior Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Phase 4.6 — Peer Review Submodals */}
    {studyContext && (
      <>
        <PeerReviewRequestModal
          isOpen={isPeerReviewRequestOpen}
          onOpenChange={setIsPeerReviewRequestOpen}
          orderId={orderId!}
          patientName={`${studyContext.patient.lastName}, ${studyContext.patient.firstName}`}
          patientId={studyContext.patient.patientId}
          accessionNumber={studyContext.order.accessionNumber}
          modality={studyContext.order.modality}
          procedureName={studyContext.order.examinationName}
        />
        <PeerReviewDetailModal
          isOpen={isPeerReviewDetailOpen}
          onOpenChange={setIsPeerReviewDetailOpen}
          orderId={orderId!}
        />

        {/* Phase 4.7 — Critical Finding Submodals */}
        <CriticalFindingRequestModal
          isOpen={isCriticalFindingRequestOpen}
          onOpenChange={setIsCriticalFindingRequestOpen}
          orderId={orderId!}
          patientName={`${studyContext.patient.lastName}, ${studyContext.patient.firstName}`}
          patientId={studyContext.patient.patientId}
          accessionNumber={studyContext.order.accessionNumber}
          modality={studyContext.order.modality}
          procedureName={studyContext.order.examinationName}
        />
        <CriticalFindingDetailModal
          isOpen={isCriticalFindingDetailOpen}
          onOpenChange={setIsCriticalFindingDetailOpen}
          orderId={orderId!}
        />
      </>
    )}
    </>
  );
}

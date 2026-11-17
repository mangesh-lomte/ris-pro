import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Loader2,
  Activity,
  RotateCcw,
  Lock,
  Syringe,
  RadioTower,
} from 'lucide-react';
import { TechnologistContrastModal } from './TechnologistContrastModal';
import { TechnologistIncidentModal } from './TechnologistIncidentModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { technologistService } from '../../services/technologistService';
import {
  InterruptionReason,
  CancellationReason,
} from '../../types';
import { ApiError } from '../../lib/api';

interface TechnologistScanLifecycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onSuccess?: () => void;
  onOpenQualityReview?: () => void;
}

const INTERRUPTION_REASONS_LIST: { value: InterruptionReason; label: string }[] = [
  { value: 'PATIENT_REQUEST', label: 'Patient Request (Discomfort, Claustrophobia, Bathroom)' },
  { value: 'EQUIPMENT_ISSUE', label: 'Equipment Issue (Coil, Injector, Table, Hardware)' },
  { value: 'WORKFLOW_ISSUE', label: 'Workflow Issue (Positioning Adjustment, Line Check)' },
  { value: 'OTHER', label: 'Other Operational Reason (Detailed Note Required)' },
];

const CANCELLATION_REASONS_LIST: { value: CancellationReason; label: string }[] = [
  { value: 'PATIENT_REQUEST', label: 'Patient Refusal / Request to Stop' },
  { value: 'PATIENT_UNABLE_TO_CONTINUE', label: 'Patient Medically Unable to Continue Exam' },
  { value: 'EQUIPMENT_ISSUE', label: 'Equipment Malfunction / Scanner Down' },
  { value: 'ORDER_CANCELLED', label: 'Clinical Order Cancelled by Ordering Provider' },
  { value: 'WORKFLOW_ISSUE', label: 'Workflow Impediment / Patient Transferred' },
  { value: 'OTHER', label: 'Other Reason (Detailed Note Required)' },
];

export function TechnologistScanLifecycleModal({
  open,
  onOpenChange,
  examId,
  onSuccess,
  onOpenQualityReview,
}: TechnologistScanLifecycleModalProps) {
  const queryClient = useQueryClient();

  // Sub-dialog states for Interrupt, Finish, Cancel
  const [interruptDialogOpen, setInterruptDialogOpen] = useState(false);
  const [interruptReason, setInterruptReason] = useState<InterruptionReason>('PATIENT_REQUEST');
  const [interruptNotes, setInterruptNotes] = useState('');

  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancellationReason>('PATIENT_REQUEST');
  const [cancelNotes, setCancelNotes] = useState('');

  // Phase 3.5 Contrast & Incident Modals
  const [contrastModalOpen, setContrastModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [linkedContrastId, setLinkedContrastId] = useState<string | undefined>(undefined);

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Fetch Authoritative Scan Lifecycle Context
  const {
    data: context,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['technologist', 'scan', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID required');
      return technologistService.getScanLifecycle(examId);
    },
    enabled: open && Boolean(examId),
    refetchInterval: (query) => {
      // Auto-poll every 5 seconds if scan is active
      const state = query.state.data?.orderStatus;
      return state === 'SCAN_IN_PROGRESS' ? 5000 : false;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'preparation', examId] });
    setSubmissionError(null);
  };

  const handleMutationError = (err: unknown, defaultMessage: string) => {
    const isConflict =
      (err instanceof ApiError && err.statusCode === 409) ||
      (err as { statusCode?: number })?.statusCode === 409;
    if (isConflict) {
      setSubmissionError('This workflow changed in another session. Refreshing current status.');
      invalidateAll();
    } else {
      setSubmissionError(err instanceof Error ? err.message : defaultMessage);
    }
  };

  // 1. START SCAN Mutation
  const startScanMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.startScan(examId);
    },
    onSuccess: () => {
      invalidateAll();
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to start scan acquisition');
    },
  });

  const launchMwlMutation = useMutation({
    mutationFn: () => {
      if (!context?.orderId) throw new Error('Missing order ID');
      return technologistService.launchScannerWorklist(context.orderId);
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to publish this examination to the scanner worklist');
    },
  });

  // 2. INTERRUPT SCAN Mutation
  const interruptScanMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.interruptScan(examId, {
        reason: interruptReason,
        notes: interruptNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateAll();
      setInterruptDialogOpen(false);
      setInterruptNotes('');
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to interrupt scan acquisition');
    },
  });

  // 3. RESUME SCAN Mutation
  const resumeScanMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.resumeScan(examId);
    },
    onSuccess: () => {
      invalidateAll();
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to resume scan acquisition');
    },
  });

  // 4. FINISH SCAN Mutation
  const finishScanMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.finishScan(examId);
    },
    onSuccess: () => {
      invalidateAll();
      setFinishConfirmOpen(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to finish scan acquisition');
    },
  });

  // 5. CANCEL SCAN Mutation
  const cancelScanMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.cancelScan(examId, {
        reason: cancelReason,
        notes: cancelNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateAll();
      setCancelDialogOpen(false);
      setCancelNotes('');
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to cancel scan acquisition');
    },
  });

  if (!open || !examId) return null;

  const isScanInProgress = context?.orderStatus === 'SCAN_IN_PROGRESS';
  const isScanInterrupted = context?.orderStatus === 'SCAN_INTERRUPTED';
  const isScanCompleted = context?.orderStatus === 'SCAN_COMPLETED';
  const isScanCancelled = context?.orderStatus === 'SCAN_CANCELLED';
  const isReadyForScan = context?.orderStatus === 'READY_FOR_SCAN';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
        <DialogContent>
          {/* Header */}
          <DialogHeader>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded border ${
                  isScanInProgress
                    ? 'bg-sky-50 border-sky-200 text-sky-700 animate-pulse'
                    : isScanInterrupted
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : isScanCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : isScanCancelled
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>Scan Acquisition Lifecycle</DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operational Scanner Workflow Gate
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {context && (
                  <Badge
                    variant={
                      isScanCompleted
                        ? 'success'
                        : isScanInProgress
                        ? 'cyan'
                        : isScanInterrupted
                        ? 'warning'
                        : isScanCancelled
                        ? 'destructive'
                        : 'success'
                    }
                    className="font-bold text-[10px]"
                  >
                    {context.orderStatus.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Loading & Error States */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
              <span className="text-xs font-medium">Loading scan lifecycle context...</span>
            </div>
          )}

          {isError && (
            <div className="p-4 my-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Failed to load scan context</span>
              </div>
              <p>{error instanceof Error ? error.message : 'Unknown server error'}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs mt-2">
                Retry
              </Button>
            </div>
          )}

          {submissionError && (
            <div className="p-3 my-2 bg-rose-50 border border-rose-300 rounded text-rose-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{submissionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionError(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2"
              >
                ✕
              </button>
            </div>
          )}

          {context && (
            <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
              {/* Clinical Sequence Progression Stepper */}
              <div className="grid grid-cols-4 gap-2 p-2 bg-slate-100 rounded border border-[#E2E8F0] text-center text-xs">
                {[
                  { step: 1, label: '1. READY', desc: 'Safety & Prep' },
                  { step: 2, label: '2. SCANNING', desc: 'Acquisition' },
                  { step: 3, label: '3. QUALITY REVIEW', desc: 'QC Verification' },
                  { step: 4, label: '4. PACS HANDOFF', desc: 'Archival & Triage' },
                ].map((s) => {
                  const activeMilestone = isReadyForScan ? 1 : isScanInProgress || isScanInterrupted ? 2 : 3;
                  const isCurrent = activeMilestone === s.step;
                  const isPast = activeMilestone > s.step;
                  return (
                    <div
                      key={s.step}
                      className={`p-2 rounded transition-all ${
                        isCurrent
                          ? 'bg-[#2563EB] text-white shadow-xs font-bold'
                          : isPast
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold'
                          : 'bg-white/60 text-slate-400 font-medium'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wide flex items-center justify-center gap-1">
                        {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        <span>{s.label}</span>
                      </div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isCurrent ? 'text-blue-100' : isPast ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {s.desc}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Exam & Patient Identity Card */}
              <div className="bg-slate-900 text-white rounded p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                      Patient Identity & Demographics
                    </span>
                    <span className="text-sm font-bold text-white">
                      {context.patient.firstName} {context.patient.lastName}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-slate-700 text-slate-300 font-mono text-[10px]">
                    {context.modality}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Patient MRN / ID
                    </span>
                    <IdentifierPill type="patient" value={context.patient.patientId} />
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Accession Number
                    </span>
                    <IdentifierPill type="accession" value={context.accessionNumber} />
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Assigned Scanner
                    </span>
                    <span className="font-semibold text-slate-200 truncate block">
                      {context.equipment?.name || 'Assigned Suite'}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Confirmed Protocol
                    </span>
                    <span className="font-mono font-semibold text-indigo-300 truncate block">
                      {context.protocol?.code || 'None'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 pt-1 flex items-center justify-between border-t border-slate-800">
                  <span className="font-medium text-slate-200">{context.examination}</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Priority: <strong className="text-amber-400">{context.priority}</strong>
                  </span>
                </div>
              </div>

              {/* SECTION: READY_FOR_SCAN STATE (Pre-acquisition summary & Start Scan) */}
              {isReadyForScan && (
                <div className="border border-[#E2E8F0] rounded p-5 bg-white space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Play className="w-4 h-4 text-emerald-600" />
                        Pre-Scan Acquisition Checklist Verified
                      </span>
                      <p className="text-[11px] text-slate-500">
                        All safety screening and patient preparation gates have been satisfied.
                      </p>
                    </div>
                    <Badge variant="success" className="font-bold text-[10px] bg-emerald-600 text-white">
                      READY FOR SCAN
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Safety Screening</span>
                        <strong className="text-emerald-700">{context.safetyStatus}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Preparation</span>
                        <strong className="text-emerald-700">{context.preparationStatus}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Protocol</span>
                        <strong className="text-blue-700 font-mono">{context.protocol?.code}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
                    <strong>Operational Notice:</strong> Publish the verified patient and order context to the scanner MWL before starting acquisition. The server records the destination AE Title and launch timestamp.
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded border border-[#E2E8F0] bg-slate-50 p-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <RadioTower className={`mt-0.5 h-4 w-4 shrink-0 ${context.mwlSyncedAt ? 'text-emerald-600' : 'text-slate-500'}`} />
                      <div className="min-w-0 text-[11px]">
                        <strong className="block text-slate-800">
                          {context.mwlSyncedAt ? 'Scanner worklist launched' : 'Scanner worklist launch required'}
                        </strong>
                        <span className="block text-slate-500">
                          {context.mwlSyncedAt
                            ? `${context.mwlStationAETitle} · ${new Date(context.mwlSyncedAt).toLocaleString()}`
                            : 'No server-recorded MWL launch exists for this acquisition.'}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={context.mwlSyncedAt ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => launchMwlMutation.mutate()}
                      disabled={launchMwlMutation.isPending}
                      className="shrink-0 gap-1.5 text-xs"
                    >
                      {launchMwlMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RadioTower className="h-3.5 w-3.5" />}
                      {context.mwlSyncedAt ? 'Republish MWL' : 'Launch to scanner'}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelDialogOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Exam
                    </Button>

                    <Button
                      type="button"
                      size="lg"
                      disabled={startScanMutation.isPending || !context.mwlSyncedAt}
                      onClick={() => startScanMutation.mutate()}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                    >
                      {startScanMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                      <span>START SCAN ACQUISITION</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* SECTION: SCAN_IN_PROGRESS STATE */}
              {isScanInProgress && (
                <div className="border border-sky-300 rounded p-5 bg-sky-50/40 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-sky-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-600"></span>
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-950">
                        Scan Acquisition Currently In Progress
                      </span>
                    </div>
                    <Badge variant="cyan" className="font-bold text-[10px] bg-sky-700 text-white">
                      SCAN IN PROGRESS
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white rounded border border-sky-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Acquisition Started At
                      </span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-sky-600" />
                        {context.scan?.startedAt
                          ? new Date(context.scan.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Recorded'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Started By Technologist
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.scan?.startedBy
                          ? `${context.scan.startedBy.firstName} ${context.scan.startedBy.lastName}`
                          : 'Authenticated User'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Scanner Hardware
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.equipment?.name || 'Assigned Suite'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Patient is on the scanner table with active protocol{' '}
                    <strong className="font-mono text-blue-700">{context.protocol?.code}</strong>.
                    You may pause acquisition if an operational issue occurs, or finish acquisition once scan series are complete.
                  </p>

                  {/* Phase 3.5 Contrast Administration & Incident Recording */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 pb-1 border-t border-sky-100">
                    {context.contrastRequired ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setContrastModalOpen(true)}
                        className="text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white gap-1.5 shadow-xs"
                      >
                        <Syringe className="w-3.5 h-3.5" />
                        RECORD CONTRAST ADMINISTRATION
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic bg-white px-2.5 py-1 rounded border border-[#E2E8F0]">
                        Contrast is not required for this ordered examination.
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkedContrastId(undefined);
                        setIncidentModalOpen(true);
                      }}
                      className="text-xs font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Record Incident
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-sky-200">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInterruptDialogOpen(true)}
                      className="text-xs font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-600" />
                      Interrupt Scan
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setFinishConfirmOpen(true)}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      FINISH SCAN
                    </Button>
                  </div>
                </div>
              )}

              {/* SECTION: SCAN_INTERRUPTED STATE */}
              {isScanInterrupted && (
                <div className="border border-amber-300 rounded p-5 bg-amber-50/50 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Scan Acquisition Interrupted</span>
                    </div>
                    <Badge variant="warning" className="font-bold text-[10px] bg-amber-600 text-white">
                      INTERRUPTED
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded border border-amber-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Interruption Reason
                      </span>
                      <strong className="text-amber-900 block mt-0.5">
                        {context.scan?.interruptionReason?.replace(/_/g, ' ') || 'PATIENT REQUEST'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Interrupted At
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.scan?.interruptedAt
                          ? new Date(context.scan.interruptedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Recorded'}
                      </span>
                    </div>

                    {context.scan?.interruptionNotes && (
                      <div className="col-span-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Technologist Notes
                        </span>
                        <p className="text-xs text-slate-700 italic mt-0.5">
                          "{context.scan.interruptionNotes}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1 pb-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkedContrastId(undefined);
                        setIncidentModalOpen(true);
                      }}
                      className="text-xs font-semibold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Record Incident
                    </Button>
                    {context.contrastRequired && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setContrastModalOpen(true)}
                        className="text-xs text-blue-700 hover:bg-blue-50 gap-1.5"
                      >
                        <Syringe className="w-3.5 h-3.5 text-[#2563EB]" />
                        View Contrast History
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelDialogOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Exam
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={resumeScanMutation.isPending}
                      onClick={() => resumeScanMutation.mutate()}
                      className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-sm"
                    >
                      {resumeScanMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>RESUME SCAN ACQUISITION</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* SECTION: SCAN_COMPLETED STATE (Terminal) */}
              {isScanCompleted && (
                <div className="border border-emerald-300 rounded p-5 bg-emerald-50/50 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Scan Acquisition Completed</span>
                    </div>
                    <Badge variant="success" className="font-bold text-[10px] bg-emerald-700 text-white">
                      SCAN COMPLETED
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white rounded border border-emerald-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Started At
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.scan?.startedAt ? new Date(context.scan.startedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Completed At
                      </span>
                      <span className="font-bold text-emerald-800 mt-0.5 block">
                        {context.scan?.completedAt ? new Date(context.scan.completedAt).toLocaleTimeString() : 'Recorded'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Completed By
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.scan?.completedBy
                          ? `${context.scan.completedBy.firstName} ${context.scan.completedBy.lastName}`
                          : 'Technologist'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Operational scan acquisition is complete. The scan lifecycle record is locked.
                  </p>

                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
                    {context.contrastRequired && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setContrastModalOpen(true)}
                        className="text-xs font-semibold border-blue-200 text-indigo-800 hover:bg-blue-50 gap-1.5"
                      >
                        <Syringe className="w-3.5 h-3.5 text-[#2563EB]" />
                        View Contrast History
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkedContrastId(undefined);
                        setIncidentModalOpen(true);
                      }}
                      className="text-xs font-semibold border-amber-200 text-amber-800 hover:bg-amber-50 gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      View Incident History
                    </Button>
                    {onOpenQualityReview && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={onOpenQualityReview}
                        className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
                      >
                        Proceed to Quality Review &rarr;
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: SCAN_CANCELLED STATE (Terminal) */}
              {isScanCancelled && (
                <div className="border border-rose-300 rounded p-5 bg-rose-50/50 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                    <div className="flex items-center gap-2 text-rose-950 font-bold text-xs uppercase tracking-wider">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Scan Acquisition Cancelled</span>
                    </div>
                    <Badge variant="destructive" className="font-bold text-[10px]">
                      CANCELLED
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded border border-rose-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Cancellation Reason
                      </span>
                      <strong className="text-rose-900 mt-0.5 block">
                        {context.scan?.cancellationReason?.replace(/_/g, ' ') || 'PATIENT REQUEST'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Cancelled At
                      </span>
                      <span className="font-medium text-slate-800 mt-0.5 block">
                        {context.scan?.cancelledAt ? new Date(context.scan.cancelledAt).toLocaleTimeString() : 'Recorded'}
                      </span>
                    </div>

                    {context.scan?.cancellationNotes && (
                      <div className="col-span-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Cancellation Notes
                        </span>
                        <p className="text-xs text-slate-700 italic mt-0.5">
                          "{context.scan.cancellationNotes}"
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-rose-900 leading-relaxed">
                    This scan acquisition was cancelled. All lifecycle mutations are restricted.
                  </p>

                  <div className="flex items-center gap-2 pt-2 border-t border-rose-200">
                    {context.contrastRequired && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setContrastModalOpen(true)}
                        className="text-xs font-semibold border-blue-200 text-indigo-800 hover:bg-blue-50 gap-1.5"
                      >
                        <Syringe className="w-3.5 h-3.5 text-[#2563EB]" />
                        View Contrast History
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkedContrastId(undefined);
                        setIncidentModalOpen(true);
                      }}
                      className="text-xs font-semibold border-amber-200 text-amber-800 hover:bg-amber-50 gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      View Incident History
                    </Button>
                  </div>
                </div>
              )}

              {/* Lifecycle Events Audit Trail */}
              {context.scan?.events && context.scan.events.length > 0 && (
                <div className="border border-[#E2E8F0] rounded p-4 bg-white space-y-3 shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Operational Lifecycle Events Log
                  </span>

                  <div className="space-y-2">
                    {context.scan.events.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 rounded border border-slate-100 bg-slate-50 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              evt.action === 'COMPLETED'
                                ? 'success'
                                : evt.action === 'STARTED' || evt.action === 'RESUMED'
                                ? 'cyan'
                                : evt.action === 'INTERRUPTED'
                                ? 'warning'
                                : 'destructive'
                            }
                            className="font-bold text-[9px]"
                          >
                            {evt.action}
                          </Badge>
                          <span className="font-medium text-slate-700">
                            {evt.user ? `${evt.user.firstName} ${evt.user.lastName}` : 'System / Tech'}
                          </span>
                          {evt.reason && (
                            <span className="text-[11px] text-slate-500">
                              • Reason: {evt.reason.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUB-MODAL 1: INTERRUPT SCAN DIALOG */}
      <Dialog open={interruptDialogOpen} onOpenChange={setInterruptDialogOpen} maxWidth="md">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <Pause className="w-5 h-5 text-amber-600" />
              <span>Interrupt Scan Acquisition</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Select an operational reason for interrupting acquisition. Original start timestamp will be preserved.
            </p>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Reason for Interruption *</label>
              <select
                value={interruptReason}
                onChange={(e) => setInterruptReason(e.target.value as InterruptionReason)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-amber-500 focus:border-amber-500"
              >
                {INTERRUPTION_REASONS_LIST.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Technologist Notes {interruptReason === 'OTHER' ? '*' : '(Optional)'}
              </label>
              <textarea
                value={interruptNotes}
                onChange={(e) => setInterruptNotes(e.target.value)}
                placeholder={
                  interruptReason === 'OTHER'
                    ? 'Enter detailed reason (required, at least 3 characters)...'
                    : 'Add brief operational notes (e.g. patient requested 2-minute pause)...'
                }
                rows={3}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-amber-500 focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInterruptDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                interruptScanMutation.isPending ||
                (interruptReason === 'OTHER' && interruptNotes.trim().length < 3)
              }
              onClick={() => interruptScanMutation.mutate()}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {interruptScanMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Interruption</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUB-MODAL 2: FINISH SCAN CONFIRMATION */}
      <Dialog open={finishConfirmOpen} onOpenChange={setFinishConfirmOpen} maxWidth="sm">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Finish Scan Acquisition</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-700 space-y-2">
            <p>
              Mark this scan acquisition workflow as completed for accession{' '}
              <strong className="font-mono">{context?.accessionNumber}</strong>?
            </p>
            <p className="text-[11px] text-slate-500">
              This records the official completion timestamp and locks the scan lifecycle in terminal status <strong>SCAN COMPLETED</strong>.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFinishConfirmOpen(false)}
              className="text-xs"
            >
              No, Continue Scan
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={finishScanMutation.isPending}
              onClick={() => finishScanMutation.mutate()}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {finishScanMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Yes, Finish Scan</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUB-MODAL 3: CANCEL SCAN DIALOG */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} maxWidth="md">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-900">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Cancel Scan Acquisition</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 leading-relaxed">
              <strong>Warning:</strong> Cancellation is terminal for this workflow. The exam will be placed in status <strong>SCAN CANCELLED</strong>.
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Reason for Cancellation *</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as CancellationReason)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-rose-500 focus:border-rose-500"
              >
                {CANCELLATION_REASONS_LIST.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Cancellation Notes {cancelReason === 'OTHER' ? '*' : '(Optional)'}
              </label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder={
                  cancelReason === 'OTHER'
                    ? 'Enter detailed cancellation reason (required, at least 3 characters)...'
                    : 'Add any relevant context for ordering clinician or records...'
                }
                rows={3}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-rose-500 focus:border-rose-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(false)}
              className="text-xs"
            >
              Keep Exam
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={
                cancelScanMutation.isPending ||
                (cancelReason === 'OTHER' && cancelNotes.trim().length < 3)
              }
              onClick={() => cancelScanMutation.mutate()}
              className="text-xs font-semibold gap-1.5"
            >
              {cancelScanMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Cancellation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 3.5 Contrast Administration Modal */}
      <TechnologistContrastModal
        open={contrastModalOpen}
        onOpenChange={setContrastModalOpen}
        examId={examId}
        onOpenIncidentModal={(contrastId) => {
          setContrastModalOpen(false);
          setLinkedContrastId(contrastId);
          setIncidentModalOpen(true);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
        }}
      />

      {/* Phase 3.5 Technologist Incident Modal */}
      <TechnologistIncidentModal
        open={incidentModalOpen}
        onOpenChange={setIncidentModalOpen}
        examId={examId}
        initialContrastAdminId={linkedContrastId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
        }}
      />
    </>
  );
}

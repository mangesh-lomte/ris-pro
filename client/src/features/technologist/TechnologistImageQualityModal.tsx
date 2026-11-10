import React, { useState } from 'react';
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
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { technologistService } from '../../services/technologistService';
import {
  ImageQualityReason,
  ImageQualityDecisionPayload,
  AcceptImageQualityPayload,
  PacsStatusData,
  PacsStudyLookupResponse,
} from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Send,
  Clock,
  Layers,
  ShieldCheck,
  Loader2,
  Server,
  FileCheck,
  RefreshCw,
  Search,
  Database,
  Link2,
  CheckCheck,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { ApiError, formatSafeErrorMessage } from '../../lib/api';

interface TechnologistImageQualityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onSuccess?: () => void;
}

const QA_REASONS_LIST: { value: ImageQualityReason; label: string }[] = [
  { value: 'PATIENT_MOTION', label: 'Patient Motion (Degraded anatomical sharpness / motion blur)' },
  { value: 'POSITIONING', label: 'Patient Positioning (Anatomy cut off / incorrect centering)' },
  { value: 'COVERAGE_INCOMPLETE', label: 'Incomplete Coverage (Prescribed anatomy volume missing)' },
  { value: 'TECHNICAL_ARTIFACT', label: 'Technical Artifact (Metal streak / ring artifact / noise)' },
  { value: 'PROTOCOL_DEVIATION', label: 'Protocol Deviation (Incorrect sequence / timing mismatch)' },
  { value: 'OTHER', label: 'Other Technical or Operational Reason (Notes required)' },
];

export function TechnologistImageQualityModal({
  open,
  onOpenChange,
  examId,
  onSuccess,
}: TechnologistImageQualityModalProps) {
  const queryClient = useQueryClient();

  // Mode: 'view' | 'repeat' | 'reject' | 'accept'
  const [decisionMode, setDecisionMode] = useState<'view' | 'repeat' | 'reject' | 'accept'>('view');
  const [selectedReason, setSelectedReason] = useState<ImageQualityReason>('PATIENT_MOTION');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Image Quality Context
  const {
    data: context,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['technologist', 'image-quality', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.getImageQualityContext(examId);
    },
    enabled: open && Boolean(examId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['technologist', 'image-quality', examId] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'contrast', examId] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail', examId] });
    queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
    if (onSuccess) onSuccess();
  };

  const handleMutationError = (err: any, defaultMessage: string) => {
    const isConflict =
      (err instanceof ApiError && err.statusCode === 409) ||
      err?.statusCode === 409 ||
      err?.status === 409 ||
      err?.response?.status === 409;
    if (isConflict) {
      setFormError('This workflow changed in another session. Refreshing current status.');
      invalidateAll();
    } else {
      setFormError(formatSafeErrorMessage(err, defaultMessage));
    }
  };

  // 1. Start QA Review Mutation
  const startMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.startImageQualityReview(examId);
    },
    onSuccess: () => {
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Failed to start Image Quality Review.');
    },
  });

  // 2. Accept QA Mutation
  const acceptMutation = useMutation({
    mutationFn: (payload: AcceptImageQualityPayload) => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.acceptImageQuality(examId, payload);
    },
    onSuccess: () => {
      setDecisionMode('view');
      setNotes('');
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Failed to accept Image Quality.');
    },
  });

  // 3. Repeat Required Mutation
  const repeatMutation = useMutation({
    mutationFn: (payload: ImageQualityDecisionPayload) => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.markRepeatRequired(examId, payload);
    },
    onSuccess: () => {
      setDecisionMode('view');
      setNotes('');
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Failed to record repeat requirement.');
    },
  });

  // 4. Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: (payload: ImageQualityDecisionPayload) => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.rejectImageQuality(examId, payload);
    },
    onSuccess: () => {
      setDecisionMode('view');
      setNotes('');
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Failed to record image rejection.');
    },
  });

  // 5. Authorize Repeat Mutation
  const authorizeRepeatMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.authorizeRepeat(examId);
    },
    onSuccess: () => {
      setDecisionMode('view');
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Failed to authorize repeat acquisition.');
    },
  });

  // 6. Initiate PACS Handoff Mutation
  const initiatePacsMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.initiatePacsHandoff(examId);
    },
    onSuccess: () => {
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Simulated PACS handoff failed.');
    },
  });

  // 7. Retry PACS Handoff Mutation
  const retryPacsMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.retryPacsHandoff(examId);
    },
    onSuccess: () => {
      setFormError(null);
      invalidateAll();
    },
    onError: (err: any) => {
      handleMutationError(err, 'Simulated PACS handoff retry failed.');
    },
  });

  // Phase 3.6R: Real PACS Integration Status & Orthanc Study Lookup
  const {
    data: pacsStatus,
    isLoading: isPacsLoading,
    refetch: refetchPacs,
    isFetching: isPacsFetching,
  } = useQuery<PacsStatusData>({
    queryKey: ['integrations', 'pacs', 'status'],
    queryFn: () => technologistService.getPacsStatus(),
    enabled: open,
    staleTime: 5000,
  });

  const isOrthanc = pacsStatus?.adapter === 'orthanc';
  const isPacsOffline = isOrthanc && !pacsStatus?.connected;
  const [lookupResult, setLookupResult] = useState<PacsStudyLookupResponse | null>(null);

  const lookupMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.lookupPacsStudy(examId);
    },
    onSuccess: (data) => {
      setLookupResult(data);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(formatSafeErrorMessage(err, 'Orthanc study lookup failed.'));
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.reconcilePacsStudy(examId);
    },
    onSuccess: () => {
      setFormError(null);
      lookupMutation.mutate();
      invalidateAll();
    },
    onError: (err: any) => {
      setFormError(formatSafeErrorMessage(err, 'Orthanc study reconciliation failed.'));
    },
  });

  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (decisionMode === 'repeat') {
      if (selectedReason === 'OTHER' && (!notes.trim() || notes.trim().length < 3)) {
        setFormError("Notes are required and must be at least 3 characters when reason is 'OTHER'.");
        return;
      }
      repeatMutation.mutate({
        reason: selectedReason,
        notes: notes.trim() || undefined,
      });
    } else if (decisionMode === 'reject') {
      if (selectedReason === 'OTHER' && (!notes.trim() || notes.trim().length < 3)) {
        setFormError("Notes are required and must be at least 3 characters when reason is 'OTHER'.");
        return;
      }
      rejectMutation.mutate({
        reason: selectedReason,
        notes: notes.trim() || undefined,
      });
    } else if (decisionMode === 'accept') {
      acceptMutation.mutate({
        notes: notes.trim() || undefined,
      });
    }
  };

  const isAnyActionPending =
    startMutation.isPending ||
    acceptMutation.isPending ||
    repeatMutation.isPending ||
    rejectMutation.isPending ||
    authorizeRepeatMutation.isPending ||
    initiatePacsMutation.isPending ||
    retryPacsMutation.isPending;

  if (!open || !examId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Image Quality Review & RIS-Side PACS Handoff</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Technologist Quality Verification & Interoperability Gateway
                </p>
              </div>
            </div>
            {context && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {context.orderStatus}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-28 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : isError || !context ? (
          <div className="p-6 text-center text-rose-600 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-semibold">Unable to load image quality context</p>
            <p className="text-xs text-slate-500">
              {formatSafeErrorMessage(error, 'Record could not be retrieved.')}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Prominent Verified Identifiers Banner */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Patient & Examination Context (Authoritative)</span>
                <span className="text-emerald-400 font-mono text-[10px]">VERIFIED IDENTIFIERS</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Patient Name</span>
                  <span className="font-bold text-sm text-white">
                    {context.patient.firstName} {context.patient.lastName}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    DOB: {formatDate(context.patient.dateOfBirth)} ({context.patient.gender})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Patient ID (MRN)</span>
                  <div className="mt-1">
                    <IdentifierPill value={context.patientId} type="patient" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Accession Number</span>
                  <div className="mt-1">
                    <IdentifierPill value={context.accessionNumber} type="accession" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Exam & Protocol</span>
                  <strong className="text-xs text-indigo-300 block">{context.examination}</strong>
                  <span className="text-[10px] text-slate-400 block">
                    Modality: <strong className="text-white">{context.modality}</strong> | Body Part: {context.bodyPart}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Scope Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Clinical Notice:</strong> This workstation performs RIS-side technologist acquisition verification (artifact check, patient motion check, field-of-view completeness). It does NOT perform radiologist diagnostic interpretation.
              </span>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Current Acquisition Attempt Details Bar */}
            {context.currentScan && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px] tracking-wide">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Acquisition Attempt #{context.currentScan.attemptNumber}
                  </span>
                  <Badge variant={context.currentScan.state === 'COMPLETED' ? 'success' : 'outline'} className="text-[10px]">
                    Scan {context.currentScan.state}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Scanner / Suite</span>
                    <span className="font-medium text-slate-800">{context.equipment?.name || 'Assigned Gantry'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Scan Started</span>
                    <span>{new Date(context.currentScan.startedAt).toLocaleTimeString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Scan Completed</span>
                    <span>
                      {context.currentScan.completedAt
                        ? new Date(context.currentScan.completedAt).toLocaleTimeString()
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Technologist</span>
                    <span className="font-medium text-slate-800">
                      {context.currentScan.startedBy
                        ? `${context.currentScan.startedBy.firstName} ${context.currentScan.startedBy.lastName}`
                        : 'Authenticated Tech'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Not started yet (Order is SCAN_COMPLETED and QA not started) */}
            {context.flags.canStartQA && (
              <div className="p-5 border border-dashed border-indigo-300 rounded-xl bg-indigo-50/40 text-center space-y-3">
                <FileCheck className="w-8 h-8 text-indigo-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">Scan Acquisition Completed</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
                    Scan acquisition has completed successfully. Begin Technologist Image Quality Review to evaluate technical adequacy, check for motion or positioning artifacts, and prepare for downstream PACS handoff.
                  </p>
                </div>
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
                >
                  {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  BEGIN IMAGE QUALITY REVIEW
                </Button>
              </div>
            )}

            {/* STEP 2: QA Pending Decision (Order is IMAGE_QA_PENDING) */}
            {context.imageQualityReview?.status === 'PENDING' && decisionMode === 'view' && (
              <div className="p-5 border border-indigo-200 rounded-xl bg-white shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Quality Review in Progress (Pending Decision)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Started at {new Date(context.imageQualityReview.startedAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Verify anatomical coverage, sharpness, and absence of technical or motion artifacts for Attempt #{context.currentScan?.attemptNumber}. Select an authoritative workflow outcome below:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {/* Accept */}
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('accept');
                      setFormError(null);
                    }}
                    className="p-4 border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                      ACCEPT IMAGES
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Technical quality verified. Exam advances to PACS READY for downstream transmission.
                    </p>
                  </button>

                  {/* Repeat Required */}
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('repeat');
                      setFormError(null);
                    }}
                    className="p-4 border-2 border-amber-200 hover:border-amber-500 bg-amber-50/40 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                      <RotateCcw className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                      REPEAT REQUIRED
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Significant motion or artifact observed. A repeat acquisition attempt is required.
                    </p>
                  </button>

                  {/* Reject */}
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('reject');
                      setFormError(null);
                    }}
                    className="p-4 border-2 border-rose-200 hover:border-rose-500 bg-rose-50/40 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-1">
                      <XCircle className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
                      REJECT ACQUISITION
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Unusable acquisition attempt. Blocks downstream PACS transfer permanently unless repeat authorized.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Decision Confirmation Forms (Repeat / Reject / Accept) */}
            {decisionMode !== 'view' && (
              <form onSubmit={handleDecisionSubmit} className="p-5 border border-slate-300 rounded-xl bg-slate-50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {decisionMode === 'accept' && 'Confirm Image Acceptance'}
                    {decisionMode === 'repeat' && 'Document Repeat Requirement'}
                    {decisionMode === 'reject' && 'Document Image Rejection'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDecisionMode('view')}
                    className="text-xs h-6 px-2 text-slate-500"
                  >
                    Cancel
                  </Button>
                </div>

                {(decisionMode === 'repeat' || decisionMode === 'reject') && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Primary Quality Reason <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value as ImageQualityReason)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      disabled={isAnyActionPending}
                    >
                      {QA_REASONS_LIST.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Quality Verification Notes {selectedReason === 'OTHER' && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      decisionMode === 'accept'
                        ? 'Optional technical verification notes (e.g. Sharp diagnostic detail, full coverage).'
                        : 'Explain the technical inadequacy, artifact location, or reason for repeat/rejection.'
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    disabled={isAnyActionPending}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDecisionMode('view')}
                    className="text-xs"
                    disabled={isAnyActionPending}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isAnyActionPending}
                    className={`text-xs font-bold text-white gap-2 ${
                      decisionMode === 'accept'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : decisionMode === 'repeat'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isAnyActionPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : decisionMode === 'accept' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : decisionMode === 'repeat' ? (
                      <RotateCcw className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span>
                      {decisionMode === 'accept' && 'CONFIRM ACCEPTANCE'}
                      {decisionMode === 'repeat' && 'RECORD REPEAT REQUIRED'}
                      {decisionMode === 'reject' && 'RECORD REJECTION'}
                    </span>
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 3A: REPEAT_REQUIRED Banner & Action */}
            {context.imageQualityReview?.status === 'REPEAT_REQUIRED' && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <span>REPEAT REQUIRED FOR ATTEMPT #{context.currentScan?.attemptNumber}</span>
                  </div>
                  <Badge variant="warning" className="text-[10px]">
                    {context.imageQualityReview.reasonCode}
                  </Badge>
                </div>

                {context.imageQualityReview.notes && (
                  <p className="text-[11px] text-slate-700 bg-white/70 p-2.5 rounded border border-amber-200">
                    "{context.imageQualityReview.notes}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px] text-amber-900">
                  <span>
                    Reviewed by{' '}
                    <strong>
                      {context.imageQualityReview.reviewedBy?.firstName} {context.imageQualityReview.reviewedBy?.lastName}
                    </strong>{' '}
                    at {new Date(context.imageQualityReview.reviewedAt || '').toLocaleTimeString()}
                  </span>

                  {context.flags.canAuthorizeRepeat && (
                    <Button
                      size="sm"
                      onClick={() => authorizeRepeatMutation.mutate()}
                      disabled={authorizeRepeatMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 h-8 shadow-xs"
                    >
                      {authorizeRepeatMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      AUTHORIZE REPEAT SCAN
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3B: REJECTED Banner & Action */}
            {context.imageQualityReview?.status === 'REJECTED' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>ACQUISITION ATTEMPT #{context.currentScan?.attemptNumber} REJECTED</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    {context.imageQualityReview.reasonCode}
                  </Badge>
                </div>

                {context.imageQualityReview.notes && (
                  <p className="text-[11px] text-slate-700 bg-white/70 p-2.5 rounded border border-rose-200">
                    "{context.imageQualityReview.notes}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px] text-rose-900">
                  <span>
                    Reviewed by{' '}
                    <strong>
                      {context.imageQualityReview.reviewedBy?.firstName} {context.imageQualityReview.reviewedBy?.lastName}
                    </strong>{' '}
                    at {new Date(context.imageQualityReview.reviewedAt || '').toLocaleTimeString()}
                  </span>

                  {context.flags.canAuthorizeRepeat && (
                    <Button
                      size="sm"
                      onClick={() => authorizeRepeatMutation.mutate()}
                      disabled={authorizeRepeatMutation.isPending}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 h-8 shadow-xs"
                    >
                      {authorizeRepeatMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      AUTHORIZE REPEAT SCAN
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: ACCEPTED & PACS HANDOFF SECTION */}
            {context.imageQualityReview?.status === 'ACCEPTED' && (
              <div className="space-y-4">
                {/* Accepted Confirmation Banner */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block">IMAGE QUALITY ACCEPTED (Attempt #{context.currentScan?.attemptNumber})</strong>
                      <span className="text-[11px] text-emerald-700">
                        Accepted by {context.imageQualityReview.reviewedBy?.firstName} {context.imageQualityReview.reviewedBy?.lastName} at{' '}
                        {new Date(context.imageQualityReview.reviewedAt || '').toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    QA ACCEPTED
                  </Badge>
                </div>

                {/* Real Orthanc PACS Integration Card vs Simulated Mock Card */}
                {isOrthanc || isPacsLoading || pacsStatus?.adapter === 'orthanc' ? (
                  <div className="border border-sky-300 rounded-xl p-5 bg-gradient-to-b from-sky-50/60 via-white to-slate-50 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-sky-600 text-white rounded-lg shadow-xs">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">PACS Integration — REAL ORTHANC CONNECTION</h4>
                            <span className="text-[10px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold">
                              OrthancPacsGateway
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Real authenticated REST integration & accession reconciliation
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={pacsStatus?.connected ? 'success' : 'destructive'}
                        className="font-mono text-[10px]"
                      >
                        {pacsStatus?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                      </Badge>
                    </div>

                    {/* PACS Outage State Banner */}
                    {isPacsOffline && (
                      <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <strong className="text-xs font-bold text-amber-950">PACS Unavailable</strong>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              refetchPacs();
                              if (lookupResult) lookupMutation.mutate();
                            }}
                            disabled={isPacsFetching}
                            className="text-xs font-semibold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 gap-1.5 h-7 shadow-xs"
                          >
                            <RefreshCw className={`w-3 h-3 ${isPacsFetching ? 'animate-spin' : ''}`} />
                            <span>Retry PACS Connection</span>
                          </Button>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          Orthanc is currently unreachable. RIS workflow data remains available.
                        </p>
                      </div>
                    )}

                    {/* Infrastructure Capabilities Matrix */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs bg-white p-3 rounded-lg border border-sky-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">PACS Server</span>
                        <span className="font-bold text-slate-800">{pacsStatus?.serverName || 'RadAxis PACS Gateway'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Metadata Lookup</span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">DICOMweb Plugin</span>
                        <span className={pacsStatus?.dicomWebPluginAvailable ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                          {pacsStatus?.dicomWebPluginAvailable ? 'Available' : 'Not detected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">RIS DICOM Upload</span>
                        <span className="text-rose-600 font-bold uppercase text-[11px]">NOT IMPLEMENTED</span>
                      </div>
                    </div>

                    {/* Honesty Notice */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                      <strong>Honesty Notice:</strong> Real Orthanc connectivity, capability discovery, and accession reconciliation are active. However, this RIS does not generate or transfer DICOM pixel objects. Modalities acquire and store images directly to Orthanc.
                    </div>

                    {/* Study Lookup Section */}
                    <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Orthanc PACS Study Lookup</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Authoritative Accession: {context.accessionNumber} | Patient ID: {context.patientId}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => lookupMutation.mutate()}
                          disabled={lookupMutation.isPending || isPacsOffline}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 h-8 shadow-xs disabled:opacity-60"
                        >
                          {lookupMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isPacsOffline ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          {isPacsOffline ? 'ORTHANC OFFLINE' : 'CHECK ORTHANC FOR STUDY'}
                        </Button>
                      </div>

                      {/* Lookup Results Display */}
                      {lookupResult && (
                        <div className="pt-2 border-t border-slate-100">
                          {lookupResult.outcome === 'MATCHED' && lookupResult.metadata && (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                                  <span>PACS STUDY MATCHED</span>
                                </div>
                                {lookupResult.pacsStudyLink?.status === 'LINKED' ? (
                                  <Badge variant="success" className="text-[10px]">
                                    LINKED TO RIS ORDER
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => reconcileMutation.mutate()}
                                    disabled={reconcileMutation.isPending || isPacsOffline}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-7 disabled:opacity-60"
                                  >
                                    {reconcileMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Link2 className="w-3 h-3" />
                                    )}
                                    RECONCILE STUDY
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-mono bg-white/80 p-2.5 rounded border border-emerald-200">
                                <div><span className="text-slate-400">Orthanc ID:</span> {lookupResult.metadata.orthancStudyId}</div>
                                <div><span className="text-slate-400">Accession:</span> {lookupResult.metadata.accessionNumber}</div>
                                <div><span className="text-slate-400">Study UID:</span> {lookupResult.metadata.studyInstanceUid || '—'}</div>
                                <div><span className="text-slate-400">Patient ID:</span> {lookupResult.metadata.patientId} (Consistent)</div>
                                <div><span className="text-slate-400">Modality:</span> {lookupResult.metadata.modalitiesInStudy.join(', ') || '—'}</div>
                                <div><span className="text-slate-400">Study Date:</span> {lookupResult.metadata.studyDate || '—'}</div>
                              </div>
                              <p className="text-[10px] text-emerald-800 italic">
                                Existing study found in Orthanc. (Images were not uploaded by this RIS).
                              </p>
                            </div>
                          )}

                          {lookupResult.outcome === 'NOT_FOUND' && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                              <strong className="text-slate-800 block">NO MATCHING STUDY IN ORTHANC</strong>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                Orthanc is connected, but no PACS study currently matches this RIS accession number ({context.accessionNumber}). This is expected until a real DICOM study exists in the PACS.
                              </p>
                            </div>
                          )}

                          {lookupResult.outcome === 'AMBIGUOUS_MATCH' && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                              <strong className="text-amber-900 block flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" /> PACS RECONCILIATION REQUIRED: AMBIGUOUS MATCH
                              </strong>
                              <p className="text-[11px] text-amber-800">
                                Multiple studies ({lookupResult.candidateStudies?.length || 2}+) in Orthanc match accession #{context.accessionNumber}. Automatic linking is prevented for clinical safety.
                              </p>
                            </div>
                          )}

                          {lookupResult.outcome === 'PATIENT_ID_MISMATCH' && (
                            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs space-y-1">
                              <strong className="text-rose-900 block flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" /> PACS RECONCILIATION REQUIRED: PATIENT ID MISMATCH
                              </strong>
                              <p className="text-[11px] text-rose-800">
                                PACS patient ID ({lookupResult.metadata?.patientId}) does not match RIS patient ID ({lookupResult.risPatientId}). Data modification is prevented.
                              </p>
                            </div>
                          )}

                          {lookupResult.outcome === 'ACCESSION_MISMATCH' && (
                            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs space-y-1">
                              <strong className="text-rose-900 block flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" /> PACS RECONCILIATION REQUIRED: ACCESSION MISMATCH
                              </strong>
                              <p className="text-[11px] text-rose-800">
                                PACS accession ({lookupResult.metadata?.accessionNumber}) differs from authoritative RIS accession ({lookupResult.risAccession}).
                              </p>
                            </div>
                          )}

                          {lookupResult.outcome === 'PACS_UNAVAILABLE' && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                              <strong className="text-amber-950 block flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                PACS UNAVAILABLE
                              </strong>
                              <p className="text-[11px] text-amber-900 leading-relaxed">
                                Orthanc is currently unreachable. RIS workflow data remains available.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Transfer Status Banner in Orthanc Mode */}
                    {context.orderStatus === 'PACS_READY' && (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-slate-600 text-[11px]">
                          Real Orthanc mode: Direct RIS DICOM upload is not implemented. Handoff is simulated only in mock mode.
                        </span>
                        <Badge variant="outline" className="text-[10px] text-slate-500 font-mono">
                          TRANSFER NOT APPLICABLE
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                /* Simulated PACS Integration Card */
                <div className="border border-indigo-200 rounded-xl p-5 bg-gradient-to-b from-indigo-50/50 to-white space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">PACS Integration — SIMULATED</h4>
                          <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                            Demo PACS Adapter
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          RIS-side study context reconciliation & handoff dispatch
                        </p>
                      </div>
                    </div>
                    {context.pacsHandoff && (
                      <Badge
                        variant={
                          context.pacsHandoff.status === 'COMPLETE'
                            ? 'success'
                            : context.pacsHandoff.status === 'FAILED'
                            ? 'destructive'
                            : context.pacsHandoff.status === 'PENDING'
                            ? 'warning'
                            : 'info'
                        }
                        className="font-mono text-[10px]"
                      >
                        {context.pacsHandoff.status}
                      </Badge>
                    )}
                  </div>

                  {/* Informational Callout */}
                  <p className="text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-indigo-100/70 leading-relaxed">
                    <strong>Interoperability Notice:</strong> This project simulates RIS-side handoff orchestration. Real DICOM C-STORE and PACS storage networks are not connected. Server-side accession reconciliation validates study context before acknowledgment.
                  </p>

                  {/* Case A: PACS_READY - Needs Initiation */}
                  {context.orderStatus === 'PACS_READY' && (
                    <div className="flex items-center justify-between p-3.5 bg-sky-50 border border-sky-200 rounded-lg">
                      <div>
                        <strong className="text-xs text-sky-950 block">Ready for Downstream Dispatch</strong>
                        <span className="text-[11px] text-sky-800">
                          Reconciliation satisfied for accession #{context.accessionNumber}. Click below to dispatch handoff request.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => initiatePacsMutation.mutate()}
                        disabled={initiatePacsMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                      >
                        {initiatePacsMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        INITIATE PACS HANDOFF
                      </Button>
                    </div>
                  )}

                  {/* Case B: PACS_HANDOFF_PENDING */}
                  {context.orderStatus === 'PACS_HANDOFF_PENDING' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-2">
                      <Loader2 className="w-5 h-5 text-amber-600 animate-spin mx-auto" />
                      <strong className="text-xs text-amber-950 block">PACS HANDOFF PENDING</strong>
                      <p className="text-[11px] text-amber-800 max-w-md mx-auto">
                        RIS-side simulated handoff is being processed by the configured demo PACS adapter.
                      </p>
                    </div>
                  )}

                  {/* Case C: PACS_HANDOFF_FAILED */}
                  {context.orderStatus === 'PACS_HANDOFF_FAILED' && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>PACS HANDOFF FAILED</span>
                        </div>
                        <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                          {context.pacsHandoff?.lastErrorCode || 'FAILED'}
                        </span>
                      </div>

                      <p className="text-[11px] text-rose-800 leading-normal">
                        {context.pacsHandoff?.lastErrorMessage || 'Simulated gateway encountered a connection error.'}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 text-[11px] text-slate-600">
                        <span>Total Attempts: <strong>{context.pacsHandoff?.attemptCount}</strong></span>
                        <Button
                          size="sm"
                          onClick={() => retryPacsMutation.mutate()}
                          disabled={retryPacsMutation.isPending}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 h-7 shadow-xs"
                        >
                          {retryPacsMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          RETRY HANDOFF
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Case D: PACS_HANDOFF_COMPLETE */}
                  {context.orderStatus === 'PACS_HANDOFF_COMPLETE' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>PACS HANDOFF COMPLETE</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-normal">
                        Simulated PACS acknowledgment recorded for accession #{context.accessionNumber}. Attempt #{context.pacsHandoff?.attemptCount} succeeded.
                      </p>
                      {context.pacsHandoff?.completedAt && (
                        <span className="text-[10px] text-emerald-700 block font-mono">
                          Completed At: {new Date(context.pacsHandoff.completedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attempt History List */}
                  {context.pacsHandoff?.attempts && context.pacsHandoff.attempts.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        Handoff Attempt Log ({context.pacsHandoff.attempts.length})
                      </span>
                      <div className="space-y-1">
                        {context.pacsHandoff.attempts.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={att.outcome === 'SUCCESS' ? 'success' : 'destructive'}
                                className="text-[9px] h-4 px-1"
                              >
                                #{att.attemptNumber} {att.outcome}
                              </Badge>
                              {att.errorMessage && (
                                <span className="text-slate-600 truncate max-w-xs">{att.errorMessage}</span>
                              )}
                            </div>
                            <span className="text-slate-400 text-[10px] font-mono">
                              {new Date(att.startedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {/* AUDITABLE ACQUISITION ATTEMPT HISTORY SECTION */}
            {context.attemptHistory && context.attemptHistory.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Acquisition Attempt History ({context.attemptHistory.length})
                </span>
                <div className="space-y-2">
                  {context.attemptHistory.map((item) => (
                    <div
                      key={item.scanLifecycleId}
                      className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900">Attempt #{item.attemptNumber}</strong>
                          <Badge variant="outline" className="text-[10px]">
                            {item.state}
                          </Badge>
                          {item.qaStatus && (
                            <Badge
                              variant={
                                item.qaStatus === 'ACCEPTED'
                                  ? 'success'
                                  : item.qaStatus === 'REPEAT_REQUIRED'
                                  ? 'warning'
                                  : 'destructive'
                              }
                              className="text-[10px]"
                            >
                              QA: {item.qaStatus}
                            </Badge>
                          )}
                          {item.pacsStatus && (
                            <Badge variant="info" className="text-[10px]">
                              PACS: {item.pacsStatus}
                            </Badge>
                          )}
                        </div>
                        {item.qaReasonCode && (
                          <span className="text-[11px] text-slate-500 block">
                            Reason: <strong>{item.qaReasonCode}</strong>
                            {item.qaNotes ? ` — "${item.qaNotes}"` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


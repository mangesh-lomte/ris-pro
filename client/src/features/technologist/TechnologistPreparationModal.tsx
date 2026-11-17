import { useState, useEffect } from 'react';
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
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { technologistService } from '../../services/technologistService';
import { formatDate } from '../../utils/formatters';
import {
  ConsentStatus,
  FastingStatus,
  ImagingProtocol,
  DocumentCategory,
  OrderDocumentData,
} from '../../types';
import { ApiError } from '../../lib/api';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Loader2,
  Syringe,
  Lock,
  Upload,
  Download,
  Trash2,
  Paperclip,
  FileUp,
} from 'lucide-react';

interface TechnologistPreparationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onSuccess?: () => void;
}

export function TechnologistPreparationModal({
  open,
  onOpenChange,
  examId,
  onSuccess,
}: TechnologistPreparationModalProps) {
  const queryClient = useQueryClient();

  // Load preparation context, requirements, existing record, and eligible protocols
  const { data: context, isLoading, error } = useQuery({
    queryKey: ['technologist', 'preparation', examId],
    queryFn: () => (examId ? technologistService.getPreparation(examId) : null),
    enabled: !!examId && open,
  });

  // Checklist Form State
  const [fastingStatus, setFastingStatus] = useState<FastingStatus>('NOT_REQUIRED');
  const [ivReady, setIvReady] = useState<boolean>(false);
  const [contrastReady, setContrastReady] = useState<boolean>(false);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('NOT_REQUIRED');
  const [additionalPreparationComplete, setAdditionalPreparationComplete] = useState<boolean>(false);
  const [preparationNotes, setPreparationNotes] = useState<string>('');

  // Protocol Selection State
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Supporting Documents State & Query (Requirement 7)
  const {
    data: documents = [],
    isLoading: isDocsLoading,
    refetch: refetchDocuments,
  } = useQuery<OrderDocumentData[]>({
    queryKey: ['technologist', 'documents', examId],
    queryFn: () => (examId ? technologistService.getDocuments(examId) : Promise.resolve([])),
    enabled: !!examId && open,
  });

  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('REFERRAL');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [docActionError, setDocActionError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocActionError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileBase64(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setDocActionError('File size exceeds the 5 MB maximum limit.');
      e.target.value = '';
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setDocActionError('Invalid file type. Allowed formats: PDF, JPEG, PNG, WebP.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setDocActionError('Failed to read file contents.');
    };
    reader.readAsDataURL(file);
  };

  const uploadDocMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      if (!selectedFile || !fileBase64) throw new Error('Please select a file to upload');
      return technologistService.uploadDocument(examId, {
        category: uploadCategory,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileBase64,
        notes: uploadNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSelectedFile(null);
      setFileBase64(null);
      setUploadNotes('');
      setDocActionError(null);
      refetchDocuments();
    },
    onError: (err: unknown) => {
      setDocActionError(err instanceof Error ? err.message : 'Failed to upload document');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.deleteDocument(examId, docId);
    },
    onSuccess: () => {
      setDocActionError(null);
      refetchDocuments();
    },
    onError: (err: unknown) => {
      setDocActionError(err instanceof Error ? err.message : 'Failed to delete document');
    },
  });

  const handleDownloadDoc = async (doc: OrderDocumentData) => {
    if (!examId) return;
    try {
      setDownloadingDocId(doc.id);
      setDocActionError(null);
      await technologistService.downloadDocument(examId, doc.id, doc.fileName);
    } catch (err: unknown) {
      setDocActionError(err instanceof Error ? err.message : 'Failed to download document');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryBadge = (category: DocumentCategory) => {
    switch (category) {
      case 'REFERRAL':
        return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]">Referral</Badge>;
      case 'LAB_RESULT':
        return <Badge variant="outline" className="text-cyan-700 bg-cyan-50 border-cyan-200 text-[10px]">Lab Value</Badge>;
      case 'CONSENT':
        return <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">Consent</Badge>;
      case 'PREVIOUS_REPORT':
        return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]">Previous Report</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-700 bg-slate-50 border-[#E2E8F0] text-[10px]">Other</Badge>;
    }
  };

  // Sync state when context loads
  useEffect(() => {
    if (context?.preparation) {
      setFastingStatus(context.preparation.fastingStatus || 'NOT_REQUIRED');
      setIvReady(Boolean(context.preparation.ivReady));
      setContrastReady(Boolean(context.preparation.contrastReady));
      setConsentStatus(context.preparation.consentStatus || 'NOT_REQUIRED');
      setAdditionalPreparationComplete(Boolean(context.preparation.additionalPreparationComplete));
      setPreparationNotes(context.preparation.preparationNotes || '');
    } else if (context) {
      setFastingStatus(context.requirements.fastingRequired ? 'NOT_CONFIRMED' : 'NOT_REQUIRED');
      setIvReady(false);
      setContrastReady(false);
      setConsentStatus(context.requirements.consentRequired ? 'NOT_CONFIRMED' : 'NOT_REQUIRED');
      setAdditionalPreparationComplete(false);
      setPreparationNotes('');
    }

    if (context?.confirmedProtocol) {
      setSelectedProtocolId(context.confirmedProtocol.id);
    } else if (context?.eligibleProtocols && context.eligibleProtocols.length > 0 && !selectedProtocolId) {
      setSelectedProtocolId(context.eligibleProtocols[0]!.id);
    }
  }, [context]);

  // Client-side completeness preview (backend remains authoritative)
  const isPreparationComplete = Boolean(
    context?.isSafetyCleared &&
      (!context?.requirements.fastingRequired || fastingStatus === 'CONFIRMED') &&
      (!context?.requirements.ivRequired || ivReady) &&
      (!context?.requirements.contrastPreparationRequired || contrastReady) &&
      (!context?.requirements.consentRequired || consentStatus === 'CONFIRMED') &&
      (!context?.requirements.additionalPreparationRequired || additionalPreparationComplete)
  );

  const isReadyForScan = context?.orderStatus === 'READY_FOR_SCAN';

  const handleMutationError = (err: unknown, defaultMessage: string) => {
    const isConflict =
      (err instanceof ApiError && err.statusCode === 409) ||
      (err as { statusCode?: number })?.statusCode === 409;
    if (isConflict) {
      setSubmissionError('This workflow changed in another session. Refreshing current status.');
      queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'preparation', examId] });
    } else {
      setSubmissionError(err instanceof Error ? err.message : defaultMessage);
    }
  };

  // Save Preparation Mutation
  const savePreparationMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      return technologistService.savePreparation(examId, {
        fastingStatus,
        ivReady,
        contrastReady,
        consentStatus,
        additionalPreparationComplete,
        preparationNotes: preparationNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'preparation', examId] });
      setSubmissionError(null);
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to save preparation checklist');
    },
  });

  // Confirm Protocol Mutation (Advances to READY_FOR_SCAN)
  const confirmProtocolMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam ID');
      if (!selectedProtocolId) throw new Error('Please select an approved protocol');
      return technologistService.confirmProtocol(examId, selectedProtocolId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail'] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'preparation', examId] });
      setSubmissionError(null);
      if (onSuccess) onSuccess();
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Failed to confirm protocol');
    },
  });

  if (!open || !examId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <DialogContent>
        {/* Header (Section 36) */}
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Patient Preparation & Workflow Protocol Selection</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clinical Pre-Acquisition Preparation Gate
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {context && (
                <>
                  <Badge
                    variant={
                      context.safetyStatus === 'CLEARED'
                        ? 'success'
                        : context.safetyStatus === 'REQUIRES_REVIEW'
                        ? 'destructive'
                        : 'warning'
                    }
                    className="font-bold text-[10px]"
                  >
                    SAFETY: {context.safetyStatus.replace(/_/g, ' ')}
                  </Badge>

                  <Badge
                    variant={
                      isReadyForScan
                        ? 'success'
                        : context.preparationStatus === 'COMPLETE'
                        ? 'success'
                        : context.preparationStatus === 'IN_PROGRESS'
                        ? 'cyan'
                        : 'secondary'
                    }
                    className="font-bold text-[10px]"
                  >
                    PREP: {context.preparationStatus.replace(/_/g, ' ')}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-20 bg-slate-100 rounded animate-pulse" />
            <div className="h-32 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : error || !context ? (
          <div className="p-6 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-semibold text-sm">Failed to load preparation checklist</p>
            <p className="text-xs text-slate-500">
              {error instanceof Error ? error.message : 'Please check your network and session.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Prominent Metadata Card (Single Source of Truth) */}
            <div className="p-4 bg-slate-900 text-white rounded shadow-sm border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Clinical Identifiers & Order Metadata (Immutable)</span>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={context.priority} />
                  <Badge variant="outline" className="text-cyan-300 border-cyan-800 text-[10px]">
                    {context.modality}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Patient Name
                  </span>
                  <span className="font-semibold text-slate-200">
                    {context.patient.firstName} {context.patient.lastName}
                  </span>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Patient ID (MRN)
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
                    Date of Birth
                  </span>
                  <span className="font-medium text-slate-300">
                    {formatDate(context.patient.dateOfBirth)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 pt-1 flex items-center justify-between border-t border-slate-800">
                <span className="font-medium text-slate-200">{context.examinationName}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Order Status: <strong className="text-amber-400">{context.orderStatus}</strong>
                </span>
              </div>
            </div>

            {/* Authoritative Safety Gate Status (Section 4 & Section 34) */}
            {!context.isSafetyCleared ? (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded space-y-2">
                <div className="flex items-center gap-2.5 text-rose-900 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Clinical Review Required Before Preparation</span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Patient safety screening is in status{' '}
                  <strong className="underline">{context.safetyStatus}</strong> and has not been cleared.
                  All preparation actions and protocol confirmations are strictly locked until a credentialed clinician reviews contraindications.
                </p>
                <div className="text-[11px] text-rose-700 font-semibold pt-1">
                  * Safety Gate Policy: No overrides or bypass options permitted for any role (including Admin).
                </div>
              </div>
            ) : isReadyForScan ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-emerald-950 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Workflow Milestone: READY FOR SCAN</span>
                  </div>
                  <Badge variant="success" className="font-bold text-xs bg-emerald-700 text-white">
                    READY FOR SCAN
                  </Badge>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Patient preparation is complete and approved workflow protocol{' '}
                  <strong className="font-mono">{context.confirmedProtocol?.code}</strong> (
                  {context.confirmedProtocol?.name}) has been confirmed.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 pt-1 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Protocol configuration is locked. This exam is cleared for scanner room transfer.</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Patient Identity & Safety Screening CLEARED. Authorized for patient preparation.</span>
                </div>
                <Badge variant="success" className="text-[10px]">
                  SAFETY CLEARED
                </Badge>
              </div>
            )}

            {/* Preparation Requirements & Checklist Form */}
            <div className="border border-[#E2E8F0] rounded p-4 bg-white space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Patient Preparation Checklist
                </span>
                <span className="text-[11px] text-slate-500">
                  {context.requirements.fastingRequired ||
                  context.requirements.ivRequired ||
                  context.requirements.contrastPreparationRequired ||
                  context.requirements.consentRequired
                    ? 'Exam-specific clinical requirements detected'
                    : 'Standard non-contrast preparation'}
                </span>
              </div>

              <div className="space-y-3">
                {/* 1. Fasting Requirement */}
                {context.requirements.fastingRequired ? (
                  <div className="p-3 rounded border border-[#E2E8F0] bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-900 block">
                          Patient Fasting Status
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Fasting required by examination protocol configuration.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(['CONFIRMED', 'NOT_CONFIRMED', 'UNKNOWN'] as FastingStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={!context.isSafetyCleared || isReadyForScan}
                            onClick={() => setFastingStatus(st)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                              fastingStatus === st
                                ? st === 'CONFIRMED'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                            }`}
                          >
                            {st.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded border border-slate-100 bg-slate-50 text-slate-500 text-xs flex items-center justify-between">
                    <span>Fasting Requirement: None required for this examination.</span>
                    <Badge variant="outline" className="text-[10px]">
                      NOT REQUIRED
                    </Badge>
                  </div>
                )}

                {/* 2. IV Line Readiness */}
                {context.requirements.ivRequired ? (
                  <div className="p-3 rounded border border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-md">
                      <div className="flex items-center gap-1.5">
                        <Syringe className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span className="text-xs font-semibold text-slate-900">
                          Intravenous (IV) Access Ready
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Intravenous access confirmed ready.
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!context.isSafetyCleared || isReadyForScan}
                      onClick={() => setIvReady(!ivReady)}
                      className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        ivReady
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                      }`}
                    >
                      {ivReady ? 'IV READY' : 'MARK IV READY'}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded border border-slate-100 bg-slate-50 text-slate-500 text-xs flex items-center justify-between">
                    <span>Intravenous Access: None required for this examination.</span>
                    <Badge variant="outline" className="text-[10px]">
                      NOT REQUIRED
                    </Badge>
                  </div>
                )}

                {/* 3. Contrast Preparation Readiness */}
                {context.requirements.contrastPreparationRequired ? (
                  <div className="p-3 rounded border border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-md">
                      <span className="text-xs font-semibold text-slate-900 block">
                        Contrast Preparation Ready
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Contrast media confirmed ready for examination.
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!context.isSafetyCleared || isReadyForScan}
                      onClick={() => setContrastReady(!contrastReady)}
                      className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        contrastReady
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                      }`}
                    >
                      {contrastReady ? 'CONTRAST READY' : 'MARK READY'}
                    </button>
                  </div>
                ) : null}

                {/* 4. Informed Consent Confirmation */}
                {context.requirements.consentRequired ? (
                  <div className="p-3 rounded border border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
                    <div className="space-y-0.5 max-w-md">
                      <span className="text-xs font-semibold text-slate-900 block">
                        Informed Consent Confirmation
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Patient has verbally and clinically agreed to the ordered diagnostic examination.
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(['CONFIRMED', 'NOT_CONFIRMED'] as ConsentStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={!context.isSafetyCleared || isReadyForScan}
                          onClick={() => setConsentStatus(st)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                            consentStatus === st
                              ? st === 'CONFIRMED'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                          }`}
                        >
                          {st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 5. Additional Exam Instructions */}
                {context.requirements.additionalPreparationRequired && (
                  <div className="p-3 rounded border border-amber-200 bg-amber-50/60 space-y-2">
                    <span className="text-xs font-semibold text-amber-950 block">
                      Special Examination Instructions:
                    </span>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      {context.requirements.additionalPreparationInstructions}
                    </p>
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        disabled={!context.isSafetyCleared || isReadyForScan}
                        onClick={() =>
                          setAdditionalPreparationComplete(!additionalPreparationComplete)
                        }
                        className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors ${
                          additionalPreparationComplete
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                        }`}
                      >
                        {additionalPreparationComplete ? 'COMPLETED' : 'MARK COMPLETED'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 6. Technologist Notes */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Preparation Notes (Optional)
                  </label>
                  <textarea
                    disabled={!context.isSafetyCleared || isReadyForScan}
                    value={preparationNotes}
                    onChange={(e) => setPreparationNotes(e.target.value)}
                    placeholder="Enter accommodations or technologist clinical notes..."
                    rows={2}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500 resize-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Save Preparation Checklist Action */}
              {!isReadyForScan && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {isPreparationComplete ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        All preparation items satisfied. Saving marks status as COMPLETE.
                      </span>
                    ) : (
                      <span>Pending requirements keep preparation in status IN PROGRESS.</span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    disabled={
                      !context.isSafetyCleared ||
                      savePreparationMutation.isPending ||
                      confirmProtocolMutation.isPending
                    }
                    onClick={() => savePreparationMutation.mutate()}
                    className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                  >
                    {savePreparationMutation.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Save Preparation Checklist</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Supporting Documents Section (Requirement 7: Attach referral, lab values, consent and previous reports) */}
            <div className="border border-[#E2E8F0] rounded p-4 bg-white space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-[#2563EB]" />
                    Supporting Clinical Documents
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Attach and review referral letters, lab values (Creatinine/eGFR), signed consent forms, and previous imaging reports.
                  </p>
                </div>

                <Badge variant="outline" className="font-bold text-[10px] text-slate-700">
                  {documents.length} {documents.length === 1 ? 'FILE' : 'FILES'} ATTACHED
                </Badge>
              </div>

              {/* Upload Form */}
              <div className="p-3 bg-slate-50 rounded border border-[#E2E8F0] space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <FileUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attach New Document</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Document Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                      className="w-full text-xs rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="REFERRAL">Referral Letter / Order</option>
                      <option value="LAB_RESULT">Lab Value (Creatinine / eGFR)</option>
                      <option value="CONSENT">Signed Consent Form</option>
                      <option value="PREVIOUS_REPORT">Previous Imaging / Report</option>
                      <option value="OTHER">Other Clinical Document</option>
                    </select>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      File <span className="text-[10px] text-slate-400 font-normal">(PDF, PNG, JPG, WebP &le;5MB)</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Clinical Notes <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., eGFR 78 mL/min"
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        className="w-full text-xs rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Button
                        size="sm"
                        disabled={!selectedFile || uploadDocMutation.isPending}
                        onClick={() => uploadDocMutation.mutate()}
                        className="shrink-0 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white gap-1.5"
                      >
                        {uploadDocMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Upload</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {docActionError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{docActionError}</span>
                  </div>
                )}
              </div>

              {/* Documents List */}
              {isDocsLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-slate-400" />
                  Loading attached documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="p-4 text-center rounded border border-dashed border-[#E2E8F0] bg-slate-50/50 text-slate-500 text-xs">
                  No documents attached yet. Technologists can upload patient referrals, lab results, consent, or prior reports above.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-[#E2E8F0] rounded overflow-hidden">
                  {documents.map((doc: OrderDocumentData) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {getCategoryBadge(doc.category)}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>{formatDate(doc.uploadedAt)}</span>
                            {doc.uploadedByUser && (
                              <>
                                <span>•</span>
                                <span>
                                  {doc.uploadedByUser.firstName} {doc.uploadedByUser.lastName}
                                </span>
                              </>
                            )}
                            {doc.notes && (
                              <>
                                <span>•</span>
                                <span className="italic text-slate-600 truncate max-w-[200px]" title={doc.notes}>
                                  &ldquo;{doc.notes}&rdquo;
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingDocId === doc.id}
                          onClick={() => handleDownloadDoc(doc)}
                          className="h-7 px-2 text-xs text-slate-700 hover:text-slate-900 border-[#E2E8F0] gap-1"
                        >
                          {downloadingDocId === doc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3 text-slate-500" />
                          )}
                          <span>Download</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteDocMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete document "${doc.fileName}"?`)) {
                              deleteDocMutation.mutate(doc.id);
                            }
                          }}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved Workflow Protocol Selection Section (Section 38 & 39) */}
            <div className="border border-[#E2E8F0] rounded p-4 bg-white space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#2563EB]" />
                    Approved Workflow Protocol Selection
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Modality-approved imaging protocols compatible with {context.modality}
                  </p>
                </div>

                <Badge
                  variant={
                    isReadyForScan
                      ? 'success'
                      : context.preparationStatus === 'COMPLETE'
                      ? 'success'
                      : 'warning'
                  }
                  className="font-bold text-[10px]"
                >
                  {isReadyForScan
                    ? 'PROTOCOL CONFIRMED'
                    : context.preparationStatus === 'COMPLETE'
                    ? 'SELECTION UNLOCKED'
                    : 'PREPARATION INCOMPLETE'}
                </Badge>
              </div>

              {/* Protocol Gate Reminder */}
              {!isReadyForScan && context.preparationStatus !== 'COMPLETE' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Protocol confirmation is locked. Complete all required patient preparation checklist items above to enable confirmation.
                  </span>
                </div>
              )}

              {/* Protocol Catalog List */}
              <div className="space-y-2">
                {context.eligibleProtocols.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No active protocols cataloged for modality {context.modality}.
                  </p>
                ) : (
                  context.eligibleProtocols.map((proto: ImagingProtocol) => {
                    const isSelected = selectedProtocolId === proto.id;
                    const isConfirmed = context.confirmedProtocol?.id === proto.id;

                    return (
                      <div
                        key={proto.id}
                        onClick={() => {
                          if (!isReadyForScan && context.isSafetyCleared) {
                            setSelectedProtocolId(proto.id);
                          }
                        }}
                        className={`p-3 rounded border transition-all cursor-pointer ${
                          isConfirmed
                            ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400'
                            : isSelected
                            ? 'bg-blue-50/80 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-[#E2E8F0] hover:border-slate-300'
                        } ${isReadyForScan ? 'cursor-default' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {proto.code}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {proto.modality}
                              </Badge>
                              <Badge variant="success" className="text-[10px]">
                                Approved v{proto.version}
                              </Badge>
                              {proto.bodyPart && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  • {proto.bodyPart}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-800 font-semibold">{proto.name}</p>
                            {proto.description && (
                              <p className="text-[11px] text-slate-500 leading-snug">
                                {proto.description}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-500">
                              Approved {new Date(proto.approvedAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="shrink-0 pt-0.5">
                            {isConfirmed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED
                              </span>
                            ) : (
                              <input
                                type="radio"
                                name="protocol"
                                checked={isSelected}
                                disabled={isReadyForScan || !context.isSafetyCleared}
                                onChange={() => setSelectedProtocolId(proto.id)}
                                className="h-4 w-4 text-[#2563EB] focus:ring-indigo-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Final Confirmation CTA Card (Section 39) */}
              {!isReadyForScan && (
                <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded space-y-3 pt-3">
                  <div className="text-xs space-y-1 text-slate-700">
                    <div className="font-semibold text-slate-900">Pre-Acquisition Gate Summary:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1">
                      <div>
                        Patient ID: <strong>{context.patient.patientId}</strong>
                      </div>
                      <div>
                        Accession: <strong>{context.accessionNumber}</strong>
                      </div>
                      <div>
                        Safety Status:{' '}
                        <strong className="text-emerald-700">{context.safetyStatus}</strong>
                      </div>
                      <div>
                        Preparation Status:{' '}
                        <strong
                          className={
                            context.preparationStatus === 'COMPLETE'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {context.preparationStatus}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col items-center gap-1.5">
                    <Button
                      size="lg"
                      disabled={
                        !context.isSafetyCleared ||
                        context.preparationStatus !== 'COMPLETE' ||
                        !selectedProtocolId ||
                        confirmProtocolMutation.isPending
                      }
                      onClick={() => confirmProtocolMutation.mutate()}
                      className="w-full font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-2 h-10"
                    >
                      {confirmProtocolMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      <span>CONFIRM PROTOCOL & MARK READY FOR SCAN</span>
                    </Button>
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                      * Confirming protocol authorizes scanner transfer and arms acquisition parameters.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {submissionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submissionError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


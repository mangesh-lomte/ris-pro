import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../../services/radiologistService';
import {
  ReportingTemplateSummary,
  MeasurementReference,
  KeyImageReference,
  OhifMeasurementToolType,
} from '../../types';
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
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import {
  FileText,
  Save,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Lock,
  Mic,
  Square,
  Volume2,
  Ruler,
  Image as ImageIcon,
  Trash2,
  Eye,
  Plus,
  Users,
  History,
  PlusCircle,
  ShieldCheck,
  FileDown,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { ReportVersionHistoryModal } from './ReportVersionHistoryModal';
import { ReportAmendmentModal } from './ReportAmendmentModal';
import { ReportReviewSignModal } from './ReportReviewSignModal';
import {
  defaultSpeechProvider,
  insertTranscriptIntoSection,
  DictationState,
} from '../../services/speechRecognitionService';
import { formatDate } from '../../utils/formatters';
import { PeerReviewRequestModal } from './PeerReviewRequestModal';
import { PeerReviewDetailModal } from './PeerReviewDetailModal';
import { CriticalFindingRequestModal } from './CriticalFindingRequestModal';
import { CriticalFindingDetailModal } from './CriticalFindingDetailModal';

interface RadiologistReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export const RadiologistReportModal: React.FC<RadiologistReportModalProps> = ({
  open,
  onOpenChange,
  orderId,
}) => {
  const queryClient = useQueryClient();

  // Selected template for new draft
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Structured draft content state
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [draftVersion, setDraftVersion] = useState<number>(1);

  // Phase 4.5 — Measurements and Key Image References
  const [measurements, setMeasurements] = useState<MeasurementReference[]>([]);
  const [keyImages, setKeyImages] = useState<KeyImageReference[]>([]);

  // Dialog & Form states for Adding Measurement & Key Image
  const [showAddMeasurementDialog, setShowAddMeasurementDialog] = useState(false);
  const [showAddKeyImageDialog, setShowAddKeyImageDialog] = useState(false);

  // Phase 4.6 — Peer Review / Second Opinion states
  const [isPeerReviewRequestOpen, setIsPeerReviewRequestOpen] = useState(false);
  const [isPeerReviewDetailOpen, setIsPeerReviewDetailOpen] = useState(false);

  const { data: orderPeerReview } = useQuery({
    queryKey: ['orderPeerReview', orderId],
    queryFn: () => radiologistService.getOrderPeerReview(orderId!),
    enabled: open && !!orderId,
  });

  // Phase 4.7 — Critical Findings Alert states
  const [isCriticalFindingRequestOpen, setIsCriticalFindingRequestOpen] = useState(false);
  const [isCriticalFindingDetailOpen, setIsCriticalFindingDetailOpen] = useState(false);

  const { data: orderCriticalFinding } = useQuery({
    queryKey: ['orderCriticalFinding', orderId],
    queryFn: () => radiologistService.getOrderCriticalFinding(orderId!),
    enabled: open && !!orderId,
  });

  // Phase 4.8 — Report Corrections & Addenda states
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isAmendmentModalOpen, setIsAmendmentModalOpen] = useState(false);
  const [amendmentModalType, setAmendmentModalType] = useState<'CORRECTION' | 'ADDENDUM'>('CORRECTION');

  // Phase 4.9 — Final Report Review, Sign & Lock states
  const [isReviewSignModalOpen, setIsReviewSignModalOpen] = useState(false);

  // Phase 4.10 — PDF Report Generation states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfNotification, setPdfNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleGeneratePdf = async () => {
    if (!orderId || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfNotification(null);
    try {
      const res = await radiologistService.generateReportPdf(orderId);
      setPdfNotification({
        type: 'success',
        message: `Report PDF generated successfully (${(res.fileSizeBytes / 1024).toFixed(1)} KB) • ${res.filename}`,
      });
      queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
      await radiologistService.downloadReportPdf(orderId, res.filename);
    } catch (err: any) {
      setPdfNotification({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to generate report PDF',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const [isSendingToReception, setIsSendingToReception] = useState(false);

  const handleSendToReception = async () => {
    if (!orderId || isSendingToReception) return;
    setIsSendingToReception(true);
    setPdfNotification(null);
    try {
      await receptionDeliveryService.sendReportToReception(orderId);
      setPdfNotification({
        type: 'success',
        message: 'Report successfully marked ready for front-desk / reception delivery.',
      });
      queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
      queryClient.invalidateQueries({ queryKey: ['receptionReadyReports'] });
    } catch (err: any) {
      setPdfNotification({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to send report to reception',
      });
    } finally {
      setIsSendingToReception(false);
    }
  };

  const [mToolType, setMToolType] = useState<OhifMeasurementToolType>('Length');
  const [mLabel, setMLabel] = useState('');
  const [mValue, setMValue] = useState('');
  const [mUnit, setMUnit] = useState('mm');
  const [mSeriesUid, setMSeriesUid] = useState('');
  const [mSopUid, setMSopUid] = useState('');
  const [mFinding, setMFinding] = useState('');

  const [kLabel, setKLabel] = useState('');
  const [kSeriesUid, setKSeriesUid] = useState('');
  const [kSopUid, setKSopUid] = useState('');
  const [kDescription, setKDescription] = useState('');

  // Save status states
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  >('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Autosave debounce timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 4.4 — Dictation / Speech-to-Text State
  const [dictationState, setDictationState] = useState<DictationState>(() =>
    defaultSpeechProvider.isSupported() ? 'ready' : 'unavailable'
  );
  const [dictationMessage, setDictationMessage] = useState<string | null>(() =>
    defaultSpeechProvider.isSupported()
      ? null
      : 'Speech-to-text is not available in this browser.'
  );
  const [targetSection, setTargetSection] = useState<string>('Findings');
  const [hearingPreview, setHearingPreview] = useState<string>('');

  // Fresh mutable refs for async recognition callbacks
  const draftContentRef = useRef<Record<string, string>>(draftContent);
  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  const draftVersionRef = useRef<number>(draftVersion);
  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);

  const targetSectionRef = useRef<string>(targetSection);
  useEffect(() => {
    targetSectionRef.current = targetSection;
  }, [targetSection]);

  const measurementsRef = useRef<MeasurementReference[]>(measurements);
  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  const keyImagesRef = useRef<KeyImageReference[]>(keyImages);
  useEffect(() => {
    keyImagesRef.current = keyImages;
  }, [keyImages]);

  const cursorPositionsRef = useRef<Record<string, number>>({});

  // 1. Fetch Report Workspace Context
  const {
    data: workspace,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['radiologistReportWorkspace', orderId],
    queryFn: () => radiologistService.getReportWorkspace(orderId!),
    enabled: !!orderId && open,
    staleTime: 0,
  });

  // Phase 4.8 — Version History Summary Query (only enabled when report is finalized)
  const { data: versionHistorySummary } = useQuery({
    queryKey: ['reportVersionHistory', orderId],
    queryFn: () => radiologistService.getReportVersionHistory(orderId!),
    enabled: open && !!orderId && !!workspace?.finalizedReport,
  });

  // Phase 4.5 — Fetch Study Instances for Measurement & Key Image linking
  const { data: studyInstancesData } = useQuery({
    queryKey: ['radiologistStudyInstances', orderId],
    queryFn: () => radiologistService.getStudyInstances(orderId!),
    enabled: !!orderId && open,
    staleTime: 30000,
  });

  // Initialize selected series and instance defaults once instances load
  useEffect(() => {
    if (studyInstancesData?.series && studyInstancesData.series.length > 0) {
      const firstSeries = studyInstancesData.series[0];
      if (!mSeriesUid) setMSeriesUid(firstSeries.seriesInstanceUid);
      if (!kSeriesUid) setKSeriesUid(firstSeries.seriesInstanceUid);

      if (firstSeries.instances.length > 0) {
        if (!mSopUid) setMSopUid(firstSeries.instances[0].sopInstanceUid);
        if (!kSopUid) setKSopUid(firstSeries.instances[0].sopInstanceUid);
      }
    }
  }, [studyInstancesData, mSeriesUid, kSeriesUid, mSopUid, kSopUid]);

  // Synchronize local state when workspace data arrives
  useEffect(() => {
    if (workspace) {
      if (workspace.draft) {
        setDraftContent(workspace.draft.content || {});
        setDraftVersion(workspace.draft.version);
        setMeasurements(workspace.draft.measurements || []);
        setKeyImages(workspace.draft.keyImages || []);
        setSaveStatus('saved');
        if (workspace.draft.lastAutosavedAt || workspace.draft.updatedAt) {
          const date = new Date(
            workspace.draft.lastAutosavedAt || workspace.draft.updatedAt
          );
          setLastSavedTime(date.toLocaleTimeString());
        }
      } else {
        // No draft yet - set default template if available
        setDraftContent({});
        setDraftVersion(1);
        setMeasurements([]);
        setKeyImages([]);
        setSaveStatus('idle');
        const recommended = workspace.templates.find((t) => t.isRecommended);
        if (recommended) {
          setSelectedTemplateId(recommended.id);
        } else if (workspace.templates.length > 0) {
          setSelectedTemplateId(workspace.templates[0].id);
        }
      }
    }
  }, [workspace]);

  // Clean up debounce timer and dictation on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      defaultSpeechProvider.abort();
    };
  }, []);

  // Stop dictation when modal closes
  useEffect(() => {
    if (!open) {
      defaultSpeechProvider.abort();
      setDictationState(defaultSpeechProvider.isSupported() ? 'ready' : 'unavailable');
      setHearingPreview('');
    }
  }, [open]);

  // Synchronize target dictation section with loaded draft content
  useEffect(() => {
    if (workspace?.draft?.content) {
      const keys = Object.keys(workspace.draft.content);
      if (keys.length > 0 && (!targetSection || !keys.includes(targetSection))) {
        const findingsKey = keys.find((k) => k.toLowerCase().includes('findings'));
        const initial = findingsKey || keys[0];
        setTargetSection(initial);
        targetSectionRef.current = initial;
      }
    }
  }, [workspace?.draft?.content, targetSection]);

  // 2. Create Draft Mutation
  const createDraftMutation = useMutation({
    mutationFn: (templateId: string) =>
      radiologistService.createReportDraft(orderId!, { templateId }),
    onSuccess: (data) => {
      setDraftContent(data.draft.content);
      setDraftVersion(data.draft.version);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      setSaveErrorMessage(null);
      queryClient.invalidateQueries({
        queryKey: ['radiologistReportWorkspace', orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['radiologistStudyContext', orderId],
      });
    },
    onError: (err: any) => {
      setSaveStatus('error');
      setSaveErrorMessage(
        err?.message || 'Unable to initialize draft report from template.'
      );
    },
  });

  // 3. Manual Save Mutation
  const saveDraftMutation = useMutation({
    mutationFn: (payload: {
      version: number;
      content: Record<string, string>;
      measurements?: MeasurementReference[];
      keyImages?: KeyImageReference[];
    }) => radiologistService.saveReportDraft(orderId!, payload),
    onSuccess: (data) => {
      setDraftContent(data.draft.content);
      setDraftVersion(data.draft.version);
      setMeasurements(data.draft.measurements || []);
      setKeyImages(data.draft.keyImages || []);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      setSaveErrorMessage(null);
      queryClient.invalidateQueries({
        queryKey: ['radiologistReportWorkspace', orderId],
      });
    },
    onError: (err: any) => {
      if (
        err?.status === 409 ||
        err?.message?.includes('another tab') ||
        err?.code === 'REPORT_DRAFT_VERSION_CONFLICT'
      ) {
        setSaveStatus('conflict');
        setSaveErrorMessage(
          'This draft changed in another tab. Reload the latest version before saving.'
        );
      } else {
        setSaveStatus('error');
        setSaveErrorMessage(err?.message || 'Unable to save draft.');
      }
    },
  });

  // 4. Autosave Mutation
  const autosaveMutation = useMutation({
    mutationFn: (payload: {
      version: number;
      content: Record<string, string>;
      measurements?: MeasurementReference[];
      keyImages?: KeyImageReference[];
    }) => radiologistService.autosaveReportDraft(orderId!, payload),
    onSuccess: (data) => {
      setDraftContent(data.draft.content);
      setDraftVersion(data.draft.version);
      setMeasurements(data.draft.measurements || []);
      setKeyImages(data.draft.keyImages || []);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      setSaveErrorMessage(null);
      queryClient.invalidateQueries({
        queryKey: ['radiologistReportWorkspace', orderId],
      });
    },
    onError: (err: any) => {
      if (
        err?.status === 409 ||
        err?.message?.includes('another tab') ||
        err?.code === 'REPORT_DRAFT_VERSION_CONFLICT'
      ) {
        setSaveStatus('conflict');
        setSaveErrorMessage(
          'This draft changed in another tab. Reload the latest version before saving.'
        );
      } else {
        setSaveStatus('error');
        setSaveErrorMessage('Unable to save draft');
      }
    },
  });

  // 5. Open Images Viewer Launch
  const viewerWindowRef = useRef<Window | null>(null);

  const openImagesMutation = useMutation({
    mutationFn: () => radiologistService.getViewerLaunch(orderId!),
    onSuccess: (data) => {
      const win = window.open(data.viewerUrl, 'radaxis-pacs-viewer');
      if (win) {
        viewerWindowRef.current = win;
      }
    },
    onError: (err: any) => {
      setSaveErrorMessage(err?.message || 'Unable to launch PACS viewer.');
    },
  });

  // Trigger debounced autosave
  const triggerDebouncedAutosave = useCallback(
    (
      newContent: Record<string, string>,
      currentVersion: number,
      newMeasurements?: MeasurementReference[],
      newKeyImages?: KeyImageReference[]
    ) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        if (workspace?.draft) {
          setSaveStatus('saving');
          autosaveMutation.mutate({
            version: currentVersion,
            content: newContent,
            measurements: newMeasurements ?? measurementsRef.current,
            keyImages: newKeyImages ?? keyImagesRef.current,
          });
        }
      }, 1500);
    },
    [workspace?.draft, autosaveMutation]
  );

  // Real OHIF PACS Viewer Measurement & Key Image Event Bridge
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      // 1. Origin validation: Only allow PACS viewer origin or current origin
      const allowedOrigins = ['http://localhost:3002', window.location.origin];
      const isLocalhostViewer =
        typeof event.origin === 'string' &&
        (allowedOrigins.includes(event.origin) ||
          event.origin.startsWith('http://localhost:') ||
          event.origin.startsWith('http://127.0.0.1:'));
      if (!isLocalhostViewer) {
        return;
      }

      // 2. Source-window validation: Verify source matches opened viewer window if active
      if (viewerWindowRef.current && !viewerWindowRef.current.closed && event.source) {
        if (event.source !== viewerWindowRef.current) {
          return;
        }
      }

      // 3. Message type validation
      const isMeasurementMsg =
        event.data.type === 'RIS_MEASUREMENT_ADDED' ||
        event.data.type === 'RIS_MEASUREMENT_UPDATED' ||
        event.data.type === 'OHIF_MEASUREMENT_CAPTURED';

      const isKeyImageMsg =
        event.data.type === 'RIS_KEY_IMAGE_CAPTURED' ||
        event.data.type === 'OHIF_KEY_IMAGE_CAPTURED';

      if (!isMeasurementMsg && !isKeyImageMsg) return;

      // 4. Resolve current study instance UID for cross-study verification
      const currentStudyUid =
        workspace?.order?.studyInstanceUid ||
        studyInstancesData?.studyInstanceUid;

      // Handle real OHIF drawing tool measurement
      if (isMeasurementMsg) {
        const m = event.data.measurement as MeasurementReference;
        if (!m || !m.studyInstanceUid || !m.id) {
          return;
        }

        // Current study verification: strictly discard measurements from foreign studies
        if (currentStudyUid && m.studyInstanceUid.trim() !== currentStudyUid.trim()) {
          console.warn(`[RIS] Discarded measurement from foreign study: ${m.studyInstanceUid}`);
          return;
        }

        setMeasurements((prev) => {
          const existingIdx = prev.findIndex((item) => item.id === m.id);
          let updated: MeasurementReference[];
          if (existingIdx >= 0) {
            updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...m };
          } else {
            updated = [...prev, m];
          }
          measurementsRef.current = updated;

          triggerDebouncedAutosave(
            draftContentRef.current,
            draftVersionRef.current,
            updated,
            keyImagesRef.current
          );

          return updated;
        });
      }

      // Handle OHIF key image capture
      if (isKeyImageMsg) {
        const k = event.data.keyImage as KeyImageReference;
        if (!k || !k.studyInstanceUid) return;

        if (currentStudyUid && k.studyInstanceUid.trim() !== currentStudyUid.trim()) {
          console.warn(`[RIS] Discarded key image from foreign study: ${k.studyInstanceUid}`);
          return;
        }

        setKeyImages((prev) => {
          const existingIdx = prev.findIndex((item) => item.id === k.id);
          let updated: KeyImageReference[];
          if (existingIdx >= 0) {
            updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...k };
          } else {
            updated = [...prev, k];
          }
          keyImagesRef.current = updated;

          triggerDebouncedAutosave(
            draftContentRef.current,
            draftVersionRef.current,
            measurementsRef.current,
            updated
          );

          return updated;
        });
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [workspace?.order?.studyInstanceUid, studyInstancesData?.studyInstanceUid, triggerDebouncedAutosave]);

  // Field change handler
  const handleFieldChange = useCallback(
    (section: string, value: string) => {
      setDraftContent((prev) => {
        const updated = {
          ...prev,
          [section]: value,
        };
        draftContentRef.current = updated;

        // If active draft exists, trigger debounced autosave
        if (workspace?.draft && saveStatus !== 'conflict') {
          triggerDebouncedAutosave(updated, draftVersionRef.current);
        }
        return updated;
      });
      setSaveStatus('idle');
      setSaveErrorMessage(null);
    },
    [workspace?.draft, saveStatus, triggerDebouncedAutosave]
  );

  // Phase 4.4 — Transcript chunk handler
  const handleTranscriptChunk = useCallback(
    (chunk: string, isFinal: boolean) => {
      if (!isFinal) {
        setHearingPreview(chunk);
        return;
      }

      setHearingPreview('');
      const target = targetSectionRef.current;
      if (!target) return;

      const currentText = draftContentRef.current[target] || '';
      const currentCursor = cursorPositionsRef.current[target];

      const { newText, newCursor } = insertTranscriptIntoSection(
        currentText,
        chunk,
        currentCursor
      );

      cursorPositionsRef.current[target] = newCursor;
      handleFieldChange(target, newText);
    },
    [handleFieldChange]
  );

  // Phase 4.4 — Start Dictation handler
  const handleStartDictation = () => {
    if (dictationState === 'listening' || dictationState === 'processing') {
      return;
    }

    if (!defaultSpeechProvider.isSupported()) {
      setDictationState('unavailable');
      setDictationMessage('Speech-to-text is not available in this browser.');
      return;
    }

    setDictationState('listening');
    setDictationMessage(null);
    setHearingPreview('');

    // Non-blocking session start audit
    if (orderId) {
      radiologistService
        .recordDictationSession(orderId, {
          action: 'START',
          section: targetSectionRef.current,
        })
        .catch(() => {});
    }

    defaultSpeechProvider.start({
      onStateChange: (state, message) => {
        setDictationState(state);
        if (message) {
          setDictationMessage(message);
        }
      },
      onTranscriptChunk: handleTranscriptChunk,
      onError: (errorMessage, state) => {
        setHearingPreview('');
        setDictationState(state);
        setDictationMessage(errorMessage);
      },
    });
  };

  // Phase 4.4 — Stop Dictation handler
  const handleStopDictation = () => {
    defaultSpeechProvider.stop();
    setDictationState('stopped');
    setDictationMessage('Dictation stopped');
    setHearingPreview('');

    // Non-blocking session completion audit
    if (orderId) {
      radiologistService
        .recordDictationSession(orderId, {
          action: 'COMPLETE',
          section: targetSectionRef.current,
        })
        .catch(() => {});
    }
  };

  // Manual save handler
  const handleManualSave = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setSaveStatus('saving');
    saveDraftMutation.mutate({
      version: draftVersion,
      content: draftContent,
      measurements,
      keyImages,
    });
  };

  // Phase 4.5 — Launch PACS viewer directly for specific slice reference
  const handleViewReference = async (seriesUid: string, sopUid: string) => {
    try {
      const launch = await radiologistService.getViewerLaunch(orderId!);
      const url = new URL(launch.viewerUrl);
      url.searchParams.set('initialSeriesInstanceUID', seriesUid);
      url.searchParams.set('initialSOPInstanceUID', sopUid);
      const win = window.open(url.toString(), 'radaxis-pacs-viewer');
      if (win) {
        viewerWindowRef.current = win;
      }
    } catch (err: any) {
      setSaveErrorMessage(err?.message || 'Unable to open PACS reference.');
    }
  };

  // Phase 4.5 — Add Measurement handler
  const handleAddMeasurementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyInstancesData?.studyInstanceUid) {
      setSaveErrorMessage('Current study instance UID not resolved.');
      return;
    }
    const numVal = parseFloat(mValue);
    if (isNaN(numVal)) {
      setSaveErrorMessage('Please enter a valid numeric value for the measurement.');
      return;
    }

    const selectedSeries =
      studyInstancesData.series.find((s) => s.seriesInstanceUid === mSeriesUid) ||
      studyInstancesData.series[0];
    const selectedInst =
      selectedSeries?.instances.find((i) => i.sopInstanceUid === mSopUid) ||
      selectedSeries?.instances[0];

    const newM: MeasurementReference = {
      id: `meas-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      toolType: mToolType,
      label: mLabel.trim() || `${mToolType} Measurement`,
      numericValue: numVal,
      unit: mUnit.trim() || 'mm',
      studyInstanceUid: studyInstancesData.studyInstanceUid,
      seriesInstanceUid: mSeriesUid || selectedSeries?.seriesInstanceUid || '',
      sopInstanceUid: mSopUid || selectedInst?.sopInstanceUid || '',
      instanceNumber: selectedInst?.instanceNumber,
      sliceLocation: selectedInst?.sliceLocation,
      findingText: mFinding.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...measurements, newM];
    setMeasurements(updated);
    measurementsRef.current = updated;
    setShowAddMeasurementDialog(false);
    setMLabel('');
    setMValue('');
    setMFinding('');

    triggerDebouncedAutosave(draftContentRef.current, draftVersionRef.current, updated, keyImagesRef.current);
  };

  const handleRemoveMeasurement = (id: string) => {
    const updated = measurements.filter((m) => m.id !== id);
    setMeasurements(updated);
    measurementsRef.current = updated;
    triggerDebouncedAutosave(draftContentRef.current, draftVersionRef.current, updated, keyImagesRef.current);
  };

  // Phase 4.5 — Add Key Image handler
  const handleAddKeyImageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyInstancesData?.studyInstanceUid) {
      setSaveErrorMessage('Current study instance UID not resolved.');
      return;
    }

    const selectedSeries =
      studyInstancesData.series.find((s) => s.seriesInstanceUid === kSeriesUid) ||
      studyInstancesData.series[0];
    const selectedInst =
      selectedSeries?.instances.find((i) => i.sopInstanceUid === kSopUid) ||
      selectedSeries?.instances[0];

    const newK: KeyImageReference = {
      id: `keyimg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      studyInstanceUid: studyInstancesData.studyInstanceUid,
      seriesInstanceUid: kSeriesUid || selectedSeries?.seriesInstanceUid || '',
      sopInstanceUid: kSopUid || selectedInst?.sopInstanceUid || '',
      instanceNumber: selectedInst?.instanceNumber,
      sliceLocation: selectedInst?.sliceLocation,
      label: kLabel.trim() || `Key Image ${keyImages.length + 1}`,
      description: kDescription.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...keyImages, newK];
    setKeyImages(updated);
    keyImagesRef.current = updated;
    setShowAddKeyImageDialog(false);
    setKLabel('');
    setKDescription('');

    triggerDebouncedAutosave(draftContentRef.current, draftVersionRef.current, measurementsRef.current, updated);
  };

  const handleRemoveKeyImage = (id: string) => {
    const updated = keyImages.filter((k) => k.id !== id);
    setKeyImages(updated);
    keyImagesRef.current = updated;
    triggerDebouncedAutosave(draftContentRef.current, draftVersionRef.current, measurementsRef.current, updated);
  };

  // Reload handler for stale tab or refresh
  const handleReload = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setSaveStatus('idle');
    setSaveErrorMessage(null);
    refetch();
  };

  if (!open) return null;

  const draftExists = !!workspace?.draft;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} maxWidth="6xl" className="max-w-6xl w-[96vw]">
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header with Patient Demographics & Draft Status */}
        <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#152B42]">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                  <span>REPORTING WORKSPACE</span>
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 font-bold px-2.5 py-0.5 text-xs tracking-wider"
                >
                  DRAFT
                </Badge>
              </div>

              {workspace && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="font-semibold text-foreground text-sm">
                    {workspace.order.patientName}
                  </span>
                  <IdentifierPill type="patient" value={workspace.order.patientId} />
                  <IdentifierPill type="accession" value={workspace.order.accessionNumber} />
                  <Badge variant="outline" className="font-mono text-[11px] px-1.5">
                    {workspace.order.modality}
                  </Badge>
                  <span className="text-muted-foreground">• {workspace.order.bodyPart}</span>
                  <PriorityBadge priority={workspace.order.priority} />
                </div>
              )}
            </div>

            {/* Header Right: PACS Quick Launch & Save Status */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex items-center gap-1.5 border-indigo-300 text-blue-700 dark:text-indigo-300 hover:bg-blue-50 dark:hover:bg-indigo-950/50 font-medium shadow-xs"
                  onClick={() => openImagesMutation.mutate()}
                  disabled={openImagesMutation.isPending}
                  title="Launch study in OHIF Viewer"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#2563EB] dark:text-indigo-400" />
                  {openImagesMutation.isPending ? 'Launching...' : 'Open Images'}
                </Button>
              </div>

              {/* Save Status Badge */}
              <div className="flex items-center gap-1.5">
                {saveStatus === 'saving' && (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 text-xs flex items-center gap-1.5 py-1"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </Badge>
                )}

                {saveStatus === 'saved' && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 text-xs flex items-center gap-1.5 py-1"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Saved {lastSavedTime ? `(${lastSavedTime})` : ''}</span>
                  </Badge>
                )}

                {saveStatus === 'conflict' && (
                  <Badge
                    variant="destructive"
                    className="text-xs flex items-center gap-1.5 py-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Stale Tab Conflict
                  </Badge>
                )}

                {saveStatus === 'error' && (
                  <Badge
                    variant="destructive"
                    className="text-xs flex items-center gap-1.5 py-1"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Unable to save draft
                  </Badge>
                )}

                {draftExists && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Rev v{draftVersion}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stale-tab conflict alert */}
          {saveStatus === 'conflict' && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">
                  This draft changed in another tab. Reload the latest version before saving.
                </span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex items-center gap-1 shrink-0"
                onClick={handleReload}
              >
                <RefreshCw className="h-3 w-3" />
                Reload Latest Draft
              </Button>
            </div>
          )}

          {/* Phase 4.8 — Finalized Report Banner */}
          {workspace?.finalizedReport && (
            <div className="mt-3 p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>FINALIZED REPORT — Version {versionHistorySummary?.currentVersion || workspace.finalizedReport.version}</span>
                    <Badge variant="outline" className="text-[10px] bg-white dark:bg-card">
                      {versionHistorySummary?.reportStatus || workspace.finalizedReport.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Original report finalized {workspace.finalizedReport.finalizedAt ? formatDate(workspace.finalizedReport.finalizedAt) : ''}
                    {workspace.finalizedReport.radiologist ? ` by ${workspace.finalizedReport.radiologist.name}` : ''}.
                    Content is immutable. Issue auditable amendments below.
                  </div>
                  {workspace.finalizedReport.isSigned && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        DIGITALLY SIGNED & LOCKED
                      </span>
                      {workspace.finalizedReport.signedBy && (
                        <span className="text-[10px] text-muted-foreground">
                          Signer: {workspace.finalizedReport.signedBy.name}
                        </span>
                      )}
                      {workspace.finalizedReport.signatureHash && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                          SHA-256: {workspace.finalizedReport.signatureHash.substring(0, 16)}...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white dark:bg-card border-indigo-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-indigo-950 flex items-center gap-1 shadow-xs"
                  onClick={() => setIsVersionHistoryOpen(true)}
                >
                  <History className="h-3.5 w-3.5" />
                  Version History (v{versionHistorySummary?.currentVersion || workspace.finalizedReport.version})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white dark:bg-card border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 flex items-center gap-1 shadow-xs"
                  onClick={() => {
                    setAmendmentModalType('CORRECTION');
                    setIsAmendmentModalOpen(true);
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Create Correction
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white dark:bg-card border-indigo-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-indigo-950 flex items-center gap-1 shadow-xs"
                  onClick={() => {
                    setAmendmentModalType('ADDENDUM');
                    setIsAmendmentModalOpen(true);
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Create Addendum
                </Button>
              </div>
            </div>
          )}

          {/* General error message */}
          {saveStatus === 'error' && saveErrorMessage && (
            <div className="mt-3 p-2.5 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saveErrorMessage}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/20"
                onClick={handleManualSave}
                disabled={saveDraftMutation.isPending}
              >
                Retry Save
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Modal Body / Editor Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
              <span>Loading reporting workspace...</span>
            </div>
          ) : isError ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{(loadError as any)?.message || 'Unable to load reporting workspace.'}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : workspace?.finalizedReport ? (
            /* ========================================== */
            /* Phase 4.8: Finalized Report Review & Amendment Mode */
            /* ========================================== */
            <div className="space-y-4 py-2">
              <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        FINAL DIAGNOSTIC REPORT (Version {versionHistorySummary?.currentVersion || workspace.finalizedReport.version})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Finalized on {workspace.finalizedReport.finalizedAt ? formatDate(workspace.finalizedReport.finalizedAt) : 'Recorded'}
                        {workspace.finalizedReport.radiologist ? ` by ${workspace.finalizedReport.radiologist.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs bg-white dark:bg-card border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 flex items-center gap-1.5 shadow-xs font-semibold"
                      disabled={isGeneratingPdf}
                      onClick={handleGeneratePdf}
                    >
                      {isGeneratingPdf ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                          {workspace.finalizedReport.pdfArtifactPath ? 'Download PDF Report' : 'Generate Final PDF'}
                        </>
                      )}
                    </Button>

                    {workspace.finalizedReport.isReadyForReception ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 font-bold px-2.5 py-1 text-xs flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Ready at Front Desk
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs bg-[#2563EB] hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs font-semibold"
                        disabled={isSendingToReception}
                        onClick={handleSendToReception}
                      >
                        {isSendingToReception ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5 text-white" />
                            Send to Reception
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {pdfNotification && (
                  <div
                    className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 border ${
                      pdfNotification.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {pdfNotification.type === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{pdfNotification.message}</span>
                  </div>
                )}

                {/* Finalized Report Findings & Impression Display */}
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Findings
                    </label>
                    <div className="p-3 bg-background border rounded-md text-xs font-mono whitespace-pre-wrap text-foreground">
                      {versionHistorySummary?.latestEffectiveContent?.findings || workspace.finalizedReport.findings || '(No findings recorded)'}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Impression
                    </label>
                    <div className="p-3 bg-background border rounded-md text-xs font-mono whitespace-pre-wrap text-foreground">
                      {versionHistorySummary?.latestEffectiveContent?.impression || workspace.finalizedReport.impression || '(No impression recorded)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice regarding immutability */}
              <div className="p-3 bg-muted/40 border border-border/60 rounded-md text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  This diagnostic report is officially finalized. Direct editing is disabled to preserve report integrity.
                  Any changes must be submitted as auditable corrections or addenda via the buttons above.
                </span>
              </div>
            </div>
          ) : !draftExists ? (
            /* ========================================== */
            /* 1. Template Selection Mode (No draft yet) */
            /* ========================================== */
            <div className="space-y-4 py-2">
              <div className="p-3 bg-blue-50/70 dark:bg-indigo-950/30 border border-blue-200 dark:border-indigo-800 rounded-lg">
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  Select Reporting Template
                </h4>
                <p className="text-xs text-blue-700 dark:text-indigo-300 mt-1">
                  Choose a structured template matching modality{' '}
                  <strong>{workspace?.order.modality}</strong> and body region{' '}
                  <strong>{workspace?.order.bodyPart}</strong>. A draft will be created only after
                  template selection.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Available Structured Templates
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workspace?.templates.map((tpl: ReportingTemplateSummary) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-blue-50/40 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                            : 'border-border hover:border-indigo-300 dark:hover:border-indigo-700 bg-card'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {tpl.name}
                          </span>
                          {tpl.isRecommended && (
                            <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 shrink-0">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {tpl.description}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {tpl.sections.map((sec) => (
                            <span
                              key={sec}
                              className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <Button
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
                  onClick={() => createDraftMutation.mutate(selectedTemplateId)}
                  disabled={!selectedTemplateId || createDraftMutation.isPending}
                >
                  {createDraftMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initializing Draft...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Start Draft with Selected Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* ========================================== */
            /* 2. Structured Draft Editor Mode             */
            /* ========================================== */
            <div className="space-y-4">
              {/* Template Association Banner (Locked) */}
              <div className="flex items-center justify-between p-2.5 bg-muted/40 border rounded text-xs">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-semibold text-foreground">
                    {workspace?.draft?.templateName || 'Standard Structured Template'}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground italic">
                  Template locked for active draft
                </span>
              </div>

              {/* Phase 4.4 — Compact Voice Dictation Control Bar */}
              <div className="p-3 bg-card border rounded-lg shadow-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Mic
                        className={`h-4 w-4 ${
                          dictationState === 'listening'
                            ? 'text-rose-600 animate-pulse'
                            : 'text-[#2563EB]'
                        }`}
                      />
                      <span>Voice Dictation:</span>
                    </span>

                    {/* Target Section Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Section:</span>
                      <select
                        value={targetSection}
                        onChange={(e) => {
                          setTargetSection(e.target.value);
                          targetSectionRef.current = e.target.value;
                        }}
                        disabled={dictationState === 'listening'}
                        className="text-xs bg-background border rounded px-2 py-1 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        {Object.keys(draftContent).map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions & Live Status */}
                  <div className="flex items-center gap-2">
                    {dictationState !== 'listening' ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs bg-[#2563EB] hover:bg-blue-700 text-white font-medium flex items-center gap-1.5"
                        onClick={handleStartDictation}
                        disabled={
                          dictationState === 'unavailable' ||
                          saveStatus === 'conflict' ||
                          createDraftMutation.isPending
                        }
                      >
                        <Mic className="h-3.5 w-3.5" />
                        Start Dictation
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs font-medium flex items-center gap-1.5 animate-pulse"
                        onClick={handleStopDictation}
                      >
                        <Square className="h-3 w-3 fill-current" />
                        Stop Dictation
                      </Button>
                    )}

                    {/* Status Badges */}
                    {dictationState === 'ready' && (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground py-1 border-slate-300">
                        Inactive / Ready
                      </Badge>
                    )}

                    {dictationState === 'listening' && (
                      <Badge
                        variant="outline"
                        className="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 text-xs font-semibold py-1 flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                        Listening / Recording...
                      </Badge>
                    )}

                    {dictationState === 'processing' && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 text-xs py-1 flex items-center gap-1.5 shadow-xs"
                      >
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                        Processing...
                      </Badge>
                    )}

                    {dictationState === 'stopped' && (
                      <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 text-xs font-normal py-1">
                        Dictation Stopped
                      </Badge>
                    )}

                    {dictationState === 'unavailable' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-normal py-1">
                        Speech Unavailable
                      </Badge>
                    )}

                    {dictationState === 'permission_denied' && (
                      <Badge variant="destructive" className="text-xs font-normal py-1">
                        Mic Denied
                      </Badge>
                    )}

                    {dictationState === 'error' && (
                      <Badge variant="destructive" className="text-xs font-normal py-1">
                        Dictation Error
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Ephemeral Real-time Speech Preview */}
                {dictationState === 'listening' && hearingPreview && (
                  <div className="text-xs italic text-blue-700 dark:text-indigo-300 bg-blue-50/50 dark:bg-indigo-950/30 px-2.5 py-1.5 rounded border border-indigo-100 dark:border-indigo-900 flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5 shrink-0 text-indigo-500 animate-pulse" />
                    <span>Hearing: &ldquo;{hearingPreview}&rdquo;</span>
                  </div>
                )}

                {/* Safe Non-intrusive Alerts */}
                {dictationState === 'unavailable' && (
                  <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Speech-to-text is not available in this browser.</span>
                  </div>
                )}

                {dictationState === 'permission_denied' && (
                  <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Microphone permission was denied. You can continue typing the report manually.</span>
                  </div>
                )}

                {dictationState === 'error' && dictationMessage && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{dictationMessage}</span>
                  </div>
                )}
              </div>

              {/* Phase 4.5 — Measurements and Key Image References */}
              <div className="bg-card border rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="h-4 w-4 text-[#2563EB]" />
                      Measurements & Key Images
                    </h4>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {measurements.length} meas • {keyImages.length} key img
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                      ● Viewer Sync Active
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex items-center gap-1 text-blue-700 dark:text-indigo-300 border-blue-200"
                      onClick={() => {
                        setMLabel(`Measurement ${measurements.length + 1}`);
                        setShowAddMeasurementDialog(true);
                      }}
                      disabled={saveStatus === 'conflict' || !draftExists}
                    >
                      <Plus className="h-3 w-3" />
                      Add Measurement
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex items-center gap-1 text-blue-700 dark:text-indigo-300 border-blue-200"
                      onClick={() => {
                        setKLabel(`Key Image ${keyImages.length + 1}`);
                        setShowAddKeyImageDialog(true);
                      }}
                      disabled={saveStatus === 'conflict' || !draftExists}
                    >
                      <Plus className="h-3 w-3" />
                      Add Key Image
                    </Button>
                  </div>
                </div>

                {/* Empty State */}
                {measurements.length === 0 && keyImages.length === 0 && (
                  <div className="p-3 border border-dashed rounded text-center text-xs text-muted-foreground bg-muted/20">
                    No measurements or key image references attached to this report draft yet. Use the buttons above to reference key slices and measurements.
                  </div>
                )}

                {/* Measurements List */}
                {measurements.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Measurements ({measurements.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {measurements.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded border bg-background/80 hover:bg-muted/40 transition-colors flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono px-1 py-0 bg-blue-50 text-blue-700 dark:bg-indigo-950 dark:text-indigo-300"
                              >
                                {m.toolType}
                              </Badge>
                              <span className="text-xs font-semibold text-foreground truncate">{m.label}</span>
                              <span className="text-xs font-mono font-bold text-[#2563EB] dark:text-indigo-400">
                                {m.numericValue} {m.unit}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              Slice #{m.instanceNumber ?? '—'}{' '}
                              {m.sliceLocation !== undefined ? `(${m.sliceLocation} mm)` : ''}
                            </div>
                            {m.findingText && (
                              <div className="text-xs text-foreground/80 italic mt-0.5">
                                &ldquo;{m.findingText}&rdquo;
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-[#2563EB]"
                              title="View in PACS Viewer"
                              onClick={() => handleViewReference(m.seriesInstanceUid, m.sopInstanceUid)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Remove Measurement"
                              onClick={() => handleRemoveMeasurement(m.id)}
                              disabled={saveStatus === 'conflict'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Images List */}
                {keyImages.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Key Images ({keyImages.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {keyImages.map((k) => (
                        <div
                          key={k.id}
                          className="p-2.5 rounded border bg-background/80 hover:bg-muted/40 transition-colors flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono px-1 py-0 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              >
                                <ImageIcon className="h-2.5 w-2.5 inline mr-1" />
                                Key Image
                              </Badge>
                              <span className="text-xs font-semibold text-foreground truncate">{k.label}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              Slice #{k.instanceNumber ?? '—'}{' '}
                              {k.sliceLocation !== undefined ? `(${k.sliceLocation} mm)` : ''}
                            </div>
                            {k.description && (
                              <div className="text-xs text-foreground/80 italic mt-0.5">
                                &ldquo;{k.description}&rdquo;
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-[#2563EB]"
                              title="View in PACS Viewer"
                              onClick={() => handleViewReference(k.seriesInstanceUid, k.sopInstanceUid)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Remove Key Image"
                              onClick={() => handleRemoveKeyImage(k.id)}
                              disabled={saveStatus === 'conflict'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Structured Fields */}
              <div className="space-y-4">
                {Object.keys(draftContent).map((section) => {
                  const isIndication = section.toLowerCase().includes('indication');
                  const isImpression = section.toLowerCase().includes('impression');
                  const isFindings = section.toLowerCase().includes('findings');
                  const isSectionActiveForDictation =
                    targetSection === section && dictationState === 'listening';

                  return (
                    <div key={section} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          {section}
                          {isIndication && (
                            <span className="text-[10px] font-normal lowercase text-muted-foreground">
                              (order indication)
                            </span>
                          )}
                          {isImpression && (
                            <span className="text-[10px] font-semibold text-[#2563EB] dark:text-indigo-400">
                              *core conclusion
                            </span>
                          )}
                          {isSectionActiveForDictation && (
                            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 animate-pulse lowercase flex items-center gap-1">
                              <Mic className="h-3 w-3" />
                              (dictating into this section...)
                            </span>
                          )}
                        </label>
                      </div>

                      <textarea
                        value={draftContent[section] || ''}
                        onChange={(e) => handleFieldChange(section, e.target.value)}
                        onFocus={() => {
                          setTargetSection(section);
                          targetSectionRef.current = section;
                        }}
                        onSelect={(e) => {
                          cursorPositionsRef.current[section] = e.currentTarget.selectionStart;
                        }}
                        onClick={(e) => {
                          cursorPositionsRef.current[section] = e.currentTarget.selectionStart;
                        }}
                        onKeyUp={(e) => {
                          cursorPositionsRef.current[section] = e.currentTarget.selectionStart;
                        }}
                        placeholder={`Enter ${section.toLowerCase()}...`}
                        disabled={saveStatus === 'conflict'}
                        rows={isFindings ? 5 : isImpression ? 4 : 2}
                        className={`w-full rounded-md border p-2.5 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed transition-all ${
                          isSectionActiveForDictation
                            ? 'ring-2 ring-rose-500 border-rose-500'
                            : ''
                        } ${
                          saveStatus === 'conflict' ? 'opacity-60 bg-muted/30 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3 border-t bg-muted/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs flex items-center gap-1.5"
              onClick={() => openImagesMutation.mutate()}
              disabled={openImagesMutation.isPending}
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#2563EB]" />
              {openImagesMutation.isPending ? 'Launching...' : 'Open Images'}
            </Button>

            {/* Phase 4.6 — Peer Review Action Button */}
            {orderPeerReview ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`text-xs flex items-center gap-1.5 ${
                  orderPeerReview.status === 'COMPLETED'
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-amber-300 text-amber-700 bg-amber-50/60 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
                onClick={() => setIsPeerReviewDetailOpen(true)}
              >
                <Users className="h-3.5 w-3.5" />
                {orderPeerReview.status === 'COMPLETED'
                  ? 'Second Opinion Available'
                  : `Peer Review (${orderPeerReview.status})`}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-indigo-950/30"
                onClick={() => setIsPeerReviewRequestOpen(true)}
              >
                <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                Request Peer Review
              </Button>
            )}

            {/* Phase 4.7 — Critical Finding Action Button */}
            {orderCriticalFinding ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`text-xs flex items-center gap-1.5 ${
                  orderCriticalFinding.status === 'ACKNOWLEDGED'
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-red-300 text-red-700 bg-red-50/60 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 animate-pulse'
                }`}
                onClick={() => setIsCriticalFindingDetailOpen(true)}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                {orderCriticalFinding.status === 'ACKNOWLEDGED'
                  ? 'Critical Finding (Acknowledged)'
                  : 'Critical Finding (Pending)'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs flex items-center gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setIsCriticalFindingRequestOpen(true)}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                Critical Finding
              </Button>
            )}

            {saveStatus === 'conflict' && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs flex items-center gap-1"
                onClick={handleReload}
              >
                <RefreshCw className="h-3 w-3" />
                Reload Latest Draft
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>

            {draftExists && !workspace?.finalizedReport && (
              <Button
                size="sm"
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5"
                onClick={handleManualSave}
                disabled={
                  saveStatus === 'saving' ||
                  saveStatus === 'conflict' ||
                  saveDraftMutation.isPending
                }
              >
                {saveDraftMutation.isPending || saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </>
                )}
              </Button>
            )}

            {draftExists && !workspace?.finalizedReport && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/20"
                onClick={() => setIsReviewSignModalOpen(true)}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Review & Final Sign
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Measurement Dialog */}
    <Dialog open={showAddMeasurementDialog} onOpenChange={setShowAddMeasurementDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Ruler className="h-4 w-4 text-[#2563EB]" />
            Add Image Measurement Reference
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddMeasurementSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Tool / Measurement Type</label>
            <select
              value={mToolType}
              onChange={(e) => setMToolType(e.target.value as OhifMeasurementToolType)}
              className="w-full text-xs rounded border bg-background p-2"
            >
              <option value="Length">Length (Calipers / Linear)</option>
              <option value="Bidirectional">Bidirectional (Long & Short Axis)</option>
              <option value="EllipticalROI">Elliptical ROI (Area / Mean HU)</option>
              <option value="CircleROI">Circle ROI</option>
              <option value="RectangleROI">Rectangle ROI</option>
              <option value="Angle">Angle (Degrees)</option>
              <option value="CobbAngle">Cobb Angle (Spine)</option>
              <option value="ArrowAnnotate">Arrow Annotation</option>
              <option value="Probe">Probe (Point HU / Value)</option>
              <option value="PlanarFreehandROI">Planar Freehand ROI</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Measurement Label</label>
            <input
              type="text"
              required
              value={mLabel}
              onChange={(e) => setMLabel(e.target.value)}
              placeholder="e.g. Right lung nodule maximum diameter"
              className="w-full text-xs rounded border bg-background p-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Numeric Result</label>
              <input
                type="number"
                step="any"
                required
                value={mValue}
                onChange={(e) => setMValue(e.target.value)}
                placeholder="e.g. 14.2"
                className="w-full text-xs rounded border bg-background p-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Unit</label>
              <input
                type="text"
                required
                value={mUnit}
                onChange={(e) => setMUnit(e.target.value)}
                placeholder="mm, cm, HU, deg"
                className="w-full text-xs rounded border bg-background p-2"
              />
            </div>
          </div>

          {/* Series & Instance Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Series</label>
              <select
                value={mSeriesUid}
                onChange={(e) => {
                  setMSeriesUid(e.target.value);
                  const s = studyInstancesData?.series.find((x) => x.seriesInstanceUid === e.target.value);
                  if (s && s.instances.length > 0) {
                    setMSopUid(s.instances[0].sopInstanceUid);
                  }
                }}
                className="w-full text-xs rounded border bg-background p-2 truncate"
              >
                {studyInstancesData?.series.map((s) => (
                  <option key={s.seriesInstanceUid} value={s.seriesInstanceUid}>
                    Series #{s.seriesNumber ?? 1} ({s.modality || 'DICOM'}) - {s.instances.length} imgs
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Image / Slice</label>
              <select
                value={mSopUid}
                onChange={(e) => setMSopUid(e.target.value)}
                className="w-full text-xs rounded border bg-background p-2 truncate"
              >
                {(studyInstancesData?.series.find((s) => s.seriesInstanceUid === mSeriesUid) || studyInstancesData?.series[0])?.instances.map((i) => (
                  <option key={i.sopInstanceUid} value={i.sopInstanceUid}>
                    Slice #{i.instanceNumber ?? '?'} {i.sliceLocation !== undefined ? `(${i.sliceLocation} mm)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Finding Observation (Optional)</label>
            <input
              type="text"
              value={mFinding}
              onChange={(e) => setMFinding(e.target.value)}
              placeholder="e.g. Well-circumscribed, non-calcified"
              className="w-full text-xs rounded border bg-background p-2"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddMeasurementDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold"
            >
              Insert Measurement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Add Key Image Dialog */}
    <Dialog open={showAddKeyImageDialog} onOpenChange={setShowAddKeyImageDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-600" />
            Add Key Image Reference
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddKeyImageSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Key Image Label</label>
            <input
              type="text"
              required
              value={kLabel}
              onChange={(e) => setKLabel(e.target.value)}
              placeholder="e.g. Key Image 1 - Tracheal bifurcation"
              className="w-full text-xs rounded border bg-background p-2"
            />
          </div>

          {/* Series & Instance Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Series</label>
              <select
                value={kSeriesUid}
                onChange={(e) => {
                  setKSeriesUid(e.target.value);
                  const s = studyInstancesData?.series.find((x) => x.seriesInstanceUid === e.target.value);
                  if (s && s.instances.length > 0) {
                    setKSopUid(s.instances[0].sopInstanceUid);
                  }
                }}
                className="w-full text-xs rounded border bg-background p-2 truncate"
              >
                {studyInstancesData?.series.map((s) => (
                  <option key={s.seriesInstanceUid} value={s.seriesInstanceUid}>
                    Series #{s.seriesNumber ?? 1} ({s.modality || 'DICOM'}) - {s.instances.length} imgs
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Image / Slice</label>
              <select
                value={kSopUid}
                onChange={(e) => setKSopUid(e.target.value)}
                className="w-full text-xs rounded border bg-background p-2 truncate"
              >
                {(studyInstancesData?.series.find((s) => s.seriesInstanceUid === kSeriesUid) || studyInstancesData?.series[0])?.instances.map((i) => (
                  <option key={i.sopInstanceUid} value={i.sopInstanceUid}>
                    Slice #{i.instanceNumber ?? '?'} {i.sliceLocation !== undefined ? `(${i.sliceLocation} mm)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Clinical Description (Optional)</label>
            <input
              type="text"
              value={kDescription}
              onChange={(e) => setKDescription(e.target.value)}
              placeholder="e.g. Demonstrates pleural effusion at base"
              className="w-full text-xs rounded border bg-background p-2"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddKeyImageDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              Insert Key Image
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Phase 4.6 — Peer Review Submodals */}
    {workspace && (
      <>
        <PeerReviewRequestModal
          isOpen={isPeerReviewRequestOpen}
          onOpenChange={setIsPeerReviewRequestOpen}
          orderId={orderId!}
          patientName={workspace.order.patientName}
          patientId={workspace.order.patientId}
          accessionNumber={workspace.order.accessionNumber}
          modality={workspace.order.modality}
          procedureName={workspace.order.examinationName || workspace.order.bodyPart}
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
          patientName={workspace.order.patientName}
          patientId={workspace.order.patientId}
          accessionNumber={workspace.order.accessionNumber}
          modality={workspace.order.modality}
          procedureName={workspace.order.examinationName || workspace.order.bodyPart}
        />
        <CriticalFindingDetailModal
          isOpen={isCriticalFindingDetailOpen}
          onOpenChange={setIsCriticalFindingDetailOpen}
          orderId={orderId!}
        />

        {/* Phase 4.8 — Report Version History and Amendment Modals */}
        <ReportVersionHistoryModal
          open={isVersionHistoryOpen}
          onOpenChange={setIsVersionHistoryOpen}
          orderId={orderId!}
          patientId={workspace.order.patientId}
          accessionNumber={workspace.order.accessionNumber}
          onOpenAmendment={(type) => {
            setAmendmentModalType(type);
            setIsAmendmentModalOpen(true);
          }}
        />
        <ReportAmendmentModal
          open={isAmendmentModalOpen}
          onOpenChange={setIsAmendmentModalOpen}
          orderId={orderId!}
          patientId={workspace.order.patientId}
          accessionNumber={workspace.order.accessionNumber}
          currentVersion={versionHistorySummary?.currentVersion || workspace.finalizedReport?.version || 1}
          initialType={amendmentModalType}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reportWorkspace', orderId] });
            queryClient.invalidateQueries({ queryKey: ['reportVersionHistory', orderId] });
          }}
        />

        {/* Phase 4.9 — Final Report Review, Approval, Sign & Lock Modal */}
        <ReportReviewSignModal
          isOpen={isReviewSignModalOpen}
          onClose={() => setIsReviewSignModalOpen(false)}
          orderId={orderId!}
          accessionNumber={workspace.order.accessionNumber}
          patientId={workspace.order.patientId}
          patientName={workspace.order.patientName}
          modality={workspace.order.modality}
          examinationName={workspace.order.examinationName || workspace.order.bodyPart}
          draftVersion={draftVersion}
          findings={draftContent.Findings || draftContent.findings || ''}
          impression={draftContent.Impression || draftContent.impression || ''}
          measurementsCount={measurements.length}
          keyImagesCount={keyImages.length}
          signerName={workspace.assignment?.assignedToName || 'Authenticated radiologist'}
          signerEmail="rad@ris.local"
          signerRole="RADIOLOGIST"
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
            queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
            queryClient.invalidateQueries({ queryKey: ['reportVersionHistory', orderId] });
          }}
        />
      </>
    )}
    </>
  );
};

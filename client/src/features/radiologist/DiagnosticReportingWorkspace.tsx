import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologistService } from '../../services/radiologistService';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
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
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
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
  ShieldCheck,
  FileDown,
  Send,
  ArrowLeft,
  Clock,
  Stethoscope,
  CheckCircle2,
  Fingerprint,
  Star,
} from 'lucide-react';
import { ReportVersionHistoryModal } from './ReportVersionHistoryModal';
import { ReportAmendmentModal } from './ReportAmendmentModal';
import { ReportReviewSignModal } from './ReportReviewSignModal';
import { PeerReviewRequestModal } from './PeerReviewRequestModal';
import { PeerReviewDetailModal } from './PeerReviewDetailModal';
import { CriticalFindingRequestModal } from './CriticalFindingRequestModal';
import { CriticalFindingDetailModal } from './CriticalFindingDetailModal';
import {
  defaultSpeechProvider,
  insertTranscriptIntoSection,
  DictationState,
} from '../../services/speechRecognitionService';
import { formatDate, formatWaitingDuration, calculateAge } from '../../utils/formatters';

interface DiagnosticReportingWorkspaceProps {
  orderId: string;
}

export const DiagnosticReportingWorkspace: React.FC<DiagnosticReportingWorkspaceProps> = ({ orderId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Selected template for new draft
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Structured draft content state
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [draftVersion, setDraftVersion] = useState<number>(1);

  // Measurements and Key Image References
  const [measurements, setMeasurements] = useState<MeasurementReference[]>([]);
  const [keyImages, setKeyImages] = useState<KeyImageReference[]>([]);

  // Dialog & Form states for Adding Measurement & Key Image
  const [showAddMeasurementDialog, setShowAddMeasurementDialog] = useState(false);
  const [showAddKeyImageDialog, setShowAddKeyImageDialog] = useState(false);

  // Peer Review / Second Opinion states
  const [isPeerReviewRequestOpen, setIsPeerReviewRequestOpen] = useState(false);
  const [isPeerReviewDetailOpen, setIsPeerReviewDetailOpen] = useState(false);

  const { data: orderPeerReview } = useQuery({
    queryKey: ['orderPeerReview', orderId],
    queryFn: () => radiologistService.getOrderPeerReview(orderId),
    enabled: !!orderId,
  });

  // Critical Findings Alert states
  const [isCriticalFindingRequestOpen, setIsCriticalFindingRequestOpen] = useState(false);
  const [isCriticalFindingDetailOpen, setIsCriticalFindingDetailOpen] = useState(false);

  const { data: orderCriticalFinding } = useQuery({
    queryKey: ['orderCriticalFinding', orderId],
    queryFn: () => radiologistService.getOrderCriticalFinding(orderId),
    enabled: !!orderId,
  });

  // Report Corrections & Addenda states
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isAmendmentModalOpen, setIsAmendmentModalOpen] = useState(false);
  const [amendmentModalType, setAmendmentModalType] = useState<'CORRECTION' | 'ADDENDUM'>('CORRECTION');

  // Final Report Review, Sign & Lock states
  const [isReviewSignModalOpen, setIsReviewSignModalOpen] = useState(false);

  // PDF Report Generation states
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
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Autosave debounce timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dictation / Speech-to-Text State
  const [dictationState, setDictationState] = useState<DictationState>(() =>
    defaultSpeechProvider.isSupported() ? 'ready' : 'unavailable'
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
    isLoading: isWorkspaceLoading,
    isError: isWorkspaceError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['radiologistReportWorkspace', orderId],
    queryFn: () => radiologistService.getReportWorkspace(orderId),
    enabled: !!orderId,
    staleTime: 0,
  });

  // 2. Fetch Study Context for deep clinical details & TAT
  const { data: studyContext } = useQuery({
    queryKey: ['radiologistStudyContext', orderId],
    queryFn: () => radiologistService.getStudyContext(orderId),
    enabled: !!orderId,
  });

  // Version History Summary Query (only enabled when report is finalized)
  const { data: versionHistorySummary } = useQuery({
    queryKey: ['reportVersionHistory', orderId],
    queryFn: () => radiologistService.getReportVersionHistory(orderId),
    enabled: !!orderId && !!workspace?.finalizedReport,
  });

  // Fetch Study Instances for Measurement & Key Image linking
  const { data: studyInstancesData } = useQuery({
    queryKey: ['radiologistStudyInstances', orderId],
    queryFn: () => radiologistService.getStudyInstances(orderId),
    enabled: !!orderId,
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      defaultSpeechProvider.abort();
    };
  }, []);

  // Viewer window reference
  const viewerWindowRef = useRef<Window | null>(null);

  // Open Images mutation
  const openImagesMutation = useMutation({
    mutationFn: () => radiologistService.getViewerLaunch(orderId),
    onSuccess: (data) => {
      const win = window.open(data.viewerUrl, 'radaxis-pacs-viewer');
      if (win) {
        viewerWindowRef.current = win;
      }
    },
  });

  // Mutation: Create Report Draft from Template
  const createDraftMutation = useMutation({
    mutationFn: (templateId: string) =>
      radiologistService.createReportDraft(orderId, { templateId }),
    onSuccess: (data) => {
      setDraftContent(data.draft.content);
      setDraftVersion(data.draft.version);
      setMeasurements(data.draft.measurements || []);
      setKeyImages(data.draft.keyImages || []);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      queryClient.invalidateQueries({
        queryKey: ['radiologistReportWorkspace', orderId],
      });
    },
    onError: () => {
      setSaveStatus('error');
    },
  });

  // Mutation: Save Report Draft (Manual)
  const saveDraftMutation = useMutation({
    mutationFn: (payload: {
      version: number;
      content: Record<string, string>;
      measurements?: MeasurementReference[];
      keyImages?: KeyImageReference[];
    }) =>
      radiologistService.saveReportDraft(orderId, payload),
    onSuccess: (data) => {
      setDraftVersion(data.draft.version);
      setDraftContent(data.draft.content);
      setMeasurements(data.draft.measurements || []);
      setKeyImages(data.draft.keyImages || []);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      queryClient.invalidateQueries({
        queryKey: ['radiologistReportWorkspace', orderId],
      });
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        setSaveStatus('conflict');
      } else {
        setSaveStatus('error');
      }
    },
  });

  // Debounced Autosave Trigger
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
      setSaveStatus('saving');

      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await radiologistService.autosaveReportDraft(orderId, {
            version: currentVersion,
            content: newContent,
            measurements: newMeasurements ?? measurementsRef.current,
            keyImages: newKeyImages ?? keyImagesRef.current,
          });
          setDraftVersion(res.draft.version);
          setSaveStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString());
        } catch (err: any) {
          if (err?.response?.status === 409) {
            setSaveStatus('conflict');
          } else {
            setSaveStatus('error');
          }
        }
      }, 2500);
    },
    [orderId]
  );

  // Unified processors for OHIF measurement & key image events
  const processIncomingMeasurement = useCallback(
    (data: any) => {
      if (!data || typeof data !== 'object') return;
      const isMeasurementMsg =
        data.type === 'RIS_MEASUREMENT_ADDED' ||
        data.type === 'RIS_MEASUREMENT_UPDATED' ||
        data.type === 'OHIF_MEASUREMENT_CAPTURED';

      if (!isMeasurementMsg) return;
      if (workspace?.finalizedReport) return;

      const currentStudyUid =
        workspace?.order?.studyInstanceUid ||
        studyInstancesData?.studyInstanceUid;

      const m = data.measurement as MeasurementReference;
      if (!m || !m.id) return;

      if (currentStudyUid && m.studyInstanceUid && m.studyInstanceUid.trim() !== currentStudyUid.trim()) {
        console.warn(`[RIS] Discarded measurement from foreign study: ${m.studyInstanceUid}`);
        return;
      }

      if (!m.studyInstanceUid && currentStudyUid) {
        m.studyInstanceUid = currentStudyUid;
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
        return updated;
      });

      // Immediate database persistence via dedicated measurement API
      radiologistService
        .saveMeasurement(orderId, m)
        .then((res) => {
          if (res.draft) {
            setDraftVersion(res.draft.version);
          }
          queryClient.invalidateQueries({
            queryKey: ['radiologistReportWorkspace', orderId],
          });
        })
        .catch((err) => {
          console.warn('[RIS] Direct measurement save failed, triggering autosave fallback:', err);
          triggerDebouncedAutosave(
            draftContentRef.current,
            draftVersionRef.current,
            measurementsRef.current,
            keyImagesRef.current
          );
        });
    },
    [
      workspace?.order?.studyInstanceUid,
      studyInstancesData?.studyInstanceUid,
      workspace?.finalizedReport,
      orderId,
      queryClient,
      triggerDebouncedAutosave,
    ]
  );

  const processIncomingKeyImage = useCallback(
    (data: any) => {
      if (!data || typeof data !== 'object') return;
      const isKeyImageMsg =
        data.type === 'RIS_KEY_IMAGE_CAPTURED' ||
        data.type === 'OHIF_KEY_IMAGE_CAPTURED';

      if (!isKeyImageMsg) return;
      if (workspace?.finalizedReport) return;

      const currentStudyUid =
        workspace?.order?.studyInstanceUid ||
        studyInstancesData?.studyInstanceUid;

      const k = data.keyImage as KeyImageReference;
      if (!k || !k.id) return;

      if (currentStudyUid && k.studyInstanceUid && k.studyInstanceUid.trim() !== currentStudyUid.trim()) {
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
        return updated;
      });

      triggerDebouncedAutosave(
        draftContentRef.current,
        draftVersionRef.current,
        measurementsRef.current,
        keyImagesRef.current
      );
      setShowAddKeyImageDialog(false);
    },
    [
      workspace?.order?.studyInstanceUid,
      studyInstancesData?.studyInstanceUid,
      workspace?.finalizedReport,
      triggerDebouncedAutosave,
    ]
  );

  // Real OHIF PACS Viewer Measurement & Key Image Event Bridge
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (viewerWindowRef.current && !viewerWindowRef.current.closed && event.source) {
        if (event.source !== viewerWindowRef.current) {
          viewerWindowRef.current = event.source as Window;
        }
      } else if (event.source) {
        viewerWindowRef.current = event.source as Window;
      }

      processIncomingMeasurement(event.data);
      processIncomingKeyImage(event.data);
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('radaxis-dicom-sync');
        bc.onmessage = (event) => {
          if (!event.data || typeof event.data !== 'object') return;
          processIncomingMeasurement(event.data);
          processIncomingKeyImage(event.data);
        };
      }
    } catch (e) {
      console.warn('[RIS] BroadcastChannel init error:', e);
    }

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'radaxis_dicom_sync' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          processIncomingMeasurement(parsed);
          processIncomingKeyImage(parsed);
        } catch (e) {}
      }
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
    };
  }, [processIncomingMeasurement, processIncomingKeyImage]);

  // Field change handler
  const handleFieldChange = useCallback((section: string, value: string) => {
    const updated = {
      ...draftContentRef.current,
      [section]: value,
    };
    setDraftContent(updated);
    draftContentRef.current = updated;
    triggerDebouncedAutosave(updated, draftVersionRef.current, measurementsRef.current, keyImagesRef.current);
  }, [triggerDebouncedAutosave]);

  // Reload handler for conflict recovery
  const handleReload = () => {
    refetch();
    setSaveStatus('idle');
  };

  // Dictation chunk handler
  const handleTranscriptChunk = useCallback(
    (transcriptChunk: string, isFinal: boolean) => {
      if (!isFinal) {
        setHearingPreview(transcriptChunk);
        return;
      }

      setHearingPreview('');
      const section = targetSectionRef.current;
      if (!section) return;

      const currentText = draftContentRef.current[section] || '';
      const cursor = cursorPositionsRef.current[section];
      const { newText, newCursor } = insertTranscriptIntoSection(
        currentText,
        transcriptChunk,
        cursor
      );

      cursorPositionsRef.current[section] = newCursor;
      handleFieldChange(section, newText);
    },
    [handleFieldChange]
  );

  // Start Dictation handler
  const handleStartDictation = () => {
    if (!draftExists) {
      return;
    }

    setDictationState('listening');
    setHearingPreview('');

    radiologistService
      .recordDictationSession(orderId, {
        action: 'START',
        section: targetSectionRef.current,
      })
      .catch(() => { });

    defaultSpeechProvider.start({
      onStateChange: (state) => {
        setDictationState(state);
      },
      onTranscriptChunk: handleTranscriptChunk,
      onError: (_errorMessage, state) => {
        setHearingPreview('');
        setDictationState(state);
      },
    });
  };

  // Stop Dictation handler
  const handleStopDictation = () => {
    defaultSpeechProvider.stop();
    setDictationState('stopped');
    setHearingPreview('');

    radiologistService
      .recordDictationSession(orderId, {
        action: 'COMPLETE',
        section: targetSectionRef.current,
      })
      .catch(() => { });
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

  // Launch PACS viewer directly for specific slice reference
  const handleViewReference = async (seriesUid: string, sopUid: string) => {
    try {
      const launch = await radiologistService.getViewerLaunch(orderId);
      const url = new URL(launch.viewerUrl, window.location.origin);
      url.searchParams.set('initialSeriesInstanceUID', seriesUid);
      url.searchParams.set('initialSOPInstanceUID', sopUid);
      const win = window.open(url.toString(), 'radaxis-pacs-viewer');
      if (win) {
        viewerWindowRef.current = win;
      }
    } catch {
      // safe fallback
    }
  };

  // Add Measurement handler
  const handleAddMeasurementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyInstancesData?.studyInstanceUid) {
      return;
    }
    const numVal = parseFloat(mValue);
    if (isNaN(numVal)) {
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

  // Toggle Key Image for measurement
  const handleToggleKeyImage = async (measId: string) => {
    try {
      const res = await radiologistService.toggleKeyImage(orderId, measId);
      setKeyImages(res.keyImages);
      keyImagesRef.current = res.keyImages;
      queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
    } catch (e) {
      console.warn('[RIS] Failed to toggle key image status:', e);
    }
  };

  const handleRemoveMeasurement = async (id: string) => {
    try {
      const res = await radiologistService.deleteMeasurement(orderId, id);
      setMeasurements(res.measurements);
      measurementsRef.current = res.measurements;
      if (res.keyImages) {
        setKeyImages(res.keyImages);
        keyImagesRef.current = res.keyImages;
      }
      queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
    } catch {
      const updated = measurements.filter((m) => m.id !== id);
      setMeasurements(updated);
      measurementsRef.current = updated;
      triggerDebouncedAutosave(draftContentRef.current, draftVersionRef.current, updated, keyImagesRef.current);
    }
  };

  // Add Key Image handler
  const handleAddKeyImageSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedStudyUid =
      studyInstancesData?.studyInstanceUid ||
      workspace?.order?.studyInstanceUid ||
      '';

    const selectedSeries =
      studyInstancesData?.series?.find((s) => s.seriesInstanceUid === kSeriesUid) ||
      studyInstancesData?.series?.[0];
    const selectedInst =
      selectedSeries?.instances?.find((i) => i.sopInstanceUid === kSopUid) ||
      selectedSeries?.instances?.[0];

    const resolvedSeriesUid =
      kSeriesUid || selectedSeries?.seriesInstanceUid || (resolvedStudyUid ? `${resolvedStudyUid}.1` : '');
    const resolvedSopUid =
      kSopUid || selectedInst?.sopInstanceUid || (resolvedSeriesUid ? `${resolvedSeriesUid}.1` : '');

    const newK: KeyImageReference = {
      id: `keyimg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      label: kLabel.trim() || `Key Image ${keyImages.length + 1}`,
      studyInstanceUid: resolvedStudyUid,
      seriesInstanceUid: resolvedSeriesUid,
      sopInstanceUid: resolvedSopUid,
      instanceNumber: selectedInst?.instanceNumber ?? 1,
      sliceLocation: selectedInst?.sliceLocation !== undefined ? Number(selectedInst.sliceLocation) : undefined,
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

  // Open Add Key Image Dialog
  const handleOpenAddKeyImageDialog = () => {
    setKLabel(`Key Image ${keyImages.length + 1}`);
    setKDescription('');

    // Pre-populate series and slice defaults if available
    const availableSeries = studyInstancesData?.series;
    if (availableSeries && availableSeries.length > 0) {
      const activeSeries = availableSeries.find((s) => s.seriesInstanceUid === kSeriesUid) || availableSeries[0];
      setKSeriesUid(activeSeries.seriesInstanceUid);
      if (activeSeries.instances && activeSeries.instances.length > 0) {
        const activeInst = activeSeries.instances.find((i) => i.sopInstanceUid === kSopUid) || activeSeries.instances[0];
        setKSopUid(activeInst.sopInstanceUid);
      }
    }
    setShowAddKeyImageDialog(true);
  };

  const draftExists = !!workspace?.draft;

  if (isWorkspaceLoading) {
    return (
      <div className="py-24 text-center text-slate-500 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#2563EB]" />
        <p className="text-sm font-medium text-[#152B42]">Loading Diagnostic Reporting Workspace...</p>
        <p className="text-xs text-[#65758A]">Retrieving study context, templates, and report draft.</p>
      </div>
    );
  }

  if (isWorkspaceError || !workspace) {
    return (
      <div className="py-16 text-center text-destructive space-y-4 max-w-lg mx-auto">
        <AlertCircle className="h-10 w-10 mx-auto" />
        <h2 className="text-lg font-bold text-[#152B42]">Unable to Load Reporting Workspace</h2>
        <p className="text-xs text-[#65758A]">
          {loadError ? (loadError as any)?.message : 'The requested examination could not be loaded.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/radiologist/worklist')} className="border-slate-200 text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Worklist
        </Button>
      </div>
    );
  }

  const patient = studyContext?.patient;
  const tatMinutes = studyContext?.order?.waitingMinutes;

  return (
    <div className="space-y-5 max-w-[1550px] mx-auto pb-10">
      {/* 1. CLINICAL STUDY COMMAND HEADER */}
      <div className="bg-white border border-[#dce6e0] rounded-3xl p-5 shadow-soft space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Back Action & Patient Identity */}
          <div className="flex items-start sm:items-center gap-3.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/radiologist/worklist')}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-800 hover:bg-[#f8faf8] border-[#dce6e0] shrink-0 shadow-soft rounded-full"
              title="Return to Radiologist Worklist"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Worklist
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  {workspace.order.patientName}
                </h1>
                <IdentifierPill type="patient" value={workspace.order.patientId} />
                <IdentifierPill type="accession" value={workspace.order.accessionNumber} />
                {patient && (
                  <span className="text-xs font-medium text-slate-500">
                    {calculateAge(patient.dateOfBirth)}y / {patient.gender[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                  {workspace.order.modality}
                </span>
                <span className="font-bold text-slate-900">{workspace.order.examinationName}</span>
                <span className="font-medium">· {workspace.order.bodyPart}</span>
                <PriorityBadge priority={workspace.order.priority} />
                <StatusBadge status={workspace.order.orderStatus} />
                {tatMinutes !== undefined && (
                  <Badge variant="outline" className="text-[11px] font-mono border-slate-200 text-slate-700 bg-slate-50 rounded-full font-bold">
                    <Clock className="h-3 w-3 mr-1 text-slate-400" />
                    TAT: {formatWaitingDuration(tatMinutes)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: PACS Quick Action & Save Status */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            {/* Save Status Badge */}
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && (
                <Badge
                  variant="outline"
                  className="bg-sky-50 text-sky-800 border-sky-200 text-xs font-bold flex items-center gap-1.5 py-1 px-3 rounded-full"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                  Saving...
                </Badge>
              )}

              {saveStatus === 'saved' && (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold flex items-center gap-1.5 py-1 px-3 rounded-full"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Saved {lastSavedTime ? `(${lastSavedTime})` : ''}</span>
                </Badge>
              )}

              {saveStatus === 'conflict' && (
                <Badge variant="destructive" className="text-xs font-bold flex items-center gap-1.5 py-1 px-3 rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Stale Tab Conflict
                </Badge>
              )}

              {saveStatus === 'error' && (
                <Badge variant="destructive" className="text-xs font-bold flex items-center gap-1.5 py-1 px-3 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Unable to save draft
                </Badge>
              )}

              {draftExists && (
                <span className="text-[10px] text-slate-400 font-mono font-bold">
                  Rev v{draftVersion}
                </span>
              )}
            </div>

            {/* Launch OHIF Button */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-4 text-xs flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold shadow-soft rounded-full"
              onClick={() => openImagesMutation.mutate()}
              disabled={openImagesMutation.isPending}
              title="Launch study in OHIF PACS Viewer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
              {openImagesMutation.isPending ? 'Launching...' : 'Open OHIF'}
            </Button>
          </div>
        </div>

        {/* Stale Tab Conflict Banner */}
        {saveStatus === 'conflict' && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span className="font-bold">
                This report draft was modified in another session. Please reload to prevent overwriting changes.
              </span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-3 text-xs flex items-center gap-1 shrink-0 rounded-full font-bold"
              onClick={handleReload}
            >
              <RefreshCw className="h-3 w-3" />
              Reload Latest Draft
            </Button>
          </div>
        )}
      </div>

      {/* 2. MAIN WORKSPACE GRID: TWO-COLUMN CLINICAL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: PACS, CLINICAL CONTEXT, MEASUREMENTS & KEY IMAGES (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card A: PACS & Imaging Launcher */}
          <Card className="border border-[#dce6e0] bg-white shadow-soft rounded-3xl overflow-hidden">
            <CardHeader className="p-4 border-b border-[#e9f1ed] flex flex-row items-center justify-between bg-white">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 text-emerald-600" />
                PACS &amp; Image Viewer
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono font-bold border-emerald-300 text-emerald-800 bg-emerald-50 rounded-full">
                Orthanc PACS Online
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="p-3.5 bg-[#f8faf8] border border-[#dce6e0] rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#152B42]">OHIF Diagnostic Web Viewer</div>
                  <div className="text-[11px] text-[#65758A] mt-0.5">
                    {studyInstancesData?.series ? `${studyInstancesData.series.length} series available` : 'Series matched to accession'}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs h-8 px-3 shadow-xs flex items-center gap-1.5"
                  onClick={() => openImagesMutation.mutate()}
                  disabled={openImagesMutation.isPending}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {openImagesMutation.isPending ? 'Connecting...' : 'Launch OHIF'}
                </Button>
              </div>

              {studyInstancesData?.series && studyInstancesData.series.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-[#65758A] uppercase tracking-wide block">
                    DICOM Series Breakdown
                  </span>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {studyInstancesData.series.map((s, idx) => (
                      <div
                        key={s.seriesInstanceUid}
                        className="p-2 bg-slate-50 border border-slate-100 rounded flex items-center justify-between text-xs"
                      >
                        <div className="truncate">
                          <span className="font-mono text-[10px] text-[#2563EB] mr-2">#{idx + 1}</span>
                          <span className="text-[#152B42] font-medium">{s.description || s.modality || 'Series'}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 border-slate-200 text-slate-700 bg-white">
                          {s.instances.length} imgs
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card B: Clinical Context & Indication */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#152B42] flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-[#2563EB]" />
                Clinical Context & Indication
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5 text-xs">
              <div>
                <span className="text-[11px] text-[#65758A] block">Clinical Indication:</span>
                <p className="font-medium text-[#152B42] mt-0.5 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                  {workspace.order.clinicalIndication || 'No specific clinical indication noted.'}
                </p>
              </div>

              {studyContext?.order?.referringDoctor && (
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[11px] text-[#65758A]">Referring Physician:</span>
                  <span className="font-semibold text-[#152B42]">{studyContext.order.referringDoctor.name}</span>
                </div>
              )}

              {studyContext?.order?.protocol && (
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[11px] text-[#65758A]">Scan Protocol:</span>
                  <span className="font-medium text-[#152B42]">{studyContext.order.protocol.name}</span>
                </div>
              )}

              {studyContext?.acceptedAcquisition?.qaNotes && (
                <div>
                  <span className="text-[11px] text-[#65758A] block">Technologist Acquisition Notes:</span>
                  <p className="text-slate-700 mt-0.5 italic bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    &ldquo;{studyContext.acceptedAcquisition.qaNotes}&rdquo;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card C: Measurements & Key Images */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#152B42] flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-[#D97706]" />
                Measurements & Key Images
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex items-center gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
                  onClick={() => {
                    setMLabel(`Measurement ${measurements.length + 1}`);
                    setShowAddMeasurementDialog(true);
                  }}
                  disabled={saveStatus === 'conflict' || !draftExists || !!workspace?.finalizedReport}
                >
                  <Plus className="h-3 w-3" />
                  Meas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex items-center gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
                  onClick={handleOpenAddKeyImageDialog}
                  disabled={saveStatus === 'conflict' || !draftExists || !!workspace?.finalizedReport}
                  title="Add Key Image"
                  data-testid="btn-add-key-image"
                >
                  <Plus className="h-3 w-3" />
                  Key Img
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3.5 space-y-3">
              {measurements.length === 0 && keyImages.length === 0 && (
                <div className="p-4 border border-dashed border-slate-200 rounded text-center text-xs text-[#65758A] bg-slate-50/50">
                  No measurements or key image references attached yet. Use the buttons above to link key findings from the viewer.
                </div>
              )}

              {/* Measurements List */}
              {measurements.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[#65758A] uppercase tracking-wide">
                    Measurements ({measurements.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {measurements.map((m) => {
                      const isKey = keyImages.some(
                        (k) => k.id === `key-${m.id}` || k.id === m.id
                      );

                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded border transition-colors flex items-start justify-between gap-2 text-xs ${
                            isKey
                              ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70'
                              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono px-1 py-0 bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20"
                              >
                                {m.toolType}
                              </Badge>
                              <span className="font-semibold text-[#152B42] truncate">{m.label}</span>
                              <span className="font-mono font-bold text-[#0284C7]">
                                {m.numericValue} {m.unit}
                              </span>
                              {isKey && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] font-semibold px-1 py-0 bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-0.5"
                                >
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  Key Image
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-[#65758A] font-mono flex items-center gap-2">
                              <span>
                                Slice #{m.instanceNumber ?? '—'}{' '}
                                {m.sliceLocation !== undefined ? `(${m.sliceLocation} mm)` : ''}
                              </span>
                              {m.createdAt && (
                                <span className="text-slate-400">
                                  {new Date(m.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                            {m.findingText && (
                              <div className="text-[11px] text-slate-600 italic mt-0.5">
                                &ldquo;{m.findingText}&rdquo;
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant={isKey ? 'default' : 'outline'}
                              className={`h-6 px-1.5 text-[10px] font-medium flex items-center gap-1 ${
                                isKey
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                                  : 'text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title={isKey ? 'Remove from Key Images' : 'Mark as Key Image'}
                              onClick={() => handleToggleKeyImage(m.id)}
                              disabled={!!workspace?.finalizedReport}
                            >
                              <Star className={`h-2.5 w-2.5 ${isKey ? 'fill-current' : ''}`} />
                              Key
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-500 hover:text-[#2563EB]"
                              title="View in PACS Viewer"
                              onClick={() => handleViewReference(m.seriesInstanceUid, m.sopInstanceUid)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                              title="Remove Measurement"
                              onClick={() => handleRemoveMeasurement(m.id)}
                              disabled={saveStatus === 'conflict' || !!workspace?.finalizedReport}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Key Images List */}
              {keyImages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[#65758A] uppercase tracking-wide">
                    Key Images ({keyImages.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {keyImages.map((k) => (
                      <div
                        key={k.id}
                        className="p-2 rounded border border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 transition-colors flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0 bg-amber-50 text-amber-800 border-amber-200">
                              <ImageIcon className="h-2.5 w-2.5 inline mr-1" />
                              Key Img
                            </Badge>
                            <span className="font-semibold text-[#152B42] truncate">{k.label}</span>
                          </div>
                          <div className="text-[10px] text-[#65758A] font-mono">
                            Slice #{k.instanceNumber ?? '—'}{' '}
                            {k.sliceLocation !== undefined ? `(${k.sliceLocation} mm)` : ''}
                          </div>
                          {k.description && (
                            <div className="text-[11px] text-slate-600 italic mt-0.5">
                              &ldquo;{k.description}&rdquo;
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-slate-500 hover:text-[#2563EB]"
                            title="View in PACS Viewer"
                            onClick={() => handleViewReference(k.seriesInstanceUid, k.sopInstanceUid)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                            title="Remove Key Image"
                            onClick={() => handleRemoveKeyImage(k.id)}
                            disabled={saveStatus === 'conflict' || !!workspace?.finalizedReport}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: REPORT AUTHORING & FINALIZATION (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* FINALIZED REPORT BANNER & CONTROLS */}
          {workspace?.finalizedReport ? (
            <Card className="border border-emerald-200 bg-white shadow-xs">
              <CardHeader className="p-4 border-b border-emerald-100 bg-emerald-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#059669] shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                        <span>FINALIZED DIAGNOSTIC REPORT</span>
                        <Badge className="bg-[#059669] text-white text-[10px]">
                          v{versionHistorySummary?.currentVersion || workspace.finalizedReport.version}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-[#65758A] mt-0.5">
                        Finalized by {workspace.finalizedReport.radiologist?.name || workspace.finalizedReport.signedBy?.name || 'Radiologist'} •{' '}
                        {workspace.finalizedReport.finalizedAt ? formatDate(workspace.finalizedReport.finalizedAt) : 'Recorded'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 shadow-xs flex items-center gap-1 font-semibold"
                      onClick={handleGeneratePdf}
                      disabled={isGeneratingPdf}
                    >
                      {isGeneratingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-[#2563EB]/30 text-[#2563EB] bg-white hover:bg-[#2563EB]/10 shadow-xs flex items-center gap-1 font-semibold"
                      onClick={handleSendToReception}
                      disabled={isSendingToReception}
                    >
                      <Send className="h-3 w-3" />
                      Send to Front Desk
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-xs flex items-center gap-1"
                      onClick={() => setIsVersionHistoryOpen(true)}
                    >
                      <History className="h-3 w-3" />
                      History
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-300 text-amber-800 bg-white hover:bg-amber-50 shadow-xs flex items-center gap-1 font-semibold"
                      onClick={() => {
                        setAmendmentModalType('CORRECTION');
                        setIsAmendmentModalOpen(true);
                      }}
                    >
                      Addendum / Correction
                    </Button>
                  </div>
                </div>

                {pdfNotification && (
                  <div
                    className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 border ${pdfNotification.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                  >
                    {pdfNotification.type === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    )}
                    <span>{pdfNotification.message}</span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#65758A] block mb-1">
                    Findings
                  </span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-[#152B42] whitespace-pre-wrap leading-relaxed shadow-xs">
                    {versionHistorySummary?.latestEffectiveContent?.findings || workspace.finalizedReport.findings || '(No findings recorded)'}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#65758A] block mb-1">
                    Impression
                  </span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono font-semibold text-[#152B42] whitespace-pre-wrap leading-relaxed shadow-xs">
                    {versionHistorySummary?.latestEffectiveContent?.impression || workspace.finalizedReport.impression || '(No impression recorded)'}
                  </div>
                </div>

                <div className="p-3 bg-white border border-emerald-200 rounded text-slate-700 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Fingerprint className="h-4 w-4 shrink-0 text-[#059669]" />
                    <div>
                      <span className="font-semibold text-emerald-950 block text-xs">
                        Tamper-Evident Electronic Signature Applied
                      </span>
                      <span className="text-[11px] text-[#65758A]">
                        Electronic approval recorded • HMAC-SHA256 integrity signature applied
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px] font-mono shrink-0">
                    VERIFIED SIGNATURE
                  </Badge>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[#65758A] flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    This diagnostic report is officially finalized. Direct editing is locked to preserve clinical record integrity.
                    Any amendments must be issued as auditable addenda.
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : !draftExists ? (
            /* TEMPLATE SELECTION CARD (No draft yet) */
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#152B42] flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  Select Reporting Template
                </CardTitle>
                <p className="text-xs text-[#65758A] mt-1">
                  Choose an approved clinical template matching modality{' '}
                  <strong className="text-[#152B42]">{workspace?.order.modality}</strong> and body region{' '}
                  <strong className="text-[#152B42]">{workspace?.order.bodyPart}</strong> to initialize report sections.
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workspace?.templates.map((tpl: ReportingTemplateSummary) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected
                          ? 'border-[#2563EB] bg-[#2563EB]/5 shadow-xs ring-1 ring-[#2563EB]'
                          : 'border-slate-200 hover:border-[#2563EB] bg-white hover:bg-slate-50/50'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-[#152B42]">
                            {tpl.name}
                          </span>
                          {tpl.isRecommended && (
                            <Badge className="bg-[#059669] text-white text-[10px] px-1.5 py-0 shrink-0">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {tpl.description && (
                          <p className="text-[11px] text-[#65758A] mt-1 line-clamp-2">
                            {tpl.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tpl.sections.map((sec) => (
                            <span
                              key={sec}
                              className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs h-9 px-4 shadow-xs flex items-center gap-1.5"
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
                        Start Report with Selected Template
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* ACTIVE DRAFT EDITOR CARD */
            <Card className="border border-slate-200 bg-white shadow-xs space-y-4">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[#65758A]">Template:</span>
                    <span className="font-semibold text-[#152B42]">
                      {workspace?.draft?.templateName || 'Standard Structured Template'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-600 bg-slate-50">
                    Active Draft Mode
                  </Badge>
                </div>

                {/* Voice Dictation Control Bar */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#152B42] flex items-center gap-1.5">
                        <Mic
                          className={`h-4 w-4 ${dictationState === 'listening'
                            ? 'text-red-600 animate-pulse'
                            : 'text-[#2563EB]'
                            }`}
                        />
                        <span>Voice Dictation:</span>
                      </span>

                      {/* Target Section Selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#65758A]">Section:</span>
                        <select
                          value={targetSection}
                          onChange={(e) => {
                            setTargetSection(e.target.value);
                            targetSectionRef.current = e.target.value;
                          }}
                          disabled={dictationState === 'listening'}
                          className="text-xs bg-white border border-slate-200 rounded px-2 py-1 font-medium text-[#152B42] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer shadow-xs"
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
                          className="h-7 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium flex items-center gap-1.5 shadow-xs"
                          onClick={handleStartDictation}
                          disabled={
                            dictationState === 'unavailable' ||
                            saveStatus === 'conflict' ||
                            createDraftMutation.isPending
                          }
                        >
                          <Mic className="h-3 w-3" />
                          Start Dictation
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs font-medium flex items-center gap-1.5 animate-pulse shadow-xs"
                          onClick={handleStopDictation}
                        >
                          <Square className="h-3 w-3 fill-current" />
                          Stop Dictation
                        </Button>
                      )}

                      {/* Status Badges */}
                      {dictationState === 'ready' && (
                        <Badge variant="outline" className="text-xs font-normal text-[#65758A] border-slate-200 bg-white py-0.5">
                          Ready
                        </Badge>
                      )}

                      {dictationState === 'listening' && (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200 text-xs font-semibold py-0.5 flex items-center gap-1.5"
                        >
                          <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                          Listening...
                        </Badge>
                      )}

                      {dictationState === 'unavailable' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs py-0.5">
                          Speech Unavailable
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Hearing Preview */}
                  {dictationState === 'listening' && hearingPreview && (
                    <div className="text-xs italic text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1.5 rounded border border-[#2563EB]/20 flex items-center gap-2">
                      <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#2563EB] animate-pulse" />
                      <span>Hearing: &ldquo;{hearingPreview}&rdquo;</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Structured Fields */}
              <CardContent className="p-4 space-y-4">
                {Object.keys(draftContent).map((section) => {
                  const isIndication = section.toLowerCase().includes('indication');
                  const isImpression = section.toLowerCase().includes('impression');
                  const isFindings = section.toLowerCase().includes('findings');
                  const isSectionActiveForDictation =
                    targetSection === section && dictationState === 'listening';

                  return (
                    <div key={section} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#152B42] flex items-center gap-1.5">
                          {section}
                          {isIndication && (
                            <span className="text-[10px] font-normal lowercase text-[#65758A]">
                              (order indication)
                            </span>
                          )}
                          {isImpression && (
                            <span className="text-[10px] font-semibold text-[#0284C7] lowercase">
                              *core conclusion
                            </span>
                          )}
                          {isSectionActiveForDictation && (
                            <span className="text-[10px] font-semibold text-red-600 lowercase flex items-center gap-1">
                              <Mic className="h-3 w-3" />
                              (dictating...)
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
                        rows={isFindings ? 6 : isImpression ? 4 : 2}
                        className={`w-full rounded-md border border-slate-200 p-2.5 text-xs bg-white text-[#152B42] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] font-sans leading-relaxed transition-all shadow-xs ${isSectionActiveForDictation
                          ? 'ring-2 ring-red-500 border-red-500'
                          : ''
                          } ${saveStatus === 'conflict' ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''
                          }`}
                      />
                    </div>
                  );
                })}

                {/* Workspace Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Peer Review Action */}
                    {orderPeerReview ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`text-xs h-8 flex items-center gap-1.5 shadow-xs ${orderPeerReview.status === 'COMPLETED'
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                          : 'border-amber-300 text-amber-800 bg-amber-50'
                          }`}
                        onClick={() => setIsPeerReviewDetailOpen(true)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {orderPeerReview.status === 'COMPLETED'
                          ? 'Peer Review Complete'
                          : `Peer Review (${orderPeerReview.status})`}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 flex items-center gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs"
                        onClick={() => setIsPeerReviewRequestOpen(true)}
                      >
                        <Users className="h-3.5 w-3.5 text-[#2563EB]" />
                        Request Peer Review
                      </Button>
                    )}

                    {/* Critical Finding Alert (Icon + Text + Red Semantic Treatment, No Animation) */}
                    {orderCriticalFinding ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`text-xs h-8 flex items-center gap-1.5 shadow-xs ${orderCriticalFinding.status === 'ACKNOWLEDGED'
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                          : 'border-red-300 text-red-800 bg-red-50'
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
                        className="text-xs h-8 flex items-center gap-1.5 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 shadow-xs"
                        onClick={() => setIsCriticalFindingRequestOpen(true)}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        Flag Critical Finding
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Save Draft */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 shadow-xs"
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

                    {/* Primary Finalize Action */}
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs bg-[#059669] hover:bg-[#047857] text-white font-semibold flex items-center gap-1.5 shadow-xs"
                      onClick={() => setIsReviewSignModalOpen(true)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Review & Final Sign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 3. MODAL DIALOGS */}
      {/* Add Measurement Dialog */}
      <Dialog open={showAddMeasurementDialog} onOpenChange={setShowAddMeasurementDialog}>
        <DialogContent className="max-w-md bg-white border border-slate-200 text-[#152B42] shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-[#152B42]">
              <Ruler className="h-4 w-4 text-[#D97706]" />
              Add Image Measurement Reference
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMeasurementSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">Tool / Measurement Type</label>
              <select
                value={mToolType}
                onChange={(e) => setMToolType(e.target.value as OhifMeasurementToolType)}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 shadow-xs focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="Length">Length (linear dimension)</option>
                <option value="Bidirectional">Bidirectional (cross-product)</option>
                <option value="Ellipse">Ellipse / ROI (area & density)</option>
                <option value="Angle">Angle (Cobb / joint angle)</option>
                <option value="ArrowAnnotate">Annotation Arrow</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">Measurement Label</label>
              <input
                type="text"
                placeholder="e.g. Left Renal Cyst, Hepatic Lesion #1"
                value={mLabel}
                onChange={(e) => setMLabel(e.target.value)}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 shadow-xs focus:ring-1 focus:ring-[#2563EB]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#65758A] uppercase">Value</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="24.5"
                  value={mValue}
                  onChange={(e) => setMValue(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 font-mono shadow-xs focus:ring-1 focus:ring-[#2563EB]"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#65758A] uppercase">Unit</label>
                <input
                  type="text"
                  placeholder="mm, cm, deg, HU"
                  value={mUnit}
                  onChange={(e) => setMUnit(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 font-mono shadow-xs focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">DICOM Series Reference</label>
              <select
                value={mSeriesUid}
                onChange={(e) => setMSeriesUid(e.target.value)}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 font-mono shadow-xs focus:ring-1 focus:ring-[#2563EB]"
              >
                {studyInstancesData?.series.map((s, idx) => (
                  <option key={s.seriesInstanceUid} value={s.seriesInstanceUid}>
                    #{idx + 1}: {s.description || s.modality} ({s.instances.length} imgs)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">Clinical Finding Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Well-circumscribed, non-enhancing"
                value={mFinding}
                onChange={(e) => setMFinding(e.target.value)}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 shadow-xs focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddMeasurementDialog(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs">
                Attach Measurement
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Key Image Dialog */}
      <Dialog open={showAddKeyImageDialog} onOpenChange={setShowAddKeyImageDialog}>
        <DialogContent className="max-w-md bg-white border border-slate-200 text-[#152B42] shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-[#152B42]">
              <ImageIcon className="h-4 w-4 text-[#D97706]" />
              Add Key Image Reference
            </DialogTitle>
          </DialogHeader>

          {viewerWindowRef.current && !viewerWindowRef.current.closed && (
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-md flex items-center justify-between text-xs text-[#2563EB]">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[#2563EB]" />
                <span className="font-medium">OHIF Viewer Connected</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[11px] border-sky-300 text-sky-800 bg-white hover:bg-sky-100"
                onClick={() => {
                  viewerWindowRef.current?.postMessage(
                    {
                      type: 'RIS_CAPTURE_KEY_IMAGE_REQUEST',
                      label: kLabel.trim() || `Key Image ${keyImages.length + 1}`,
                    },
                    '*'
                  );
                }}
              >
                Capture Active Slice
              </Button>
            </div>
          )}

          <form onSubmit={handleAddKeyImageSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">Key Image Title</label>
              <input
                type="text"
                placeholder="e.g. Axial T2 demonstrating focal lesion"
                value={kLabel}
                onChange={(e) => setKLabel(e.target.value)}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 shadow-xs focus:ring-1 focus:ring-[#2563EB]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#65758A] uppercase">DICOM Series Reference</label>
                <select
                  value={kSeriesUid}
                  onChange={(e) => {
                    const newSeriesUid = e.target.value;
                    setKSeriesUid(newSeriesUid);
                    const seriesObj = studyInstancesData?.series?.find((s) => s.seriesInstanceUid === newSeriesUid);
                    if (seriesObj?.instances && seriesObj.instances.length > 0) {
                      setKSopUid(seriesObj.instances[0].sopInstanceUid);
                    } else {
                      setKSopUid('');
                    }
                  }}
                  className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 font-mono shadow-xs focus:ring-1 focus:ring-[#2563EB] truncate"
                >
                  {studyInstancesData?.series?.map((s, idx) => (
                    <option key={s.seriesInstanceUid} value={s.seriesInstanceUid}>
                      #{idx + 1}: {s.description || (s as any).seriesDescription || s.modality} ({s.instances.length} imgs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#65758A] uppercase">Slice / Instance</label>
                <select
                  value={kSopUid}
                  onChange={(e) => setKSopUid(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 font-mono shadow-xs focus:ring-1 focus:ring-[#2563EB] truncate"
                >
                  {(() => {
                    const currentSeries =
                      studyInstancesData?.series?.find((s) => s.seriesInstanceUid === kSeriesUid) ||
                      studyInstancesData?.series?.[0];
                    if (!currentSeries || !currentSeries.instances || currentSeries.instances.length === 0) {
                      return <option value="">No slices available</option>;
                    }
                    return currentSeries.instances.map((inst) => (
                      <option key={inst.sopInstanceUid} value={inst.sopInstanceUid}>
                        Slice #{inst.instanceNumber ?? '—'} {inst.sliceLocation !== undefined ? `(${inst.sliceLocation} mm)` : ''}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#65758A] uppercase">Description / Caption (Optional)</label>
              <textarea
                placeholder="Annotated key image for clinical demonstration"
                value={kDescription}
                onChange={(e) => setKDescription(e.target.value)}
                rows={2}
                className="w-full text-xs rounded border border-slate-200 bg-white text-[#152B42] p-2 shadow-xs focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddKeyImageDialog(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs" data-testid="submit-add-key-image">
                Add Key Image
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Peer Review Submodals */}
      <PeerReviewRequestModal
        isOpen={isPeerReviewRequestOpen}
        onOpenChange={setIsPeerReviewRequestOpen}
        orderId={orderId}
        patientName={workspace.order.patientName}
        patientId={workspace.order.patientId}
        accessionNumber={workspace.order.accessionNumber}
        modality={workspace.order.modality}
        procedureName={workspace.order.examinationName}
      />
      <PeerReviewDetailModal
        isOpen={isPeerReviewDetailOpen}
        onOpenChange={setIsPeerReviewDetailOpen}
        orderId={orderId}
      />

      {/* Critical Finding Submodals */}
      <CriticalFindingRequestModal
        isOpen={isCriticalFindingRequestOpen}
        onOpenChange={setIsCriticalFindingRequestOpen}
        orderId={orderId}
        patientName={workspace.order.patientName}
        patientId={workspace.order.patientId}
        accessionNumber={workspace.order.accessionNumber}
        modality={workspace.order.modality}
        procedureName={workspace.order.examinationName}
      />
      <CriticalFindingDetailModal
        isOpen={isCriticalFindingDetailOpen}
        onOpenChange={setIsCriticalFindingDetailOpen}
        findingId={orderCriticalFinding?.id || null}
      />

      {/* Version History Modal */}
      <ReportVersionHistoryModal
        open={isVersionHistoryOpen}
        onOpenChange={setIsVersionHistoryOpen}
        orderId={orderId}
        patientId={workspace.order.patientId}
        accessionNumber={workspace.order.accessionNumber}
        onOpenAmendment={(type) => {
          setAmendmentModalType(type);
          setIsVersionHistoryOpen(false);
          setIsAmendmentModalOpen(true);
        }}
      />

      {/* Amendment Modal */}
      <ReportAmendmentModal
        open={isAmendmentModalOpen}
        onOpenChange={setIsAmendmentModalOpen}
        orderId={orderId}
        patientId={workspace.order.patientId}
        accessionNumber={workspace.order.accessionNumber}
        currentVersion={versionHistorySummary?.currentVersion || workspace.finalizedReport?.version || 1}
        initialType={amendmentModalType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
          queryClient.invalidateQueries({ queryKey: ['reportVersionHistory', orderId] });
        }}
      />

      {/* Report Review & Final Sign Modal */}
      <ReportReviewSignModal
        isOpen={isReviewSignModalOpen}
        onClose={() => setIsReviewSignModalOpen(false)}
        orderId={orderId}
        accessionNumber={workspace.order.accessionNumber}
        patientId={workspace.order.patientId}
        patientName={workspace.order.patientName}
        modality={workspace.order.modality}
        examinationName={workspace.order.examinationName}
        draftVersion={draftVersion}
        findings={draftContent['Findings'] || draftContent['findings'] || Object.values(draftContent).join('\n\n')}
        impression={draftContent['Impression'] || draftContent['impression'] || ''}
        measurementsCount={measurements.length}
        keyImagesCount={keyImages.length}
        signerName="Dr. Sarah Lin, MD"
        signerEmail="sarah.lin@radaxis.internal"
        signerRole="RADIOLOGIST"
        onSuccess={() => {
          setIsReviewSignModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['radiologistReportWorkspace', orderId] });
          queryClient.invalidateQueries({ queryKey: ['radiologistWorklist'] });
        }}
      />
    </div>
  );
};

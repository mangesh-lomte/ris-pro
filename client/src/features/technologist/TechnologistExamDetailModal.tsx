import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { TechnologistSafetyScreeningModal } from './TechnologistSafetyScreeningModal';
import { TechnologistPreparationModal } from './TechnologistPreparationModal';
import { technologistService } from '../../services/technologistService';
import { calculateAge, formatDate, formatWaitingDuration } from '../../utils/formatters';
import { formatSafeErrorMessage } from '../../lib/api';
import { PacsStatusData } from '../../types';
import {
  User,
  Calendar,
  Clock,
  HardDrive,
  FileText,
  AlertCircle,
  Building,
  CheckCircle2,
  Stethoscope,
  ShieldAlert,
  ShieldCheck,
  Play,
  XCircle,
  AlertTriangle,
  Syringe,
  RefreshCw,
} from 'lucide-react';
import { TechnologistScanLifecycleModal } from './TechnologistScanLifecycleModal';
import { TechnologistContrastModal } from './TechnologistContrastModal';
import { TechnologistIncidentModal } from './TechnologistIncidentModal';
import { TechnologistImageQualityModal } from './TechnologistImageQualityModal';

interface TechnologistExamDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
}

export function TechnologistExamDetailModal({
  open,
  onOpenChange,
  examId,
}: TechnologistExamDetailModalProps) {
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [preparationModalOpen, setPreparationModalOpen] = useState(false);
  const [scanLifecycleModalOpen, setScanLifecycleModalOpen] = useState(false);
  const [contrastModalOpen, setContrastModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [qaModalOpen, setQaModalOpen] = useState(false);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['technologist', 'exam-detail', examId],
    queryFn: () => (examId ? technologistService.getWorklistItem(examId) : null),
    enabled: !!examId && open,
  });

  const {
    data: pacsStatus,
    refetch: refetchPacs,
    isFetching: isPacsFetching,
  } = useQuery<PacsStatusData>({
    queryKey: ['integrations', 'pacs', 'status'],
    queryFn: () => technologistService.getPacsStatus(),
    enabled: open,
    staleTime: 5000,
  });

  if (!open || !examId) return null;

  const activeMilestone = detail ? (
    ['PACS_READY', 'PACS_HANDOFF_PENDING', 'PACS_HANDOFF_COMPLETE', 'PACS_HANDOFF_FAILED'].includes(detail.order.orderStatus)
      ? 4
      : ['IMAGE_QA_PENDING', 'IMAGE_ACCEPTED', 'REPEAT_REQUIRED', 'IMAGE_REJECTED'].includes(detail.order.orderStatus)
      ? 3
      : ['SCAN_IN_PROGRESS', 'SCAN_INTERRUPTED', 'SCAN_COMPLETED', 'SCAN_CANCELLED'].includes(detail.order.orderStatus)
      ? 2
      : 1
  ) : 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>Technologist Clinical Exam Context</DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clinical Context Review & Pre-Acquisition Gate
                  </p>
                </div>
              </div>
              {detail && <StatusBadge status={detail.order.orderStatus} />}
            </div>
          </DialogHeader>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-20 bg-slate-100 rounded animate-pulse" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : error || !detail ? (
          <div className="p-6 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-semibold">Unable to load exam details</p>
            <p className="text-xs text-slate-500">
              {formatSafeErrorMessage(error, 'Record may have moved or expired.')}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Clinical Sequence Progression Stepper */}
            <div className="grid grid-cols-4 gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200 text-center text-xs">
              {[
                { step: 1, label: '1. READY', desc: 'Safety & Prep' },
                { step: 2, label: '2. SCANNING', desc: 'Acquisition' },
                { step: 3, label: '3. QUALITY REVIEW', desc: 'QC Verification' },
                { step: 4, label: '4. PACS HANDOFF', desc: 'Archival & Triage' },
              ].map((s) => {
                const isCurrent = activeMilestone === s.step;
                const isPast = activeMilestone > s.step;
                return (
                  <div
                    key={s.step}
                    className={`p-2 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
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
                        isCurrent ? 'text-indigo-100' : isPast ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {s.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prominent Identifiers Banner: Single Source of Truth */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Core Clinical Identifiers (Immutable)</span>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED MATCH
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Patient Identification (MRN)
                  </span>
                  <div className="flex items-center gap-2">
                    <IdentifierPill type="patient" value={detail.patient.patientId} />
                    <span className="text-xs text-slate-300 font-medium">
                      {detail.patient.firstName} {detail.patient.lastName}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Order Accession Number
                  </span>
                  <div className="flex items-center gap-2">
                    <IdentifierPill type="accession" value={detail.order.accessionNumber} />
                    <Badge variant="outline" className="text-cyan-300 border-cyan-800 text-[10px]">
                      {detail.order.modality}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid Layout: Patient Details & Examination Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Demographics */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-800 font-semibold text-xs">
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Patient Demographics</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Full Name</span>
                    <span className="font-semibold text-slate-800">
                      {detail.patient.firstName} {detail.patient.middleName || ''}{' '}
                      {detail.patient.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Gender</span>
                    <span className="font-medium text-slate-700 capitalize">
                      {detail.patient.gender.toLowerCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Date of Birth</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(detail.patient.dateOfBirth)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Age</span>
                    <span className="font-medium text-slate-700">
                      {calculateAge(detail.patient.dateOfBirth)} yrs
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase">Phone</span>
                    <span className="font-mono text-slate-700">{detail.patient.phone}</span>
                  </div>
                </div>
              </div>

              {/* Examination Context */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-slate-800 font-semibold text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Examination Details</span>
                  </div>
                  <PriorityBadge priority={detail.order.priority} />
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Procedure Name</span>
                    <span className="font-semibold text-slate-800">
                      {detail.order.examinationName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Modality</span>
                      <span className="font-medium text-slate-700">{detail.order.modality}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Target Body Part</span>
                      <span className="font-medium text-slate-700">{detail.order.bodyPart}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Referring Doctor</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                      {detail.order.referringDoctor?.name || 'Hospital Inpatient Attending'}
                      {detail.order.referringDoctor?.organization && (
                        <span className="text-slate-400 text-[11px]">
                          ({detail.order.referringDoctor.organization})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Appointment & Machine Logistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Appointment Schedule & Arrival */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-slate-800 font-semibold text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>Appointment Logistics</span>
                  </div>
                  {detail.tokenNumber && (
                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 rounded font-mono font-bold text-[11px]">
                      Token {detail.tokenNumber}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Scheduled Date</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(detail.scheduledStart)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Scheduled Time</span>
                    <span className="font-medium text-slate-700">
                      {new Date(detail.scheduledStart).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Checked-In Time</span>
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      {detail.checkedInAt
                        ? new Date(detail.checkedInAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Waiting Duration</span>
                    <span className="font-semibold text-amber-700">
                      {formatWaitingDuration(detail.waitingMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Equipment Context */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-slate-800 font-semibold text-xs">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-500" />
                    <span>Assigned Equipment</span>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
                    {detail.equipment?.status || 'AVAILABLE'}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Machine Name</span>
                    <span className="font-bold text-slate-800">
                      {detail.equipment?.name || 'Unassigned Scanner'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Location / Suite</span>
                    <span className="font-medium text-slate-700">
                      {detail.equipment?.location || 'Radiology Department'}
                    </span>
                  </div>
                  {detail.equipment?.manufacturer && (
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Model</span>
                      <span className="text-slate-600">
                        {detail.equipment.manufacturer} {detail.equipment.model}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clinical Indication */}
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-lg space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                Clinical Indication & Ordering Notes
              </span>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">
                {detail.order.clinicalIndication}
              </p>
            </div>

            {/* Safety & Preparation Gate Cards */}
            {detail.order.orderStatus === 'SCAN_IN_PROGRESS' ? (
              <div className="p-4 bg-sky-50 border border-sky-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="relative flex h-3 w-3 mt-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-600"></span>
                  </span>
                  <div>
                    <span className="font-bold text-sky-950 text-xs block mb-0.5">
                      Active Scan Acquisition in Progress
                    </span>
                    <p className="text-[11px] leading-relaxed text-sky-800">
                      Scan acquisition is currently underway. Manage interruption or completion from the lifecycle console.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {detail.order.contrastRequired && (
                    <Button
                      size="sm"
                      onClick={() => setContrastModalOpen(true)}
                      className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                    >
                      <Syringe className="w-3.5 h-3.5" />
                      Record Contrast
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIncidentModalOpen(true)}
                    className="text-xs font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Report Incident
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setScanLifecycleModalOpen(true)}
                    className="shrink-0 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    Manage Active Scan
                  </Button>
                </div>
              </div>
            ) : detail.order.orderStatus === 'SCAN_INTERRUPTED' ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950 text-xs block mb-0.5">
                      Scan Acquisition: INTERRUPTED
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Scan acquisition is temporarily paused. Resume acquisition when ready, or cancel if unable to proceed.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIncidentModalOpen(true)}
                    className="text-xs font-semibold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Report Incident
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setScanLifecycleModalOpen(true)}
                    className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Resume / Cancel Scan
                  </Button>
                </div>
              </div>
            ) : detail.order.orderStatus === 'SCAN_COMPLETED' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">
                      Scan Acquisition: COMPLETED
                    </span>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      Operational scan acquisition workflow is complete. Exam is ready for technologist image quality review.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScanLifecycleModalOpen(true)}
                    className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    View Scan
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setQaModalOpen(true)}
                    className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
                  >
                    Image Quality Review &rarr;
                  </Button>
                </div>
              </div>
            ) : detail.order.orderStatus === 'IMAGE_QA_PENDING' ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950 text-xs block mb-0.5">
                      Image Quality Review: IN PROGRESS
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Technologist image inspection underway. Accept, mark repeat required, or reject.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setQaModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Continue QA Review
                </Button>
              </div>
            ) : detail.order.orderStatus === 'REPEAT_REQUIRED' || detail.order.orderStatus === 'IMAGE_REJECTED' ? (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950 text-xs block mb-0.5">
                      Image Quality: {detail.order.orderStatus.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] leading-relaxed text-rose-800">
                      Quality review rejected images or flagged for repeat. Authorize a repeat scan attempt to unlock scanner acquisition.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setQaModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Authorize Repeat Scan
                </Button>
              </div>
            ) : detail.order.orderStatus === 'IMAGE_ACCEPTED' || detail.order.orderStatus === 'PACS_READY' ? (
              pacsStatus?.adapter === 'orthanc' && !pacsStatus?.connected ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-amber-950 text-xs">
                          PACS Unavailable
                        </span>
                        <Badge variant="outline" className="border-amber-400 text-amber-800 text-[10px] font-mono">
                          ORTHANC OFFLINE
                        </Badge>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-900">
                        Orthanc is currently unreachable. RIS workflow data remains available.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchPacs()}
                      disabled={isPacsFetching}
                      className="text-xs font-semibold border-amber-300 text-amber-900 bg-white hover:bg-amber-100 gap-1.5 h-8 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isPacsFetching ? 'animate-spin' : ''}`} />
                      <span>Retry PACS Connection</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setQaModalOpen(true)}
                      className="text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white h-8"
                    >
                      View QA Context
                    </Button>
                  </div>
                </div>
              ) : pacsStatus?.adapter === 'orthanc' ? (
                <div className="p-4 bg-sky-50 border border-sky-300 rounded-xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-950 text-xs block mb-0.5">
                        Image Quality: ACCEPTED (PACS Ready)
                      </span>
                      <p className="text-[11px] leading-relaxed text-sky-800">
                        Quality verified. Real Orthanc mode active. Check study reconciliation context.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setQaModalOpen(true)}
                    className="shrink-0 text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white"
                  >
                    Check PACS Study
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-sky-50 border border-sky-300 rounded-xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-950 text-xs block mb-0.5">
                        Image Quality: ACCEPTED (PACS Ready)
                      </span>
                      <p className="text-[11px] leading-relaxed text-sky-800">
                        Quality verified. Study context is reconciled with accession and ready for simulated PACS handoff.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setQaModalOpen(true)}
                    className="shrink-0 text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white"
                  >
                    Initiate PACS Handoff
                  </Button>
                </div>
              )
            ) : detail.order.orderStatus === 'PACS_HANDOFF_PENDING' ? (
              <div className="p-4 bg-indigo-50 border border-indigo-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <span className="font-bold text-indigo-950 text-xs block mb-0.5">
                      PACS Handoff: IN PROGRESS
                    </span>
                    <p className="text-[11px] leading-relaxed text-indigo-800">
                      Simulated integration transfer underway. Confirming study context receipt.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setQaModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  View PACS Status
                </Button>
              </div>
            ) : detail.order.orderStatus === 'PACS_HANDOFF_COMPLETE' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">
                      PACS Handoff: COMPLETED
                    </span>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      Study metadata handoff confirmed by simulated PACS gateway. Handed off to downstream archive.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQaModalOpen(true)}
                  className="shrink-0 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                >
                  View QA & PACS Summary
                </Button>
              </div>
            ) : detail.order.orderStatus === 'PACS_HANDOFF_FAILED' ? (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950 text-xs block mb-0.5">
                      PACS Handoff: FAILED
                    </span>
                    <p className="text-[11px] leading-relaxed text-rose-800">
                      PACS handoff attempt failed. Review error diagnosis and trigger controlled retry.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setQaModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white"
                >
                  Retry PACS Handoff
                </Button>
              </div>
            ) : detail.order.orderStatus === 'SCAN_CANCELLED' ? (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950 text-xs block mb-0.5">
                      Scan Acquisition: CANCELLED
                    </span>
                    <p className="text-[11px] leading-relaxed text-rose-800">
                      Scan was cancelled. All lifecycle actions for this workflow are locked.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScanLifecycleModalOpen(true)}
                  className="shrink-0 text-xs font-semibold border-rose-300 text-rose-800 hover:bg-rose-100"
                >
                  View Cancellation Details
                </Button>
              </div>
            ) : detail.order.orderStatus === 'READY_FOR_SCAN' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">
                      Workflow Milestone: READY FOR SCAN
                    </span>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      Patient preparation is complete and approved workflow protocol is confirmed.
                      Exam is authorized for scanner acquisition.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreparationModalOpen(true)}
                    className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    View Prep
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setScanLifecycleModalOpen(true)}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Scan
                  </Button>
                </div>
              </div>
            ) : detail.order.orderStatus === 'PREPARED' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">
                      Patient Preparation: COMPLETE
                    </span>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      All checklist preparation items are satisfied. Exam is unlocked for approved protocol confirmation.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setPreparationModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Confirm Protocol
                </Button>
              </div>
            ) : detail.order.orderStatus === 'PREPARATION_IN_PROGRESS' ? (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-950 text-xs block mb-0.5">
                      Patient Preparation: IN PROGRESS
                    </span>
                    <p className="text-[11px] leading-relaxed text-indigo-700">
                      Checklist preparation items are currently being fulfilled by the technologist.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setPreparationModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Continue Preparation
                </Button>
              </div>
            ) : detail.order.orderStatus === 'SAFETY_CLEARED' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block mb-0.5">
                      Patient Identity & Safety Screening: CLEARED
                    </span>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      Patient identity double-verified and all modality safety criteria satisfied.
                      Exam is authorized for technologist preparation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSafetyModalOpen(true)}
                    className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100/70"
                  >
                    Review Screening
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setPreparationModalOpen(true)}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Continue to Preparation
                  </Button>
                </div>
              </div>
            ) : detail.order.orderStatus === 'SAFETY_REVIEW' ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950 text-xs block mb-0.5">
                      Safety Review Required (Clinical Contraindications)
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Safety screening identified potential risks. Clinical review required before preparation.
                      Preparation actions disabled. No bypass.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSafetyModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Re-evaluate Screening
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-950 text-xs block mb-0.5">
                      Safety Screening Required Prior to Acquisition
                    </span>
                    <p className="text-[11px] leading-relaxed text-indigo-700">
                      Technologist must verify patient identity (min. 2 identifiers) and complete modality safety questionnaire.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setSafetyModalOpen(true)}
                  className="shrink-0 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Begin Safety Screening
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Overview
          </Button>
          {detail && (
            detail.order.orderStatus === 'SCAN_IN_PROGRESS' ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncidentModalOpen(true)}
                  className="text-xs font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Report Incident
                </Button>
                <Button
                  onClick={() => setScanLifecycleModalOpen(true)}
                  className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-sm"
                >
                  Manage Active Scan
                </Button>
              </div>
            ) : detail.order.orderStatus === 'SCAN_INTERRUPTED' ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncidentModalOpen(true)}
                  className="text-xs font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Report Incident
                </Button>
                <Button
                  onClick={() => setScanLifecycleModalOpen(true)}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
                >
                  Resume / Cancel Scan
                </Button>
              </div>
            ) : detail.order.orderStatus === 'SCAN_COMPLETED' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
              >
                Image Quality Review
              </Button>
            ) : detail.order.orderStatus === 'IMAGE_QA_PENDING' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
              >
                Continue QA Review
              </Button>
            ) : detail.order.orderStatus === 'REPEAT_REQUIRED' || detail.order.orderStatus === 'IMAGE_REJECTED' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-sm"
              >
                Authorize Repeat Scan
              </Button>
            ) : detail.order.orderStatus === 'IMAGE_ACCEPTED' || detail.order.orderStatus === 'PACS_READY' ? (
              pacsStatus?.adapter === 'orthanc' && !pacsStatus?.connected ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPacs()}
                    disabled={isPacsFetching}
                    className="gap-1.5 text-xs border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPacsFetching ? 'animate-spin' : ''}`} />
                    <span>Retry PACS Connection</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQaModalOpen(true)}
                    className="gap-1.5 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>View Image QA Context</span>
                  </Button>
                </div>
              ) : pacsStatus?.adapter === 'orthanc' ? (
                <Button
                  variant="clinical"
                  onClick={() => setQaModalOpen(true)}
                  className="gap-2 bg-sky-700 hover:bg-sky-800 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Check PACS Study</span>
                </Button>
              ) : (
                <Button
                  variant="clinical"
                  onClick={() => setQaModalOpen(true)}
                  className="gap-2 bg-sky-700 hover:bg-sky-800 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Initiate PACS Handoff</span>
                </Button>
              )
            ) : detail.order.orderStatus === 'PACS_HANDOFF_PENDING' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
              >
                View PACS Status
              </Button>
            ) : detail.order.orderStatus === 'PACS_HANDOFF_COMPLETE' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
              >
                View QA & PACS Summary
              </Button>
            ) : detail.order.orderStatus === 'PACS_HANDOFF_FAILED' ? (
              <Button
                onClick={() => setQaModalOpen(true)}
                className="text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white gap-1.5 shadow-sm"
              >
                Retry PACS Handoff
              </Button>
            ) : detail.order.orderStatus === 'SCAN_CANCELLED' ? (
              <Button
                variant="outline"
                onClick={() => setScanLifecycleModalOpen(true)}
                className="text-xs font-semibold border-rose-300 text-rose-800 hover:bg-rose-50"
              >
                View Cancellation
              </Button>
            ) : detail.order.orderStatus === 'READY_FOR_SCAN' ? (
              <Button
                onClick={() => setScanLifecycleModalOpen(true)}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Scan Acquisition
              </Button>
            ) : detail.order.orderStatus === 'PREPARED' ? (
              <Button
                onClick={() => setPreparationModalOpen(true)}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Protocol
              </Button>
            ) : detail.order.orderStatus === 'PREPARATION_IN_PROGRESS' ? (
              <Button
                onClick={() => setPreparationModalOpen(true)}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Continue Preparation
              </Button>
            ) : detail.order.orderStatus === 'SAFETY_CLEARED' ? (
              <Button
                onClick={() => setPreparationModalOpen(true)}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Continue to Preparation
              </Button>
            ) : detail.order.orderStatus === 'SAFETY_REVIEW' ? (
              <Button
                onClick={() => setSafetyModalOpen(true)}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Re-evaluate Safety Screening
              </Button>
            ) : (
              <Button
                onClick={() => setSafetyModalOpen(true)}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Safety Screening
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TechnologistSafetyScreeningModal
      open={safetyModalOpen}
      onOpenChange={setSafetyModalOpen}
      examId={examId}
    />

    <TechnologistPreparationModal
      open={preparationModalOpen}
      onOpenChange={setPreparationModalOpen}
      examId={examId}
    />

    <TechnologistScanLifecycleModal
      open={scanLifecycleModalOpen}
      onOpenChange={setScanLifecycleModalOpen}
      examId={examId}
      onOpenQualityReview={() => {
        setScanLifecycleModalOpen(false);
        setQaModalOpen(true);
      }}
    />

    <TechnologistContrastModal
      open={contrastModalOpen}
      onOpenChange={setContrastModalOpen}
      examId={examId}
      onOpenIncidentModal={() => {
        setContrastModalOpen(false);
        setIncidentModalOpen(true);
      }}
    />

    <TechnologistIncidentModal
      open={incidentModalOpen}
      onOpenChange={setIncidentModalOpen}
      examId={examId}
    />

    <TechnologistImageQualityModal
      open={qaModalOpen}
      onOpenChange={setQaModalOpen}
      examId={examId}
    />
  </>
  );
}


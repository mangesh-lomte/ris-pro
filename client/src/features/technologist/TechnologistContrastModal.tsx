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
  ContrastRoute,
  RecordContrastPayload,
} from '../../types';
import {
  Syringe,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { ApiError } from '../../lib/api';

interface TechnologistContrastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  onSuccess?: () => void;
  onOpenIncidentModal?: (contrastAdminId?: string) => void;
}

export function TechnologistContrastModal({
  open,
  onOpenChange,
  examId,
  onSuccess,
  onOpenIncidentModal,
}: TechnologistContrastModalProps) {
  const queryClient = useQueryClient();

  // Form State
  const [contrastAgentName, setContrastAgentName] = useState('');
  const [concentration, setConcentration] = useState('');
  const [volume, setVolume] = useState<string>('');
  const volumeUnit = 'mL';
  const [route, setRoute] = useState<ContrastRoute>('IV');
  const [routeNotes, setRouteNotes] = useState('');
  const [batchLotNumber, setBatchLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [administrationNotes, setAdministrationNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Contrast Context
  const {
    data: context,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['technologist', 'contrast', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.getContrastContext(examId);
    },
    enabled: open && Boolean(examId),
  });

  // Record Contrast Mutation
  const recordMutation = useMutation({
    mutationFn: (payload: RecordContrastPayload) => {
      if (!examId) throw new Error('Exam ID is required');
      return technologistService.recordContrast(examId, payload);
    },
    onSuccess: () => {
      // Clear form inputs
      setContrastAgentName('');
      setConcentration('');
      setVolume('');
      setRouteNotes('');
      setBatchLotNumber('');
      setExpirationDate('');
      setAdministrationNotes('');
      setFormError(null);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['technologist', 'contrast', examId] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });

      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      const isConflict =
        (err instanceof ApiError && err.statusCode === 409) ||
        err?.statusCode === 409 ||
        err?.status === 409 ||
        err?.response?.status === 409;
      if (isConflict) {
        setFormError('This workflow changed in another session. Refreshing current status.');
        queryClient.invalidateQueries({ queryKey: ['technologist', 'contrast', examId] });
        queryClient.invalidateQueries({ queryKey: ['technologist', 'scan', examId] });
        queryClient.invalidateQueries({ queryKey: ['technologist', 'worklist'] });
      } else {
        setFormError(err.response?.data?.message || err.message || 'Failed to record contrast administration.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recordMutation.isPending) return;
    setFormError(null);

    if (!contrastAgentName.trim()) {
      setFormError('Contrast agent name is required.');
      return;
    }

    const numVolume = parseFloat(volume);
    if (isNaN(numVolume) || numVolume <= 0) {
      setFormError('Volume must be a positive number.');
      return;
    }

    if (numVolume > 1000) {
      setFormError('Volume exceeds maximum allowed limit (1000 mL).');
      return;
    }

    if (route === 'OTHER' && !routeNotes.trim()) {
      setFormError('Route notes are required when route is set to OTHER.');
      return;
    }

    recordMutation.mutate({
      contrastAgentName: contrastAgentName.trim(),
      concentration: concentration.trim() || undefined,
      volume: numVolume,
      volumeUnit,
      route,
      routeNotes: route === 'OTHER' ? routeNotes.trim() : undefined,
      batchLotNumber: batchLotNumber.trim() || undefined,
      expirationDate: expirationDate || undefined,
      administrationNotes: administrationNotes.trim() || undefined,
    });
  };

  if (!open || !examId) return null;

  const isEligibleToRecord =
    context?.contrastRequired === true &&
    context?.orderStatus === 'SCAN_IN_PROGRESS';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                <Syringe className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Contrast Media Administration</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational Contrast Documentation
                </p>
              </div>
            </div>
            {context && (
              <Badge
                variant={context.contrastRequired ? 'info' : 'outline'}
                className="font-bold text-[10px]"
              >
                {context.contrastRequired ? 'CONTRAST ORDERED' : 'NON-CONTRAST'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : isError || !context ? (
          <div className="p-6 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-semibold">Unable to load contrast context</p>
            <p className="text-xs text-slate-500">
              {error instanceof Error ? error.message : 'Record may have moved or expired.'}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Prominent Identifiers Header */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm border border-slate-800 space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Patient & Examination Context (Read-Only)</span>
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
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Exam & Modality</span>
                  <strong className="text-xs text-indigo-300 block">{context.examination}</strong>
                  <span className="text-[10px] text-slate-400 block">
                    Modality: <strong className="text-white">{context.modality}</strong> | Body Part: {context.bodyPart}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Milestones Read-Only Bar */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Safety Screening</span>
                  <strong className="text-emerald-700">{context.safetyStatus}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Patient Preparation</span>
                  <strong className="text-emerald-700">{context.preparationStatus}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Scan Acquisition State</span>
                  <strong className="text-sky-800">{context.orderStatus}</strong>
                </div>
              </div>
            </div>

            {/* Non-Contrast Exam Case */}
            {!context.contrastRequired && (
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  Contrast is not required for this ordered examination.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  According to the ordering provider and verified exam protocol, this examination is non-contrast.
                  Contrast media administration is disabled.
                </p>
              </div>
            )}

            {/* Not in SCAN_IN_PROGRESS Alert */}
            {context.contrastRequired && context.orderStatus !== 'SCAN_IN_PROGRESS' && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-xs block font-bold">Contrast Administration Unavailable</strong>
                  <p className="text-[11px] leading-relaxed mt-0.5 text-amber-800">
                    Contrast media administration can only be documented while scan acquisition is actively{' '}
                    <strong>SCAN IN PROGRESS</strong>. Current status:{' '}
                    <strong className="font-mono">{context.orderStatus}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Administration Form (Only visible when eligible) */}
            {isEligibleToRecord && (
              <form onSubmit={handleSubmit} className="border border-indigo-200 rounded-xl p-5 bg-indigo-50/30 space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Syringe className="w-4 h-4 text-indigo-600" />
                    Record Contrast Media Administration
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Server Timestamps Applied</span>
                </div>

                {/* Neutral Clinical Instruction */}
                <div className="p-3 bg-white border border-indigo-100 rounded-lg text-[11px] text-slate-600 leading-relaxed">
                  <strong>Notice:</strong> Record the contrast administration performed according to your institution's approved clinical protocol.
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Agent Name */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Contrast Agent Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contrastAgentName}
                      onChange={(e) => setContrastAgentName(e.target.value)}
                      placeholder="e.g. Omnipaque (Iohexol), Dotarem, Isovue"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={recordMutation.isPending}
                    />
                  </div>

                  {/* Concentration */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Concentration (Optional)
                    </label>
                    <input
                      type="text"
                      value={concentration}
                      onChange={(e) => setConcentration(e.target.value)}
                      placeholder="e.g. 350 mgI/mL, 0.5 mmol/mL"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={recordMutation.isPending}
                    />
                  </div>

                  {/* Volume & Unit */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Administered Volume <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="1000"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        placeholder="e.g. 75"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={recordMutation.isPending}
                      />
                      <span className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 select-none">
                        mL
                      </span>
                    </div>
                  </div>

                  {/* Route */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Administration Route <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={route}
                      onChange={(e) => setRoute(e.target.value as ContrastRoute)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      disabled={recordMutation.isPending}
                    >
                      <option value="IV">Intravenous (IV)</option>
                      <option value="ORAL">Oral</option>
                      <option value="OTHER">Other Route</option>
                    </select>
                  </div>

                  {/* Route Notes if OTHER */}
                  {route === 'OTHER' && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Route Specification Notes <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={routeNotes}
                        onChange={(e) => setRouteNotes(e.target.value)}
                        placeholder="Specify route details (e.g. Rectal, Intra-articular)"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={recordMutation.isPending}
                      />
                    </div>
                  )}

                  {/* Batch / Lot Number */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Batch / Lot Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={batchLotNumber}
                      onChange={(e) => setBatchLotNumber(e.target.value)}
                      placeholder="e.g. LOT-2026-X99"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={recordMutation.isPending}
                    />
                  </div>

                  {/* Expiration Date */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={recordMutation.isPending}
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Administration Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={administrationNotes}
                      onChange={(e) => setAdministrationNotes(e.target.value)}
                      placeholder="Factual notes regarding injection rate, flush, or observation."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={recordMutation.isPending}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={recordMutation.isPending}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
                  >
                    {recordMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Syringe className="w-4 h-4" />
                    )}
                    <span>RECORD CONTRAST ADMINISTRATION</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Administrations History Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Documented Contrast Administrations ({context.administrations.length})
                </span>
                {isEligibleToRecord && onOpenIncidentModal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenIncidentModal()}
                    className="text-[11px] font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1.5 h-7"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Report Incident
                  </Button>
                )}
              </div>

              {context.administrations.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  No contrast media has been recorded for this examination yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {context.administrations.map((adm) => (
                    <div
                      key={adm.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <strong className="text-indigo-900 font-bold">{adm.contrastAgentName}</strong>
                          {adm.concentration && (
                            <span className="text-slate-500 text-[11px]">({adm.concentration})</span>
                          )}
                          <Badge variant="info" className="text-[10px]">
                            {adm.volume} {adm.volumeUnit} • {adm.route}
                          </Badge>
                          {(adm.hasIncident || (adm.incidents && adm.incidents.length > 0)) && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Incident Linked
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(adm.administeredAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Administered By</span>
                          <span className="font-medium text-slate-800">
                            {adm.administeredBy.firstName} {adm.administeredBy.lastName}
                          </span>
                        </div>
                        {adm.batchLotNumber && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Lot / Batch</span>
                            <span className="font-mono text-slate-800">{adm.batchLotNumber}</span>
                          </div>
                        )}
                        {adm.expirationDate && (
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Exp. Date</span>
                            <span>{formatDate(adm.expirationDate)}</span>
                          </div>
                        )}
                        {adm.routeNotes && (
                          <div className="col-span-2">
                            <span className="text-slate-400 block text-[10px] uppercase">Route Notes</span>
                            <span>{adm.routeNotes}</span>
                          </div>
                        )}
                      </div>

                      {adm.administrationNotes && (
                        <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded">
                          "{adm.administrationNotes}"
                        </p>
                      )}

                      {/* Incident reporting shortcut linked to this contrast administration */}
                      {onOpenIncidentModal && (
                        <div className="flex justify-end pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenIncidentModal(adm.id)}
                            className="text-[10px] text-amber-800 hover:text-amber-900 hover:bg-amber-50 h-6 px-2 gap-1"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Report Incident with this Dose
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

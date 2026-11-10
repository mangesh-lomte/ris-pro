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
  IncidentCategory,
  IncidentWorkflowAction,
  RecordIncidentPayload,
} from '../../types';
import { ApiError } from '../../lib/api';
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  Loader2,
  Syringe,
  CheckCircle2,
} from 'lucide-react';

const INCIDENT_CATEGORIES_LIST: { value: IncidentCategory; label: string }[] = [
  { value: 'CONTRAST_REACTION', label: 'Contrast Reaction (Allergy, Urticaria, Nausea, Bronchospasm)' },
  { value: 'EXTRAVASATION', label: 'Extravasation / Infiltration of Contrast Media' },
  { value: 'PATIENT_DISTRESS', label: 'Patient Distress (Claustrophobia, Syncope, Pain)' },
  { value: 'PATIENT_REQUEST', label: 'Patient Request to Stop / Discomfort' },
  { value: 'EQUIPMENT_RELATED', label: 'Equipment Malfunction / Injector Failure / Coil Issue' },
  { value: 'WORKFLOW_EVENT', label: 'Workflow Event / Line Dislodgement / Positioning' },
  { value: 'OTHER', label: 'Other Clinical or Operational Incident' },
];

const WORKFLOW_ACTIONS_LIST: { value: IncidentWorkflowAction; label: string }[] = [
  { value: 'SCAN_INTERRUPTED', label: 'Scan Acquisition Interrupted' },
  { value: 'SCAN_STOPPED', label: 'Scan Acquisition Terminated / Stopped' },
  { value: 'CLINICIAN_NOTIFIED', label: 'Attending Clinician / Radiologist Notified' },
  { value: 'PATIENT_MONITORED', label: 'Patient Monitored / Vitals Checked' },
  { value: 'OTHER', label: 'Other Operational Action' },
];

interface TechnologistIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string | null;
  initialContrastAdminId?: string;
  onSuccess?: () => void;
}

export function TechnologistIncidentModal({
  open,
  onOpenChange,
  examId,
  initialContrastAdminId,
  onSuccess,
}: TechnologistIncidentModalProps) {
  const queryClient = useQueryClient();

  // Form State
  const [category, setCategory] = useState<IncidentCategory>('CONTRAST_REACTION');
  const [description, setDescription] = useState('');
  const [contrastAdministrationId, setContrastAdministrationId] = useState<string>(
    initialContrastAdminId || ''
  );
  const [clinicianNotified, setClinicianNotified] = useState(false);
  const [notificationNotes, setNotificationNotes] = useState('');
  const [workflowActionTaken, setWorkflowActionTaken] = useState<IncidentWorkflowAction | ''>('');
  const [workflowActionNotes, setWorkflowActionNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Contrast Context (for contrast list & exam state)
  const { data: contrastContext } = useQuery({
    queryKey: ['technologist', 'contrast', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID required');
      return technologistService.getContrastContext(examId);
    },
    enabled: open && Boolean(examId),
  });

  // Fetch Incidents
  const {
    data: incidents = [],
    isLoading,
  } = useQuery({
    queryKey: ['technologist', 'incidents', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID required');
      return technologistService.getIncidents(examId);
    },
    enabled: open && Boolean(examId),
  });

  // Record Incident Mutation
  const recordMutation = useMutation({
    mutationFn: (payload: RecordIncidentPayload) => {
      if (!examId) throw new Error('Exam ID required');
      return technologistService.recordIncident(examId, payload);
    },
    onSuccess: () => {
      // Clear form
      setDescription('');
      setClinicianNotified(false);
      setNotificationNotes('');
      setWorkflowActionTaken('');
      setWorkflowActionNotes('');
      setFormError(null);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['technologist', 'incidents', examId] });
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
        setFormError(err.response?.data?.message || err.message || 'Failed to record incident.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recordMutation.isPending) return;
    setFormError(null);

    if (!description.trim() || description.trim().length < 3) {
      setFormError('Factual description of the incident is required (at least 3 characters).');
      return;
    }

    recordMutation.mutate({
      category,
      description: description.trim(),
      contrastAdministrationId: contrastAdministrationId || undefined,
      clinicianNotified,
      notificationNotes: clinicianNotified ? notificationNotes.trim() || undefined : undefined,
      workflowActionTaken: (workflowActionTaken as IncidentWorkflowAction) || undefined,
      workflowActionNotes: workflowActionNotes.trim() || undefined,
    });
  };

  if (!open || !examId) return null;

  const currentStatus = contrastContext?.orderStatus;
  const isPermittedState =
    currentStatus === 'SCAN_IN_PROGRESS' || currentStatus === 'SCAN_INTERRUPTED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="3xl">
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle>Technologist Clinical Incident Recording</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational Event & Adverse Reaction Logging
                </p>
              </div>
            </div>
            {contrastContext && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {contrastContext.orderStatus}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Prominent Identifiers Banner */}
          {contrastContext && (
            <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold">
                <span>Patient & Examination Context</span>
                <span className="font-mono text-emerald-400">IMMUTABLE IDENTIFIERS</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Patient</span>
                  <strong className="text-white">
                    {contrastContext.patient.firstName} {contrastContext.patient.lastName}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">MRN</span>
                  <IdentifierPill value={contrastContext.patientId} type="patient" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Accession</span>
                  <IdentifierPill value={contrastContext.accessionNumber} type="accession" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Exam</span>
                  <span className="text-indigo-200 font-medium truncate block">
                    {contrastContext.examination}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Critical Operational Boundary Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1 leading-relaxed">
            <strong className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Operational Boundary Notice
            </strong>
            <p className="text-[11px] text-amber-900">
              Documenting an incident records the event factually and does <strong>NOT</strong> automatically alter scan acquisition state.
              If the patient requires scanner table pause or scan interruption, use the explicit <strong>Interrupt Scan</strong> action from the scan lifecycle console.
            </p>
          </div>

          {/* Disallowed State Notice */}
          {!isPermittedState && (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-center text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Incident Creation Locked</p>
              <p className="text-[11px] text-slate-500">
                New incidents can only be recorded during active acquisition (SCAN_IN_PROGRESS or SCAN_INTERRUPTED).
                Past incidents for this examination remain viewable below.
              </p>
            </div>
          )}

          {/* Incident Recording Form */}
          {isPermittedState && (
            <form onSubmit={handleSubmit} className="border border-amber-200 rounded-xl p-5 bg-amber-50/30 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Document Clinical Incident / Adverse Event
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Server Timestamp Recorded</span>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Category */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Incident Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    disabled={recordMutation.isPending}
                  >
                    {INCIDENT_CATEGORIES_LIST.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Linked Contrast Administration (Optional) */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Associated Contrast Dose (Optional)
                  </label>
                  <select
                    value={contrastAdministrationId}
                    onChange={(e) => setContrastAdministrationId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    disabled={recordMutation.isPending}
                  >
                    <option value="">None / Not Contrast Related</option>
                    {contrastContext?.administrations.map((adm) => (
                      <option key={adm.id} value={adm.id}>
                        {adm.contrastAgentName} ({adm.volume} {adm.volumeUnit}) -{' '}
                        {new Date(adm.administeredAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Factual Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide concise, objective clinical description of symptoms, observations, or equipment behavior (no medical diagnosis)."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={recordMutation.isPending}
                  />
                </div>

                {/* Clinician Notification Checkbox */}
                <div className="md:col-span-2 p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={clinicianNotified}
                      onChange={(e) => setClinicianNotified(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                      disabled={recordMutation.isPending}
                    />
                    <span>Attending Clinician / Radiologist Notified</span>
                  </label>

                  {clinicianNotified && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 block">
                        Notification Notes (Who was notified, method, response)
                      </label>
                      <input
                        type="text"
                        value={notificationNotes}
                        onChange={(e) => setNotificationNotes(e.target.value)}
                        placeholder="e.g. Dr. Roberts (Radiologist on duty) paged and notified at bedside."
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        disabled={recordMutation.isPending}
                      />
                    </div>
                  )}
                </div>

                {/* Workflow Action Taken */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Operational Action Taken (Optional)
                  </label>
                  <select
                    value={workflowActionTaken}
                    onChange={(e) => setWorkflowActionTaken(e.target.value as IncidentWorkflowAction)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    disabled={recordMutation.isPending}
                  >
                    <option value="">Select operational action...</option>
                    {WORKFLOW_ACTIONS_LIST.map((action) => (
                      <option key={action.value} value={action.value}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workflow Action Notes */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Action Detail Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={workflowActionNotes}
                    onChange={(e) => setWorkflowActionNotes(e.target.value)}
                    placeholder="e.g. IV line secured, saline flush held."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={recordMutation.isPending}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={recordMutation.isPending}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm"
                >
                  {recordMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>LOG TECHNOLOGIST INCIDENT</span>
                </Button>
              </div>
            </form>
          )}

          {/* Incident Chronological History */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Chronological Incident History ({incidents.length})
              </span>
            </div>

            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading incident records...</div>
            ) : incidents.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                No clinical incidents or adverse events documented for this examination.
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="text-[10px] font-bold">
                          {inc.category.replace(/_/g, ' ')}
                        </Badge>
                        {inc.clinicianNotified && (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Clinician Notified
                          </Badge>
                        )}
                        {inc.contrastAdministration && (
                          <Badge variant="info" className="text-[10px] gap-1">
                            <Syringe className="w-3 h-3" />
                            {inc.contrastAdministration.contrastAgentName} (
                            {inc.contrastAdministration.volume} {inc.contrastAdministration.volumeUnit})
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(inc.recordedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-slate-800 text-xs font-medium leading-relaxed bg-slate-50/70 p-2.5 rounded border border-slate-100">
                      {inc.description}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Recorded By</span>
                        <span className="font-medium text-slate-800">
                          {inc.recordedBy.firstName} {inc.recordedBy.lastName}
                        </span>
                      </div>

                      {inc.workflowActionTaken && (
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Action Taken</span>
                          <span className="font-semibold text-slate-800">
                            {inc.workflowActionTaken.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}

                      {inc.notificationNotes && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-slate-400 block text-[10px] uppercase">Notification Detail</span>
                          <span className="italic text-slate-700">{inc.notificationNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

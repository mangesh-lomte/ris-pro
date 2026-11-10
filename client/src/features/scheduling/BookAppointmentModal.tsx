import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppointment, CreateAppointmentData } from '../../services/appointmentService';
import { fetchEquipment } from '../../services/clinicalMasterService';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ImagingOrder, Patient, Appointment, Equipment } from '../../types';
import { Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface BookAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: ImagingOrder;
  patient?: Patient | Pick<Patient, 'id' | 'patientId' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'phone'>;
  initialDate?: string;
  initialTime?: string;
  initialEquipmentId?: string;
  onAppointmentBooked?: (appointment: Appointment) => void;
}

export function BookAppointmentModal({
  open,
  onOpenChange,
  order,
  patient,
  initialDate,
  initialTime,
  initialEquipmentId,
  onAppointmentBooked,
}: BookAppointmentModalProps) {
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState<string>(initialTime || '09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(
    initialEquipmentId || ''
  );
  const [notes, setNotes] = useState<string>('');
  const [allowConflictOverride, setAllowConflictOverride] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [assignedRadiographer, setAssignedRadiographer] = useState<string>('');
  const [assignedNurse, setAssignedNurse] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetPatient = patient || order?.patient;
  const targetModality = order?.modality;

  const { data: equipmentList = [] } = useQuery<Equipment[]>({
    queryKey: ['equipment', targetModality],
    queryFn: () => fetchEquipment({ modality: targetModality, operationalOnly: true }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      if (initialDate) setDate(initialDate);
      if (initialTime) setTime(initialTime);
      if (initialEquipmentId) setSelectedEquipmentId(initialEquipmentId);
      if (order?.examDefinition?.defaultDurationMinutes) {
        setDurationMinutes(order.examDefinition.defaultDurationMinutes);
      }
    }
  }, [open, initialDate, initialTime, initialEquipmentId, order]);

  useEffect(() => {
    if (equipmentList.length > 0 && !selectedEquipmentId) {
      setSelectedEquipmentId(equipmentList[0].id);
    }
  }, [equipmentList, selectedEquipmentId]);

  // Calculate End Time Preview
  const calculateEndTime = () => {
    if (!date || !time) return '';
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const bookMutation = useMutation({
    mutationFn: (payload: CreateAppointmentData) => createAppointment(payload),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      onOpenChange(false);
      if (onAppointmentBooked) {
        onAppointmentBooked(appointment);
      }
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.message ||
          'Failed to book appointment. Please verify equipment availability and time slot.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!order || !targetPatient) {
      setErrorMsg('An active imaging order and patient are required to schedule.');
      return;
    }
    if (!selectedEquipmentId) {
      setErrorMsg('Please select a scanner / examination room.');
      return;
    }

    const scheduledStart = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledStart.getTime())) {
      setErrorMsg('Invalid date or time selected.');
      return;
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60000);

    const payload: any = {
      patientId: targetPatient.id,
      imagingOrderId: order.id,
      equipmentId: selectedEquipmentId,
      examDefinitionId: order.examDefinitionId || undefined,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      durationMinutes,
      priority: order.priority,
      notes: notes.trim() || undefined,
      allowConflictOverride: allowConflictOverride || undefined,
      overrideReason: allowConflictOverride ? overrideReason.trim() || 'Supervisor emergency slot override' : undefined,
      assignedRadiographer: assignedRadiographer.trim() || undefined,
      assignedNurse: assignedNurse.trim() || undefined,
    };

    bookMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="lg">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Schedule Radiology Examination</DialogTitle>
        <DialogDescription>
          Assign scanner, room, and appointment slot with strict double-booking prevention.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="font-semibold block">Scheduling Conflict Detected</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Patient and Order Summary */}
          {targetPatient && order && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Patient Name</span>
                  <span className="font-bold text-slate-900">
                    {targetPatient.lastName}, {targetPatient.firstName}
                  </span>
                </div>
                <IdentifierPill type="patient" value={targetPatient.patientId} />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block">Accession Number</span>
                  <IdentifierPill type="accession" value={order.accessionNumber} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Exam & Priority</span>
                  <span className="font-semibold text-slate-900 truncate block">
                    {order.examinationName} ({order.priority})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scanner / Machine Selection */}
          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Examination Scanner / Suite <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} — {eq.modality} ({eq.location || 'Suite'})
                </option>
              ))}
            </select>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Duration (Minutes)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
              </select>
            </div>
          </div>

          {/* Time Window Preview */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 text-xs text-cyan-900">
            <Clock className="w-4 h-4 text-cyan-600 shrink-0" />
            <span>
              Scheduled Window:{' '}
              <span className="font-bold">
                {time} – {calculateEndTime()}
              </span>{' '}
              ({durationMinutes} min examination slot)
            </span>
          </div>

          {/* Staff Allocation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Assigned Radiographer
              </label>
              <Input
                placeholder="e.g. Sarah Jenkins, RT(R)"
                value={assignedRadiographer}
                onChange={(e) => setAssignedRadiographer(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Assigned Nurse
              </label>
              <Input
                placeholder="e.g. David Ross, RN"
                value={assignedNurse}
                onChange={(e) => setAssignedNurse(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          {/* Supervisor Emergency Overbooking Override */}
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
              <input
                type="checkbox"
                checked={allowConflictOverride}
                onChange={(e) => setAllowConflictOverride(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span>Supervisor Overbooking / Emergency Slot Override</span>
            </label>
            {allowConflictOverride && (
              <Input
                placeholder="Enter clinical emergency justification / supervisor override reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="h-8 text-xs bg-white text-slate-900 border-amber-300"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Scheduling / Preparation Notes
            </label>
            <Input
              placeholder="e.g. Patient requires wheelchair assistance; 4-hour pre-scan fasting instructed."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={bookMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={bookMutation.isPending}
            className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirm & Reserve Slot</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

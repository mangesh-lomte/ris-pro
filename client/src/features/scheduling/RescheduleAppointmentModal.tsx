import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rescheduleAppointment, RescheduleAppointmentData } from '../../services/appointmentService';
import { Appointment } from '../../types';
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
import { CalendarClock, ShieldAlert } from 'lucide-react';

interface RescheduleAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
  onRescheduled?: (updated: Appointment) => void;
}

export function RescheduleAppointmentModal({
  open,
  onOpenChange,
  appointment,
  onRescheduled,
}: RescheduleAppointmentModalProps) {
  const queryClient = useQueryClient();

  const currentDate = new Date(appointment.scheduledStart).toISOString().split('T')[0];
  const currentTime = new Date(appointment.scheduledStart).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const [newDate, setNewDate] = useState<string>(currentDate);
  const [newTime, setNewTime] = useState<string>(currentTime);
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rescheduleMutation = useMutation({
    mutationFn: (payload: RescheduleAppointmentData) =>
      rescheduleAppointment(appointment.id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      onOpenChange(false);
      if (onRescheduled) {
        onRescheduled(updated);
      }
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.message ||
          'Failed to reschedule appointment. The chosen machine slot may already be occupied.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reason.trim()) {
      setErrorMsg('A valid clinical or administrative reason is required for rescheduling.');
      return;
    }

    const scheduledStart = new Date(`${newDate}T${newTime}:00`);
    if (isNaN(scheduledStart.getTime())) {
      setErrorMsg('Invalid target date or time.');
      return;
    }

    rescheduleMutation.mutate({
      scheduledStart: scheduledStart.toISOString(),
      equipmentId: appointment.equipmentId || undefined,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Reschedule Appointment</DialogTitle>
        <DialogDescription>
          Move appointment to a new date/time slot with real-time conflict verification.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Appointment Reference:</span>
              <span className="font-mono font-bold text-slate-900">
                {appointment.appointmentNumber}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-900">
                {appointment.patient?.lastName}, {appointment.patient?.firstName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Current Slot:</span>
              <span className="font-mono text-slate-700">
                {new Date(appointment.scheduledStart).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                New Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                New Start Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Reschedule Reason <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder="e.g. Patient requested morning slot; acute scanner maintenance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            disabled={rescheduleMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={rescheduleMutation.isPending}
            className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Confirm Reschedule</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

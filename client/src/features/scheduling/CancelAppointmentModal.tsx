import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelAppointment, markNoShowAppointment } from '../../services/appointmentService';
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
import { XCircle, UserX } from 'lucide-react';

interface CancelAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
  actionType: 'CANCEL' | 'NO_SHOW';
  onCompleted?: () => void;
}

export function CancelAppointmentModal({
  open,
  onOpenChange,
  appointment,
  actionType,
  onCompleted,
}: CancelAppointmentModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isCancel = actionType === 'CANCEL';

  const actionMutation = useMutation({
    mutationFn: (r: string) =>
      isCancel
        ? cancelAppointment(appointment.id, r)
        : markNoShowAppointment(appointment.id, r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      onOpenChange(false);
      if (onCompleted) {
        onCompleted();
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || `Failed to ${isCancel ? 'cancel' : 'mark no-show'} appointment.`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg(`A valid reason is required to ${isCancel ? 'cancel' : 'mark no-show'}.`);
      return;
    }
    actionMutation.mutate(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>{isCancel ? 'Cancel Examination Appointment' : 'Record Patient No-Show'}</DialogTitle>
        <DialogDescription>
          {isCancel
            ? 'Cancelling this appointment immediately releases the scanner slot back to available capacity.'
            : 'Marking a no-show logs the attendance failure in patient history and releases scanner time.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Appointment:</span>
              <span className="font-mono font-bold text-slate-900">{appointment.appointmentNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Patient:</span>
              <span className="font-semibold text-slate-900">
                {appointment.patient?.lastName}, {appointment.patient?.firstName} ({appointment.patient?.patientId})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Scheduled Time:</span>
              <span className="font-mono text-slate-700">
                {new Date(appointment.scheduledStart).toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              {isCancel ? 'Cancellation Reason' : 'No-Show Explanation'} <span className="text-red-500">*</span>
            </label>
            <Input
              required
              placeholder={
                isCancel
                  ? 'e.g. Patient called to cancel; clinical condition changed; contrast allergy discovered'
                  : 'e.g. Patient failed to arrive after 30 minutes; unreachable by phone'
              }
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
            disabled={actionMutation.isPending}
          >
            Go Back
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            isLoading={actionMutation.isPending}
            className="gap-1.5"
          >
            {isCancel ? <XCircle className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            <span>{isCancel ? 'Confirm Cancellation' : 'Record No-Show'}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

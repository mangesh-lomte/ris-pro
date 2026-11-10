import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { allocateStaffMachine } from '../../services/appointmentService';
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
import { Appointment, Equipment } from '../../types';
import { Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface StaffAllocationModalProps {
  appointment: Appointment | null;
  equipmentList?: Equipment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffAllocationModal({
  appointment,
  equipmentList = [],
  open,
  onOpenChange,
}: StaffAllocationModalProps) {
  const queryClient = useQueryClient();

  const [equipmentId, setEquipmentId] = useState(appointment?.equipmentId || '');
  const [radiographer, setRadiographer] = useState('Sarah Jenkins, RT(R)');
  const [nurse, setNurse] = useState('David Ross, RN');
  const [location, setLocation] = useState(appointment?.location || '');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allocateMutation = useMutation({
    mutationFn: (payload: any) =>
      appointment ? allocateStaffMachine(appointment.id, payload) : Promise.reject(new Error('No appointment')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to allocate staff/machine');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    allocateMutation.mutate({
      equipmentId: equipmentId || undefined,
      location: location.trim() || undefined,
      radiographer: radiographer.trim() || undefined,
      nurse: nurse.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Users className="w-5 h-5 text-indigo-600" />
          <span>Staff & Scanner Resource Allocation</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Assign radiographer, nurse and machine per slot for appointment execution
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {appointment && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Appointment #:</span>
                <span className="font-bold text-slate-900">{appointment.appointmentNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Patient:</span>
                <span>{appointment.patient?.firstName} {appointment.patient?.lastName}</span>
              </div>
              {appointment.imagingOrder?.accessionNumber && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Accession:</span>
                  <IdentifierPill type="accession" value={appointment.imagingOrder.accessionNumber} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Assigned Scanner / Examination Suite
            </label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium"
            >
              <option value="">Unassigned</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.location || eq.modality})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Assigned Radiographer / Tech
              </label>
              <Input
                value={radiographer}
                onChange={(e) => setRadiographer(e.target.value)}
                placeholder="Radiographer name"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Assigned Nurse
              </label>
              <Input
                value={nurse}
                onChange={(e) => setNurse(e.target.value)}
                placeholder="Nurse name"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Suite / Location Override
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Suite CT-02, Wing B"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-1">
              Staff Coordination Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Requires sedation nurse coverage at 09:30"
              className="h-8 text-xs"
            />
          </div>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={allocateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Staff Allocation</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

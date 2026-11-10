import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkInAppointment } from '../../services/appointmentService';
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
import { AlertCircle, CheckCircle2, ShieldCheck, Printer, Ticket } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { PatientLabelModal } from '../../components/shared/PatientLabelModal';
import { calculateAge, formatDate } from '../../utils/formatters';

interface ReceptionCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
  onCheckInCompleted?: (tokenNumber: string) => void;
}

export function ReceptionCheckInModal({
  open,
  onOpenChange,
  appointment,
  onCheckInCompleted,
}: ReceptionCheckInModalProps) {
  const queryClient = useQueryClient();

  const [identityConfirmed, setIdentityConfirmed] = useState<boolean>(false);
  const [insuranceVerified, setInsuranceVerified] = useState<boolean>(true);
  const [prepVerified, setPrepVerified] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assignedToken, setAssignedToken] = useState<string | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState<boolean>(false);

  const checkInMutation = useMutation({
    mutationFn: () =>
      checkInAppointment(appointment.id, {
        identityConfirmed,
        insuranceVerified,
        preScanInstructionsConfirmed: prepVerified,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setAssignedToken(data.tokenNumber);
      if (onCheckInCompleted) {
        onCheckInCompleted(data.tokenNumber);
      }
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.message ||
          'Check-in failed. Please ensure 2-identifier patient verification is checked.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identityConfirmed) {
      setErrorMsg(
        'Mandatory Safety Requirement: You must verify 2 patient identifiers (Full Name & DOB) before checking in.'
      );
      return;
    }

    checkInMutation.mutate();
  };

  const patient = appointment.patient;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
        <DialogHeader onClose={() => onOpenChange(false)}>
          <DialogTitle>Patient Arrival & Reception Check-In</DialogTitle>
          <DialogDescription>
            Verify patient identity, issue daily queue token, and advance order to Ready for Technologist.
          </DialogDescription>
        </DialogHeader>

        {assignedToken ? (
          <div className="p-6 space-y-5 animate-in fade-in">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white mx-auto">
                <Ticket className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Waiting Queue Token Issued
                </span>
                <div className="text-3xl font-extrabold text-emerald-950 font-mono tracking-wider mt-1">
                  {assignedToken}
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Patient placed in waiting queue. Imaging order status advanced to{' '}
                  <span className="font-bold underline">READY FOR TECH</span>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLabelModalOpen(true)}
                className="gap-1.5 border-slate-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Wristband / Label</span>
              </Button>
              <Button
                size="sm"
                className="bg-[#174A70] hover:bg-[#123855] text-white"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogContent className="space-y-4">
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Patient Identification Card */}
              {patient && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-900 block">
                        Patient Identity
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {patient.lastName}, {patient.firstName}
                      </h4>
                    </div>
                    <IdentifierPill type="patient" value={patient.patientId} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-cyan-200/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Date of Birth:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} yrs)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Scheduled Exam:</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {appointment.examination} ({appointment.modality})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Safety Verification Checkboxes */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Mandatory Identity & Safety Verification
                </h4>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-[#174A70]/40 bg-[#174A70]/5 cursor-pointer hover:bg-[#174A70]/10 transition">
                  <input
                    type="checkbox"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#174A70] focus:ring-[#227DA5]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#174A70]" />
                      2-Identifier Verification Confirmed (Mandatory)
                    </span>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      I have actively verified patient's full legal name and date of birth against hospital armband or government photo ID.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={insuranceVerified}
                    onChange={(e) => setInsuranceVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#174A70] focus:ring-[#227DA5]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800">
                      Insurance & Co-pay / Self-Pay Verified
                    </span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Prior authorization code or payment receipt confirmed on file.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={prepVerified}
                    onChange={(e) => setPrepVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#174A70] focus:ring-[#227DA5]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-800">
                      Pre-Scan Clinical Preparation Verified
                    </span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Patient confirmed fasting instructions or pre-contrast readiness where required.
                    </p>
                  </div>
                </label>
              </div>
            </DialogContent>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={checkInMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!identityConfirmed || checkInMutation.isPending}
                isLoading={checkInMutation.isPending}
                className="bg-[#174A70] hover:bg-[#123855] text-white gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Check-In & Issue Token</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      {patient && (
        <PatientLabelModal
          open={labelModalOpen}
          onOpenChange={setLabelModalOpen}
          patient={{
            patientId: patient.patientId,
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
          }}
          accessionNumber={appointment.imagingOrder?.accessionNumber}
          tokenNumber={assignedToken || appointment.tokenNumber}
          modality={appointment.modality}
          examination={appointment.examination}
        />
      )}
    </>
  );
}


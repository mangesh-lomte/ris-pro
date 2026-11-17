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
  const [identityVerificationMethod, setIdentityVerificationMethod] = useState<'GOVERNMENT_PHOTO_ID' | 'HOSPITAL_PHOTO_ID' | 'HOSPITAL_WRISTBAND'>('GOVERNMENT_PHOTO_ID');
  const [primaryIdentifier, setPrimaryIdentifier] = useState<'MRN' | 'FULL_NAME'>('MRN');
  const [secondaryIdentifier, setSecondaryIdentifier] = useState<'DATE_OF_BIRTH' | 'PHONE_NUMBER'>('DATE_OF_BIRTH');
  const [identityEvidenceReference, setIdentityEvidenceReference] = useState('');
  const [insuranceDisposition, setInsuranceDisposition] = useState<'SELF_PAY' | 'NOT_REQUIRED' | 'VERIFIED'>('SELF_PAY');
  const [insuranceAuthorizationReference, setInsuranceAuthorizationReference] = useState('');
  const [prepVerified, setPrepVerified] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assignedToken, setAssignedToken] = useState<string | null>(null);
  const [labelModalOpen, setLabelModalOpen] = useState<boolean>(false);

  const checkInMutation = useMutation({
    mutationFn: () =>
      checkInAppointment(appointment.id, {
        identityConfirmed,
        identityVerificationMethod,
        primaryIdentifier,
        secondaryIdentifier,
        identityEvidenceReference: identityEvidenceReference.trim() || undefined,
        insuranceDisposition,
        insuranceAuthorizationReference: insuranceAuthorizationReference.trim() || undefined,
        preScanInstructionsConfirmed: true,
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
    if (!prepVerified) {
      setErrorMsg('Review and confirm the applicable preparation instructions before check-in.');
      return;
    }
    if (insuranceDisposition === 'VERIFIED' && !insuranceAuthorizationReference.trim()) {
      setErrorMsg('Enter the verified eligibility or prior-authorization reference.');
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
            <div className="rounded border border-emerald-300 bg-emerald-50 p-5 text-center space-y-3">
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
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
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
                <div className="rounded border border-cyan-200 bg-cyan-50/60 p-4 space-y-2">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Evidence reviewed
                    <select value={identityVerificationMethod} onChange={(e) => setIdentityVerificationMethod(e.target.value as typeof identityVerificationMethod)} className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs">
                      <option value="GOVERNMENT_PHOTO_ID">Government photo ID</option>
                      <option value="HOSPITAL_PHOTO_ID">Hospital photo ID</option>
                      <option value="HOSPITAL_WRISTBAND">Hospital wristband</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Evidence reference (last 4 only)
                    <input value={identityEvidenceReference} onChange={(e) => setIdentityEvidenceReference(e.target.value)} maxLength={100} placeholder="Optional — never enter full ID number" className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Primary identifier
                    <select value={primaryIdentifier} onChange={(e) => setPrimaryIdentifier(e.target.value as typeof primaryIdentifier)} className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs">
                      <option value="MRN">MRN</option>
                      <option value="FULL_NAME">Full legal name</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Independent second identifier
                    <select value={secondaryIdentifier} onChange={(e) => setSecondaryIdentifier(e.target.value as typeof secondaryIdentifier)} className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs">
                      <option value="DATE_OF_BIRTH">Date of birth</option>
                      <option value="PHONE_NUMBER">Phone number</option>
                    </select>
                  </label>
                </div>

                <label className="flex items-start gap-3 p-3.5 rounded border-2 border-[#2563EB]/40 bg-[#2563EB]/5 cursor-pointer hover:bg-[#2563EB]/10 transition">
                  <input
                    type="checkbox"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                      2-Identifier Verification Confirmed (Mandatory)
                    </span>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      I have actively verified patient's full legal name and date of birth against hospital armband or government photo ID.
                    </p>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Payment / coverage disposition
                    <select value={insuranceDisposition} onChange={(e) => setInsuranceDisposition(e.target.value as typeof insuranceDisposition)} className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs">
                      <option value="SELF_PAY">Self-pay</option>
                      <option value="NOT_REQUIRED">Authorization not required</option>
                      <option value="VERIFIED">Insurance eligibility verified</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Eligibility / authorization reference
                    <input value={insuranceAuthorizationReference} onChange={(e) => setInsuranceAuthorizationReference(e.target.value)} disabled={insuranceDisposition !== 'VERIFIED'} maxLength={120} placeholder="Required when verified" className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100" />
                  </label>
                </div>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={prepVerified}
                    onChange={(e) => setPrepVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
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
                disabled={!identityConfirmed || !prepVerified || checkInMutation.isPending}
                isLoading={checkInMutation.isPending}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5"
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


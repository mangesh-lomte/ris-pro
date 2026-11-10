import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPatient,
  CreatePatientData,
} from '../../services/patientService';
import { CandidateDuplicatePatient, Gender, Patient } from '../../types';
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
import { AlertCircle, CheckCircle2, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface RegisterPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientCreated?: (patient: Patient) => void;
  onSelectExisting?: (candidate: CandidateDuplicatePatient) => void;
}

export function RegisterPatientModal({
  open,
  onOpenChange,
  onPatientCreated,
  onSelectExisting,
}: RegisterPatientModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreatePatientData>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE' as Gender,
    phone: '',
    alternatePhone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<CandidateDuplicatePatient[] | null>(null);

  const resetForm = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'MALE',
      phone: '',
      alternatePhone: '',
      email: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
    });
    setErrorMsg(null);
    setDuplicateCandidates(null);
  };

  const registerMutation = useMutation({
    mutationFn: (payload: CreatePatientData) => createPatient(payload),
    onSuccess: (newPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      resetForm();
      onOpenChange(false);
      if (onPatientCreated) {
        onPatientCreated(newPatient);
      }
    },
    onError: (err: any) => {
      if (err?.code === 'POSSIBLE_DUPLICATE_PATIENT' && err?.details?.candidates) {
        setDuplicateCandidates(err.details.candidates);
        setErrorMsg(err.message || 'Possible duplicate patient detected in Master Patient Index.');
      } else {
        setErrorMsg(err?.message || 'Failed to register patient. Please check required fields.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent, bypassDuplicate = false) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMsg('First and last name are strictly required.');
      return;
    }
    if (!formData.dateOfBirth) {
      setErrorMsg('Date of birth is required for accurate clinical matching.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg('A valid phone number is required.');
      return;
    }

    registerMutation.mutate({
      ...formData,
      bypassDuplicateWarning: bypassDuplicate,
    });
  };

  const handleChange = (
    field: keyof CreatePatientData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (duplicateCandidates) {
      setDuplicateCandidates(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="2xl">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Register New Patient</DialogTitle>
        <DialogDescription>
          Create a persistent Master Patient Index (MPI) record. Assigns a permanent Patient ID (MRN).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <DialogContent className="space-y-5">
          {errorMsg && !duplicateCandidates && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Duplicate Detection Warning Banner */}
          {duplicateCandidates && duplicateCandidates.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900">
                    Possible existing patient found.
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    We found {duplicateCandidates.length} potential matching record(s) in the Master Patient Index with matching name, DOB, or phone number:
                  </p>
                </div>
              </div>

              <div className="divide-y divide-amber-200 rounded-lg border border-amber-200 bg-white/80 overflow-hidden">
                {duplicateCandidates.map((c) => (
                  <div key={c.patientId} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {c.firstName} {c.lastName}
                        </span>
                        <IdentifierPill type="patient" value={c.patientId} />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        DOB: {new Date(c.dateOfBirth).toLocaleDateString()} • Phone: {c.phone}
                      </div>
                      <div className="text-[10px] text-amber-700 font-medium">
                        Match Reason: {c.matchReason}
                      </div>
                    </div>

                    {onSelectExisting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1 border-amber-300 hover:bg-amber-100"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectExisting(c);
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                        <span>Select Existing</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-amber-800 font-medium">
                  Is this actually a different individual with the same name?
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
                  onClick={(e) => handleSubmit(e, true)}
                  isLoading={registerMutation.isPending}
                >
                  <span>Register as New Person</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Personal Demographics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              1. Demographics & Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. John"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Middle Name
                </label>
                <Input
                  placeholder="Optional"
                  value={formData.middleName}
                  onChange={(e) => handleChange('middleName', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Doe"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                  className="h-8 text-xs"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value as Gender)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNKNOWN">Unknown / Undisclosed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              2. Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Primary Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  type="tel"
                  placeholder="+1-555-0100"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              3. Residential Address
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Street Address
                </label>
                <Input
                  placeholder="123 Health Ave, Suite 400"
                  value={formData.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  City
                </label>
                <Input
                  placeholder="Chicago"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    State
                  </label>
                  <Input
                    placeholder="IL"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="h-8 text-xs uppercase"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Zip Code
                  </label>
                  <Input
                    placeholder="60601"
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              4. Emergency Contact (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Contact Name
                </label>
                <Input
                  placeholder="e.g. Jane Doe"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Relationship
                </label>
                <Input
                  placeholder="Spouse / Parent"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => handleChange('emergencyContactRelation', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Emergency Phone
                </label>
                <Input
                  placeholder="+1-555-0199"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={registerMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={registerMutation.isPending}
            className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Register & Assign MRN</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


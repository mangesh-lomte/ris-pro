import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePatient, UpdatePatientData } from '../../services/patientService';
import { Patient, Gender } from '../../types';
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
import { AlertCircle, Save, ShieldCheck } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface EditDemographicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  onPatientUpdated?: (patient: Patient) => void;
}

export function EditDemographicsModal({
  open,
  onOpenChange,
  patient,
  onPatientUpdated,
}: EditDemographicsModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<UpdatePatientData>({
    firstName: patient.firstName,
    middleName: patient.middleName || '',
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
    gender: patient.gender,
    phone: patient.phone,
    alternatePhone: patient.alternatePhone || '',
    email: patient.email || '',
    addressLine1: patient.addressLine1 || '',
    addressLine2: patient.addressLine2 || '',
    city: patient.city || '',
    state: patient.state || '',
    postalCode: patient.postalCode || '',
    emergencyContactName: patient.emergencyContactName || '',
    emergencyContactPhone: patient.emergencyContactPhone || '',
    emergencyContactRelation: patient.emergencyContactRelation || '',
  });

  useEffect(() => {
    setFormData({
      firstName: patient.firstName,
      middleName: patient.middleName || '',
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
      gender: patient.gender,
      phone: patient.phone,
      alternatePhone: patient.alternatePhone || '',
      email: patient.email || '',
      addressLine1: patient.addressLine1 || '',
      addressLine2: patient.addressLine2 || '',
      city: patient.city || '',
      state: patient.state || '',
      postalCode: patient.postalCode || '',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
      emergencyContactRelation: patient.emergencyContactRelation || '',
    });
  }, [patient]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePatientData) => updatePatient(patient.patientId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', patient.patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      onOpenChange(false);
      if (onPatientUpdated) {
        onPatientUpdated(updated);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to update demographics.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    updateMutation.mutate(formData);
  };

  const handleChange = (field: keyof UpdatePatientData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="xl">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Update Patient Demographics</DialogTitle>
        <DialogDescription>
          Maintain accurate address, contact details, and emergency references for this record.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Permanent Patient ID (Immutable):</span>
            </div>
            <IdentifierPill type="patient" value={patient.patientId} />
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">First Name</label>
              <Input
                required
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Middle Name</label>
              <Input
                value={formData.middleName}
                onChange={(e) => handleChange('middleName', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Last Name</label>
              <Input
                required
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Date of Birth</label>
              <Input
                type="date"
                required
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value as Gender)}
                className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Primary Phone</label>
              <Input
                required
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-800">Address Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Street Address</label>
                <Input
                  value={formData.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">City</label>
                <Input
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">State</label>
                  <Input
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="h-8 text-xs uppercase"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Zip Code</label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
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
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={updateMutation.isPending}
            className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Demographics</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


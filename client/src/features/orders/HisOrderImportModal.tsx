import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importHisOrder } from '../../services/orderService';
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
import { Download, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface HisOrderImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HisOrderImportModal({ open, onOpenChange }: HisOrderImportModalProps) {
  const queryClient = useQueryClient();

  const [externalSystem, setExternalSystem] = useState('Epic EMR');
  const [externalOrderId, setExternalOrderId] = useState(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
  
  // Patient fields
  const [mrn, setMrn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1985-05-12');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [phone, setPhone] = useState('');
  
  // Order fields
  const [modality, setModality] = useState<'MRI' | 'CT' | 'XRAY' | 'ULTRASOUND'>('CT');
  const [bodyPart, setBodyPart] = useState('Chest');
  const [examinationName, setExaminationName] = useState('CT Chest with IV Contrast');
  const [clinicalIndication, setClinicalIndication] = useState('Persistent hemoptysis, evaluate for bronchial lesion');
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('URGENT');
  const [contrastRequired, setContrastRequired] = useState(true);
  const [referringDoctorName, setReferringDoctorName] = useState('Dr. Marcus Brody, MD');
  const [referringDoctorHospital, setReferringDoctorHospital] = useState('St. Jude Regional Hospital');

  const [importedResult, setImportedResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (payload: any) => importHisOrder(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setImportedResult(res);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to import HIS order');
    },
  });

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) {
      setErrorMsg('Patient first name, last name and phone are required');
      return;
    }

    const payload = {
      externalSystem,
      externalOrderId,
      patient: {
        mrn: mrn.trim() || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        gender,
        phone: phone.trim(),
      },
      order: {
        modality,
        bodyPart: bodyPart.trim(),
        examinationName: examinationName.trim(),
        clinicalIndication: clinicalIndication.trim(),
        priority,
        contrastRequired,
        referringDoctorName: referringDoctorName.trim() || undefined,
        referringDoctorHospital: referringDoctorHospital.trim() || undefined,
      },
    };

    importMutation.mutate(payload);
  };

  const handleReset = () => {
    setImportedResult(null);
    setErrorMsg(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="lg">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <span>HIS / EMR Ingestion Bridge (Hospital Orders Import)</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Ingest scan orders directly from hospital HIS or doctor EMR with automatic patient matching and collision-safe Accession Number generation
        </DialogDescription>
      </DialogHeader>

      {importedResult ? (
        <DialogContent className="space-y-4 py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">HIS Scan Order Successfully Ingested!</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Order has been entered into RIS worklists with single-source Accession traceability.
          </p>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">External System:</span>
              <span className="font-bold text-slate-900">{importedResult.externalSystem}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">External Order ID:</span>
              <span className="font-mono font-bold text-slate-800">{importedResult.externalOrderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Patient ID (MRN):</span>
              <IdentifierPill type="patient" value={importedResult.order?.patient?.patientId || 'PAT-ID'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Generated Accession #:</span>
              <IdentifierPill type="accession" value={importedResult.accessionNumber} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Examination:</span>
              <span className="font-medium text-slate-900">{importedResult.order?.examinationName}</span>
            </div>
          </div>

          <Button onClick={handleReset} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
            Return to Orders Registry
          </Button>
        </DialogContent>
      ) : (
        <form onSubmit={handleImport}>
          <DialogContent className="space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* External HIS / EMR Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Originating HIS / EMR System <span className="text-red-500">*</span>
                </label>
                <select
                  value={externalSystem}
                  onChange={(e) => setExternalSystem(e.target.value)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                >
                  <option value="Epic Systems EMR">Epic Systems EMR</option>
                  <option value="Cerner Millennium">Cerner Millennium</option>
                  <option value="Meditech Expanse">Meditech Expanse</option>
                  <option value="Allscripts Sunrise">Allscripts Sunrise</option>
                  <option value="Custom Hospital HIS">Custom Hospital HIS</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  External Order Identifier <span className="text-red-500">*</span>
                </label>
                <Input
                  value={externalOrderId}
                  onChange={(e) => setExternalOrderId(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Patient Demographics */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Patient Demographics</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">First Name *</label>
                  <Input
                    placeholder="e.g. Rachel"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Last Name *</label>
                  <Input
                    placeholder="e.g. Green"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Mobile Phone *</label>
                  <Input
                    placeholder="e.g. +1-555-019-8234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">External Hospital MRN</label>
                  <Input
                    placeholder="Optional HIS MRN"
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Examination & Clinical Data */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Clinical Examination & Doctor</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Modality</label>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-indigo-700"
                  >
                    <option value="CT">CT</option>
                    <option value="MRI">MRI</option>
                    <option value="XRAY">X-Ray</option>
                    <option value="ULTRASOUND">Ultrasound</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Body Part</label>
                  <Input
                    value={bodyPart}
                    onChange={(e) => setBodyPart(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT / Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Examination Name</label>
                <Input
                  value={examinationName}
                  onChange={(e) => setExaminationName(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="contrastReq"
                  checked={contrastRequired}
                  onChange={(e) => setContrastRequired(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <label htmlFor="contrastReq" className="text-xs text-slate-700 cursor-pointer font-medium">
                  IV / Oral Contrast Administration Required
                </label>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Clinical Indication / History</label>
                <textarea
                  value={clinicalIndication}
                  onChange={(e) => setClinicalIndication(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Referring Doctor Name</label>
                  <Input
                    value={referringDoctorName}
                    onChange={(e) => setReferringDoctorName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Referring Facility / Hospital</label>
                  <Input
                    value={referringDoctorHospital}
                    onChange={(e) => setReferringDoctorHospital(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </DialogContent>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={importMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Import & Generate Accession</span>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

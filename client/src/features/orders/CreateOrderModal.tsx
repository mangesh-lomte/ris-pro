import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder, CreateOrderData } from '../../services/orderService';
import { fetchExamDefinitions, fetchReferringDoctors } from '../../services/clinicalMasterService';
import { fetchPatients } from '../../services/patientService';
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
import {
  ModalityType,
  Priority,
  PayerType,
  AuthorizationStatus,
  Patient,
  ImagingOrder,
} from '../../types';
import { AlertCircle, CheckCircle2, CalendarPlus, ShieldAlert } from 'lucide-react';
import { IdentifierPill } from '../../components/shared/IdentifierPill';

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient;
  onOrderCreated?: (order: ImagingOrder) => void;
  onScheduleOrder?: (order: ImagingOrder) => void;
}

export function CreateOrderModal({
  open,
  onOpenChange,
  patient,
  onOrderCreated,
  onScheduleOrder,
}: CreateOrderModalProps) {
  const queryClient = useQueryClient();

  // Patient selection state when patient prop is not passed
  const [selectedPatient, setSelectedPatient] = useState<Patient | undefined>(patient);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');

  useEffect(() => {
    if (patient) {
      setSelectedPatient(patient);
    }
  }, [patient]);

  const { data: patientSearchResult } = useQuery({
    queryKey: ['patientSearchOrderModal', patientSearchTerm],
    queryFn: () => fetchPatients({ search: patientSearchTerm, pageSize: 5 }),
    enabled: !patient && patientSearchTerm.length >= 2,
  });

  // Clinical Masters
  const [modality, setModality] = useState<ModalityType>('MRI');

  const { data: examDefinitions = [] } = useQuery({
    queryKey: ['examDefinitions', modality],
    queryFn: () => fetchExamDefinitions(modality),
    enabled: open,
  });

  const { data: referringDoctors = [] } = useQuery({
    queryKey: ['referringDoctors'],
    queryFn: () => fetchReferringDoctors(),
    enabled: open,
  });

  // Form State
  const [selectedExamDefId, setSelectedExamDefId] = useState<string>('');
  const [examinationName, setExaminationName] = useState<string>('');
  const [bodyPart, setBodyPart] = useState<string>('');
  const [clinicalIndication, setClinicalIndication] = useState<string>('');
  const [referringDoctorId, setReferringDoctorId] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('ROUTINE');
  const [contrastRequirement, setContrastRequirement] = useState<'NONE' | 'ORAL' | 'IV' | 'BOTH'>('NONE');

  // Insurance & Prior Auth
  const [payerType, setPayerType] = useState<PayerType>('INSURANCE');
  const [insuranceProvider, setInsuranceProvider] = useState<string>('');
  const [policyNumber, setPolicyNumber] = useState<string>('');
  const [authorizationCode, setAuthorizationCode] = useState<string>('');
  const [authorizationStatus, setAuthorizationStatus] = useState<AuthorizationStatus>('APPROVED');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<ImagingOrder | null>(null);

  // Auto-fill body part and exam name when exam definition changes
  useEffect(() => {
    if (selectedExamDefId && examDefinitions.length > 0) {
      const def = examDefinitions.find((d) => d.id === selectedExamDefId);
      if (def) {
        setExaminationName(def.name);
        setBodyPart(def.bodyPart);
      }
    }
  }, [selectedExamDefId, examDefinitions]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCreatedOrder(null);
      setErrorMsg(null);
      if (examDefinitions.length > 0 && !selectedExamDefId) {
        setSelectedExamDefId(examDefinitions[0].id);
        setExaminationName(examDefinitions[0].name);
        setBodyPart(examDefinitions[0].bodyPart);
      }
      if (referringDoctors.length > 0 && !referringDoctorId) {
        setReferringDoctorId(referringDoctors[0].id);
      }
    }
  }, [open, examDefinitions, referringDoctors]);

  const orderMutation = useMutation({
    mutationFn: (payload: CreateOrderData) => createOrder(payload),
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient', selectedPatient?.patientId] });
      setCreatedOrder(newOrder);
      if (onOrderCreated) {
        onOrderCreated(newOrder);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to create imaging order.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPatient) {
      setErrorMsg('A valid patient must be selected for the imaging order.');
      return;
    }
    if (!examinationName.trim() || !bodyPart.trim()) {
      setErrorMsg('Examination name and target body part are required.');
      return;
    }
    if (!clinicalIndication.trim()) {
      setErrorMsg('Clinical indication / reason for exam is mandatory.');
      return;
    }

    const payload: CreateOrderData = {
      patientId: selectedPatient.id,
      modality,
      examinationName: examinationName.trim(),
      bodyPart: bodyPart.trim(),
      clinicalIndication: clinicalIndication.trim(),
      referringDoctorId: referringDoctorId || undefined,
      priority,
      contrastRequired: contrastRequirement !== 'NONE',
      contrastRequirement,
      payerType,
      insuranceProvider: insuranceProvider.trim() || undefined,
      policyNumber: policyNumber.trim() || undefined,
      authorizationCode: authorizationCode.trim() || undefined,
      authorizationStatus,
    };

    orderMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="2xl">
      <DialogHeader onClose={() => onOpenChange(false)}>
        <DialogTitle>Create Radiology Imaging Order</DialogTitle>
        <DialogDescription>
          Generates a persistent Accession Number linked to the patient's Master Patient Index record.
        </DialogDescription>
      </DialogHeader>

      {createdOrder ? (
        <div className="p-6 space-y-5 animate-in fade-in">
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">Imaging Order Created Successfully</h3>
                <p className="text-xs text-emerald-800">
                  Unique Accession Number generated and locked to patient MRN.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200 text-xs">
              <div>
                <span className="text-[11px] text-emerald-700 block">Accession Number:</span>
                <IdentifierPill type="accession" value={createdOrder.accessionNumber} />
              </div>
              <div>
                <span className="text-[11px] text-emerald-700 block">Patient MRN:</span>
                <IdentifierPill type="patient" value={selectedPatient?.patientId || ''} />
              </div>
              <div>
                <span className="text-[11px] text-emerald-700 block">Examination:</span>
                <span className="font-semibold text-emerald-950">{createdOrder.examinationName}</span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-700 block">Priority:</span>
                <span className="font-semibold text-emerald-950">{createdOrder.priority}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Close
            </Button>
            {onScheduleOrder && (
              <Button
                size="sm"
                className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onScheduleOrder(createdOrder);
                }}
              >
                <CalendarPlus className="w-4 h-4" />
                <span>Schedule Appointment Now</span>
              </Button>
            )}
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

            {/* Patient Header / Selector */}
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 block">Patient Identity</span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedPatient.lastName}, {selectedPatient.firstName}
                  </span>
                </div>
                <IdentifierPill type="patient" value={selectedPatient.patientId} />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Search & Select Patient <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Type MRN, patient name, or phone..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="h-8 text-xs"
                />
                {patientSearchResult?.data?.items && patientSearchResult.data.items.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white max-h-36 overflow-y-auto">
                    {patientSearchResult.data.items.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="p-2 flex items-center justify-between hover:bg-cyan-50 cursor-pointer text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-2">Phone: {p.phone}</span>
                        </div>
                        <IdentifierPill type="patient" value={p.patientId} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modality & Exam Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Imaging Modality <span className="text-red-500">*</span>
                </label>
                <select
                  value={modality}
                  onChange={(e) => {
                    setModality(e.target.value as ModalityType);
                    setSelectedExamDefId('');
                  }}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                >
                  <option value="MRI">MRI — Magnetic Resonance</option>
                  <option value="CT">CT — Computed Tomography</option>
                  <option value="XRAY">XRAY — Radiography</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                  <option value="MAMMOGRAPHY">Mammography</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Catalog Exam Definition
                </label>
                <select
                  value={selectedExamDefId}
                  onChange={(e) => setSelectedExamDefId(e.target.value)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Select from standard catalog --</option>
                  {examDefinitions.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name} ({def.defaultDurationMinutes} min)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Examination Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. MRI Brain without Contrast"
                  value={examinationName}
                  onChange={(e) => setExaminationName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Anatomical Body Part <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Brain, Chest, Knee"
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Referring Physician & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Referring Physician
                </label>
                <select
                  value={referringDoctorId}
                  onChange={(e) => setReferringDoctorId(e.target.value)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Internal / Walk-in --</option>
                  {referringDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.organization || 'Specialist'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Clinical Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                >
                  <option value="ROUTINE">Routine (Standard)</option>
                  <option value="URGENT">Urgent (Within 24h)</option>
                  <option value="STAT">STAT (Emergency / Immediate)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Contrast Requirement
                </label>
                <select
                  value={contrastRequirement}
                  onChange={(e) => setContrastRequirement(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="NONE">None (Non-contrast)</option>
                  <option value="IV">IV Contrast Required</option>
                  <option value="ORAL">Oral Contrast</option>
                  <option value="BOTH">Oral + IV Contrast</option>
                </select>
              </div>
            </div>

            {/* Clinical Indication */}
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-1">
                Clinical Indication & History <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Persistent severe left temporal headache for 3 weeks; rule out mass lesion or vascular malformation."
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Payer & Prior Authorization */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-800">Billing & Prior Authorization</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Pre-authorization linkage for insured exams</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Payer Type
                  </label>
                  <select
                    value={payerType}
                    onChange={(e) => setPayerType(e.target.value as PayerType)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="INSURANCE">Commercial Insurance</option>
                    <option value="SELF_PAY">Self-Pay (Cash / Card)</option>
                    <option value="CORPORATE">Corporate / Employer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Insurance Provider
                  </label>
                  <Input
                    placeholder="e.g. Blue Cross Blue Shield"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Member / Policy ID
                  </label>
                  <Input
                    placeholder="e.g. BC-99482710"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Prior Authorization Code
                  </label>
                  <Input
                    placeholder="e.g. AUTH-2026-99214"
                    value={authorizationCode}
                    onChange={(e) => setAuthorizationCode(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Authorization Status
                  </label>
                  <select
                    value={authorizationStatus}
                    onChange={(e) => setAuthorizationStatus(e.target.value as AuthorizationStatus)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="NOT_REQUIRED">Not Required</option>
                    <option value="REJECTED">Denied / Rejected</option>
                  </select>
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
              disabled={orderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={orderMutation.isPending}
              className="bg-cyan-700 hover:bg-cyan-800 text-white gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Generate Accession & Create Order</span>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

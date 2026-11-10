import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { AlertCircle, CheckCircle2, Flame } from 'lucide-react';

interface WalkInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WalkInRegistrationModal({ open, onOpenChange, onSuccess }: WalkInModalProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Form State
  const [isNewPatient, setIsNewPatient] = useState(true);
  const [patientId, setPatientId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('1985-06-15');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');

  const [modality, setModality] = useState<'CT' | 'MRI' | 'XRAY' | 'ULTRASOUND'>('CT');
  const [bodyPart, setBodyPart] = useState('Chest');
  const [examinationName, setExaminationName] = useState('CT Chest Angiography (Emergency Walk-In)');
  const [clinicalIndication, setClinicalIndication] = useState('Acute chest pain, rule out PE');
  const [priority, setPriority] = useState<'STAT' | 'URGENT'>('STAT');
  const [referringDoctorText, setReferringDoctorText] = useState('Dr. Marcus Vance (Emergency Department)');
  const [contrastRequired, setContrastRequired] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        modality,
        bodyPart,
        examinationName,
        clinicalIndication,
        priority,
        referringDoctorText,
        contrastRequired,
      };

      if (isNewPatient) {
        payload.newPatient = {
          firstName,
          lastName,
          phone,
          dateOfBirth: dob,
          gender,
        };
      } else {
        payload.patientId = patientId;
      }

      const res = await receptionDeliveryService.registerWalkIn(payload);
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['receptionQueue'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledToday'] });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to register walk-in');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 bg-white dark:bg-slate-900 border rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-600 text-white rounded-lg">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Walk-In / Emergency Scan Registration
              </DialogTitle>
              <p className="text-2xs text-slate-500">
                Creates urgent non-booked scan order, assigns queue token, and routes directly to waiting queue
              </p>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Walk-In Patient Registered & Checked In!</span>
              </div>
              <p className="text-xs text-slate-600">
                Patient is placed in the live technologist waiting queue with daily queue token:
              </p>
              <div className="p-3 bg-white rounded-lg border border-emerald-100 flex items-center justify-between font-mono">
                <div>
                  <span className="text-2xs text-slate-500 block">Queue Token</span>
                  <span className="text-lg font-bold text-emerald-700">{result.tokenNumber}</span>
                </div>
                <div>
                  <span className="text-2xs text-slate-500 block">Accession</span>
                  <span className="text-sm font-bold text-indigo-700">{result.accessionNumber}</span>
                </div>
                <div>
                  <span className="text-2xs text-slate-500 block">Patient MRN</span>
                  <span className="text-sm font-bold text-slate-800">{result.patientId}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleReset} className="w-full bg-slate-900 text-white text-xs">
                Close & Return to Reception Queue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <button
                type="button"
                onClick={() => setIsNewPatient(true)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  isNewPatient ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                New Walk-In Patient
              </button>
              <button
                type="button"
                onClick={() => setIsNewPatient(false)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  !isNewPatient ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Existing Patient (By ID)
              </button>
            </div>

            {isNewPatient ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-2xs font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Smith"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 019-2831"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full p-2 border rounded bg-white text-xs"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-2xs font-semibold mb-1">Patient MRN / ID *</label>
                <input
                  type="text"
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="e.g. PAT-2026-DEMO01"
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
              <div>
                <label className="block text-2xs font-semibold mb-1">Modality</label>
                <select
                  value={modality}
                  onChange={(e) => {
                    const m = e.target.value as any;
                    setModality(m);
                    setExaminationName(`${m} Emergency Scan`);
                  }}
                  className="w-full p-2 border rounded text-xs"
                >
                  <option value="CT">CT Scanner</option>
                  <option value="MRI">MRI Scanner</option>
                  <option value="XRAY">Digital X-Ray</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full p-2 border rounded text-xs text-rose-700 font-bold"
                >
                  <option value="STAT">STAT (Immediate Emergency)</option>
                  <option value="URGENT">URGENT (Within 1 Hour)</option>
                </select>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold mb-1">Body Part *</label>
                  <input
                    type="text"
                    required
                    value={bodyPart}
                    onChange={(e) => setBodyPart(e.target.value)}
                    placeholder="e.g. Chest, Brain, Abdomen"
                    className="w-full p-2 border rounded text-xs"
                  />
                </div>
                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contrastRequired}
                      onChange={(e) => setContrastRequired(e.target.checked)}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span>IV Contrast Administration Required</span>
                  </label>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-2xs font-semibold mb-1">Examination Name</label>
                <input
                  type="text"
                  required
                  value={examinationName}
                  onChange={(e) => setExaminationName(e.target.value)}
                  className="w-full p-2 border rounded text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-2xs font-semibold mb-1">Clinical Indication *</label>
                <textarea
                  rows={2}
                  required
                  value={clinicalIndication}
                  onChange={(e) => setClinicalIndication(e.target.value)}
                  className="w-full p-2 border rounded text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-2xs font-semibold mb-1">Referring Clinician / ER</label>
                <input
                  type="text"
                  value={referringDoctorText}
                  onChange={(e) => setReferringDoctorText(e.target.value)}
                  className="w-full p-2 border rounded text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                {loading ? 'Registering...' : 'Confirm Walk-In & Issue Token'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { CheckCircle2, Plus, ShieldCheck } from 'lucide-react';

interface ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  accessionNumber: string;
  patientName: string;
}

export function OrderConsentModal({
  open,
  onOpenChange,
  orderId,
  accessionNumber,
  patientName,
}: ConsentModalProps) {
  const [loading, setLoading] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New form fields
  const [formType, setFormType] = useState<'GENERAL_CONSENT' | 'CONTRAST_CONSENT' | 'MRI_SAFETY_FORM'>('GENERAL_CONSENT');
  const [signedByName, setSignedByName] = useState(patientName);
  const [witnessName, setWitnessName] = useState('Front Desk Reception');
  const [notes, setNotes] = useState('Patient informed consent verified and collected at reception desk.');

  useEffect(() => {
    if (open && orderId) {
      loadConsent();
    }
  }, [open, orderId]);

  const loadConsent = async () => {
    setLoading(true);
    try {
      const data = await receptionDeliveryService.getOrderConsent(orderId);
      setForms(data.consentForms || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await receptionDeliveryService.recordOrderConsent(orderId, {
        formType,
        signedByName,
        witnessName,
        notes,
        status: 'SIGNED',
      });
      setSuccessMsg('Signed consent form recorded successfully.');
      loadConsent();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to record consent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 bg-white dark:bg-slate-900 border rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#174A70] text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Patient Consent & Intake Forms
              </DialogTitle>
              <p className="text-2xs text-slate-500">
                Accession: <span className="font-mono font-bold text-indigo-700">{accessionNumber}</span> • Patient: {patientName}
              </p>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-2 p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs">{error}</div>
        )}
        {successMsg && (
          <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-4 py-3">
          {/* List of existing signed forms */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Recorded Consent Forms ({forms.length})</h4>
            {forms.length === 0 ? (
              <div className="p-3 bg-slate-50 border rounded-lg text-2xs text-slate-500 text-center">
                No signed forms recorded yet. Record patient consent below.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {forms.map((f, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 border rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{f.formType.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-2xs text-slate-500 mt-0.5">
                        Signed by: <strong className="text-slate-700">{f.signedByName}</strong> • Witness: {f.witnessName || 'N/A'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-2xs font-bold border border-emerald-200">
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form to record new consent */}
          <form onSubmit={handleRecord} className="p-3.5 bg-slate-50 rounded-xl border space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Collect New Signed Consent
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-2xs font-semibold mb-1">Form Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full p-1.5 border rounded text-xs bg-white"
                >
                  <option value="GENERAL_CONSENT">General Diagnostic Consent</option>
                  <option value="CONTRAST_CONSENT">IV Contrast Administration Consent</option>
                  <option value="MRI_SAFETY_FORM">MRI Safety Screening Acknowledgment</option>
                  <option value="PROCEDURE_CONSENT">Special Procedure Consent</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold mb-1">Signatory Name *</label>
                <input
                  type="text"
                  required
                  value={signedByName}
                  onChange={(e) => setSignedByName(e.target.value)}
                  className="w-full p-1.5 border rounded text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold mb-1">Witness / Staff Name</label>
                <input
                  type="text"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  className="w-full p-1.5 border rounded text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold mb-1">Notes / Verification Details</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-1.5 border rounded text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} size="sm" className="bg-[#174A70] hover:bg-[#123855] text-white text-xs">
                {loading ? 'Recording...' : 'Record Signed Consent'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

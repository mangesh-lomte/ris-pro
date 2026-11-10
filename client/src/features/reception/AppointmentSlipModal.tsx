import { useEffect, useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { receptionDeliveryService } from '../../services/receptionDeliveryService';
import { Printer, Clock, FileText, AlertTriangle } from 'lucide-react';

interface SlipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
}

export function AppointmentSlipModal({ open, onOpenChange, appointmentId }: SlipModalProps) {
  const [loading, setLoading] = useState(false);
  const [slip, setSlip] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && appointmentId) {
      loadSlip();
    }
  }, [open, appointmentId]);

  const loadSlip = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await receptionDeliveryService.getAppointmentSlip(appointmentId);
      setSlip(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load slip');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 bg-white dark:bg-slate-900 border rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#174A70] text-white rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Appointment Slip & Preparation Instructions
                </DialogTitle>
                <p className="text-2xs text-slate-500">
                  Official printable slip with scheduling details, room allocation & modality preparation rules
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handlePrint} className="bg-[#174A70] hover:bg-[#123855] text-white text-xs gap-1.5 shadow-2xs">
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Generating appointment slip...</div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">{error}</div>
        ) : slip ? (
          <div id="printable-appointment-slip" className="space-y-4 py-2 font-sans text-slate-900">
            {/* Header info */}
            <div className="border-b pb-3 flex items-start justify-between">
              <div>
                <h2 className="text-base font-black tracking-tight">{slip.facilityName}</h2>
                <p className="text-2xs text-slate-500">{slip.facilityAddress} • {slip.facilityPhone}</p>
                <span className="text-3xs text-slate-400 font-mono">Generated: {new Date(slip.slipGeneratedAt).toLocaleString()}</span>
              </div>
              <div className="p-2 bg-slate-100 rounded-lg border text-right">
                <span className="text-3xs uppercase text-slate-500 font-bold block">Waiting Token</span>
                <span className="text-base font-black font-mono text-[#174A70]">{slip.appointment.tokenNumber}</span>
              </div>
            </div>

            {/* Patient & Exam Card */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border text-xs">
              <div>
                <span className="text-2xs text-slate-500 block">Patient Name / MRN</span>
                <div className="font-bold">{slip.patient.fullName}</div>
                <div className="font-mono text-2xs text-slate-600">{slip.patient.patientId} • {slip.patient.gender} • DOB: {slip.patient.dateOfBirth}</div>
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Scheduled Examination</span>
                <div className="font-bold text-indigo-900">{slip.appointment.examination}</div>
                <div className="text-2xs text-slate-600">Accession: <span className="font-mono font-semibold">{slip.order.accessionNumber}</span></div>
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Appointment Date & Time</span>
                <div className="font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  {new Date(slip.appointment.scheduledStart).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-2xs text-slate-500 block">Scanner & Room Location</span>
                <div className="font-semibold">{slip.appointment.location}</div>
                <div className="text-2xs text-slate-500">{slip.appointment.equipmentName}</div>
              </div>
            </div>

            {/* Preparation Rules Box */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Patient Preparation Instructions</span>
              </div>
              <p className="text-amber-900 leading-relaxed">{slip.preparationInstructions.instructions}</p>
              <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-2xs text-amber-800 font-semibold">
                <span>{slip.preparationInstructions.arrivalTimeNotice}</span>
                {slip.preparationInstructions.fastingRequired && <span className="text-rose-700">Strict Fasting</span>}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t text-2xs text-slate-400">
              Please present this slip at the reception and technologist preparation desk upon arrival.
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

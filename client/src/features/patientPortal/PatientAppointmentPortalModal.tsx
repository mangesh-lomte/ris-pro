import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  patientPortalBookingService,
  AvailableExamination,
  SlotsResponse,
  PortalAppointmentSummary,
} from '../../services/patientPortalBookingService';
import {
  Clock,
  FileText,
  Upload,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Phone,
  User,
  ShieldAlert,
  Loader2,
  RefreshCw,
  XCircle,
  FileDown,
  ArrowRight,
  Info,
  Eye,
  Download,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = 'BOOKING' | 'MY_APPOINTMENTS';

export function PatientAppointmentPortalModal({ open, onOpenChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('BOOKING');

  // Auth state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('FEMALE');
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);

  // Workflow steps
  const [bookingStep, setBookingStep] = useState<number>(1);
  // 1: Auth, 2: Select Exam, 3: Select Slot, 4: Booked Confirmed, 5: Prescription & Questionnaire, 6: Advance Deposit

  // Booking data
  const [examinations, setExaminations] = useState<AvailableExamination[]>([]);
  const [selectedModality, setSelectedModality] = useState<string>('CT');
  const [selectedExam, setSelectedExam] = useState<AvailableExamination | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);

  // Post-booking modules
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionBase64, setPrescriptionBase64] = useState<string | null>(null);
  const [prescriptionDoctor, setPrescriptionDoctor] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Questionnaire
  const [hasMetal, setHasMetal] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [hasKidneyDisease, setHasKidneyDisease] = useState(false);
  const [questionnaireSubmitted, setQuestionnaireSubmitted] = useState(false);

  // Deposit
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);
  const [paymentIdempotencyKey] = useState(() => crypto.randomUUID());

  // My Appointments list
  const [myAppointments, setMyAppointments] = useState<PortalAppointmentSummary[]>([]);
  const [rescheduleSlotTime, setRescheduleSlotTime] = useState<string>('');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  // Common UI states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset or load exams on open
  useEffect(() => {
    if (open) {
      loadExaminations();
    }
  }, [open, selectedModality]);

  const loadExaminations = async () => {
    try {
      const exams = await patientPortalBookingService.getExaminations(selectedModality);
      setExaminations(exams);
      if (exams.length > 0 && !selectedExam) {
        setSelectedExam(exams[0]);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadSlots = async () => {
    if (!selectedModality || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.getSlots(selectedModality, selectedDate, selectedExam?.id);
      setSlotsData(res);
      const firstAvail = res.slots.find((s) => s.isAvailable);
      setSelectedSlot(firstAvail?.startTime || null);
      setSelectedEquipmentId(firstAvail?.equipmentId || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load time slots');
    } finally {
      setLoading(false);
    }
  };

  const loadMyAppointments = async () => {
    if (!token) return;
    try {
      const list = await patientPortalBookingService.getPatientAppointments(token);
      setMyAppointments(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Auth Handlers
  const handleRequestOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.requestOtp(phone);
      setOtpSent(true);
      setOtp('');
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.verifyOtp({
        phone,
        otp,
        firstName,
        lastName,
        dateOfBirth: dob,
        gender,
      });
      setToken(res.token);
      setPatient(res.patient);
      setSuccessMsg(`Welcome, ${res.patient.firstName}! Patient ID: ${res.patient.patientId}`);
      setBookingStep(2); // proceed to Exam selection
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Booking Handler
  const handleBookAppointment = async () => {
    if (!token || !selectedExam || !selectedSlot || !selectedEquipmentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.bookAppointment(token, {
        examDefinitionId: selectedExam.id,
        scheduledStart: selectedSlot,
        equipmentId: selectedEquipmentId,
        clinicalNotes,
      });
      setBookedAppointment(res);
      const queued = res.notificationsSent?.filter((item: any) => item.status === 'QUEUED').length || 0;
      setSuccessMsg(queued > 0 ? 'Booking confirmed. Notifications have been queued.' : 'Booking confirmed. Notifications are simulated in this local environment.');
      setBookingStep(4); // Booking Confirmed overview
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Selected file exceeds 5MB limit.');
      return;
    }

    setPrescriptionFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1];
      setPrescriptionBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Prescription Upload Handler
  const handleUploadPrescription = async () => {
    if (!token || !bookedAppointment) return;
    setLoading(true);
    setError(null);
    try {
      const fileName = prescriptionFile?.name || 'doctor_referral_prescription.pdf';
      const fileType = prescriptionFile?.type || 'application/pdf';
      const fileSize = prescriptionFile?.size || 0;

      await patientPortalBookingService.uploadReferral(token, bookedAppointment.appointment.id, {
        fileName,
        fileType,
        fileSize,
        fileBase64: prescriptionBase64 || undefined,
        referralNotes: prescriptionNotes,
        doctorName: prescriptionDoctor,
      });
      setPrescriptionUploaded(true);
      setSuccessMsg('Doctor prescription attached to appointment record.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to upload prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (accessionNumber: string) => {
    if (!token) return;
    setActionLoading(`pdf-${accessionNumber}`);
    try {
      const blob = await patientPortalBookingService.downloadReportPdf(token, accessionNumber);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Diagnostic_Report_${accessionNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to download report PDF');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewImages = async (accessionNumber: string) => {
    if (!token) return;
    setActionLoading(`img-${accessionNumber}`);
    try {
      const data = await patientPortalBookingService.getViewerLaunch(token, accessionNumber);
      window.open(data.viewerUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.message || 'Unable to open imaging viewer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadReferral = async (appointmentId: string, fileName?: string) => {
    if (!token) return;
    setActionLoading(`ref-${appointmentId}`);
    try {
      const blob = await patientPortalBookingService.downloadReferralFile(token, appointmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `referral_${appointmentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to download referral file');
    } finally {
      setActionLoading(null);
    }
  };

  // Questionnaire Submit Handler
  const handleSubmitQuestionnaire = async () => {
    if (!token || !bookedAppointment) return;
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.submitQuestionnaire(token, bookedAppointment.appointment.id, {
        hasMetalImplants: hasMetal,
        hasAllergies,
        isPregnant,
        hasKidneyDisease,
        notes: 'Submitted via patient portal pre-visit checklist',
      });
      setQuestionnaireSubmitted(true);
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to submit questionnaire');
    } finally {
      setLoading(false);
    }
  };

  // Advance Deposit Handler
  const handlePayDeposit = async () => {
    if (!token || !bookedAppointment || !selectedExam) return;
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.payAdvanceDeposit(token, bookedAppointment.appointment.id, {
        amount: selectedExam.advanceDepositRequired,
        paymentMethod,
        idempotencyKey: paymentIdempotencyKey,
      });
      if (res.simulated) {
        setPaymentReceipt(null);
        setSuccessMsg(null);
        setError(res.message);
      } else {
        setPaymentReceipt(res);
        setSuccessMsg(`Payment of ${formatINR(res.amountPaid)} verified. Receipt: ${res.receiptNumber}`);
      }
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Handler
  const handleCancel = async (appointmentId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await patientPortalBookingService.cancelAppointment(token, appointmentId, 'Cancelled online by patient');
      setSuccessMsg('Appointment cancelled. Slot capacity restored.');
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Cancellation failed');
    } finally {
      setLoading(false);
    }
  };

  // Reschedule Handler
  const handleReschedule = async (appointmentId: string) => {
    if (!token || !rescheduleSlotTime) return;
    setLoading(true);
    try {
      await patientPortalBookingService.rescheduleAppointment(
        token,
        appointmentId,
        rescheduleSlotTime,
        'Patient requested new time slot online'
      );
      setSuccessMsg('Appointment successfully rescheduled.');
      setReschedulingId(null);
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Reschedule failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                <img src="/radaxis-symbol.png" alt="RadAxis" className="w-full h-full object-contain drop-shadow-xs" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-[#152B42] dark:text-slate-100 flex items-center gap-2">
                  Online Patient Appointment Portal
                  <Badge variant="outline" className="text-[#2563EB] bg-[#2563EB]/10 border-[#2563EB]/20 rounded-full text-[10px]">
                    Self-Service
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Self-service modality scheduling, doctor referral upload, safety screening, advance payment & report access
                </p>
              </div>
            </div>

            {token && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={activeTab === 'BOOKING' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('BOOKING')}
                  className="text-xs h-8"
                >
                  Book New Scan
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'MY_APPOINTMENTS' ? 'default' : 'outline'}
                  onClick={() => {
                    setActiveTab('MY_APPOINTMENTS');
                    loadMyAppointments();
                  }}
                  className="text-xs h-8"
                >
                  My Appointments ({myAppointments.length})
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: BOOKING JOURNEY */}
        {activeTab === 'BOOKING' && (
          <div className="mt-4 space-y-6">
            {/* Step 1: Mobile OTP Authentication */}
            {bookingStep === 1 && (
              <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-cyan-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Step 1: Patient Mobile OTP Authentication</h3>
                  </div>
                  <Badge variant="secondary" className="text-2xs font-medium">
                    Verification Code
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 555-0199"
                        className="w-full text-xs px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                      />
                      <Button
                        size="sm"
                        onClick={handleRequestOtp}
                        disabled={loading}
                        className="shrink-0 bg-cyan-600 hover:bg-cyan-700 text-xs"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : otpSent ? 'Resend OTP' : 'Send OTP'}
                      </Button>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">Existing patients and new patients are both supported.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enter Verification Code (OTP)</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                    />
                    <p className="text-2xs text-slate-500 mt-1">Enter the 6-digit code sent to your mobile device.</p>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 text-xs space-y-3">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Patient Identification Details (for New Registration)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-2xs text-slate-500">First Name</span>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Last Name</span>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Date of Birth</span>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Gender</span>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded bg-white"
                      >
                        <option value="FEMALE">Female</option>
                        <option value="MALE">Male</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={loading || !otp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-2"
                  >
                    Verify & Continue to Exam Selection <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Examination */}
            {bookingStep === 2 && (
              <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#2563EB]" />
                    <h3 className="font-bold text-slate-900 text-sm">Step 2: Choose Radiology Examination</h3>
                  </div>
                  <span className="text-xs text-slate-500">Patient: {patient?.firstName} {patient?.lastName} ({patient?.patientId})</span>
                </div>

                {/* Modality selector buttons */}
                <div className="flex flex-wrap gap-2">
                  {['CT', 'MRI', 'XRAY', 'ULTRASOUND'].map((mod) => (
                    <button
                      key={mod}
                      onClick={() => {
                        setSelectedModality(mod);
                        setSelectedExam(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedModality === mod
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {mod === 'CT' ? 'CT Scanner' : mod === 'MRI' ? 'MRI Scanner' : mod === 'XRAY' ? 'Digital X-Ray' : 'Ultrasound'}
                    </button>
                  ))}
                </div>

                {/* Exams list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                  {examinations.map((exam) => {
                    const isSelected = selectedExam?.id === exam.id;
                    return (
                      <div
                        key={exam.id}
                        onClick={() => setSelectedExam(exam)}
                        className={`p-3.5 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-blue-50/60 shadow-xs ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{exam.name}</h4>
                            <p className="text-2xs text-slate-500 mt-0.5">
                              {exam.bodyPart} • {exam.defaultDurationMinutes} mins
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-2xs font-mono">
                            {formatINR(exam.estimatedFee)}
                          </Badge>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-600">
                          <span>Deposit: {formatINR(exam.advanceDepositRequired)}</span>
                          {exam.preparation.fastingRequired ? (
                            <span className="text-amber-600 font-semibold">Fasting 4-6h</span>
                          ) : (
                            <span className="text-emerald-600">No Fasting</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedExam && (
                  <div className="space-y-2 pt-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-[#2563EB]" />
                      Patient Preparation & Clinical Instructions
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-blue-50/60 rounded-lg border border-indigo-100">
                        <span className="font-semibold text-indigo-950 block text-[11px] uppercase tracking-wide">
                          Before your examination
                        </span>
                        <p className="text-indigo-900 text-2xs mt-0.5">
                          {selectedExam.preparation.instructions || 'Follow standard radiological preparation instructions.'}
                        </p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wide">
                          What to bring
                        </span>
                        <p className="text-slate-600 text-2xs mt-0.5">
                          Doctor prescription/referral note, prior radiology imaging or reports, and photo ID.
                        </p>
                      </div>
                      <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/80">
                        <span className="font-semibold text-amber-950 block text-[11px] uppercase tracking-wide">
                          Fasting instructions
                        </span>
                        <p className="text-amber-900 text-2xs mt-0.5">
                          {selectedExam.preparation.fastingRequired
                            ? 'Fasting required: Do not eat or drink (except water) for 4–6 hours prior to scan.'
                            : 'No fasting required: You may eat and drink normally prior to your examination.'}
                        </p>
                      </div>
                      <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                        <span className="font-semibold text-emerald-950 block text-[11px] uppercase tracking-wide">
                          Arrival time
                        </span>
                        <p className="text-emerald-900 text-2xs mt-0.5">
                          Please arrive 15 minutes before your scheduled slot to complete identity verification and intake.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setBookingStep(1)} className="text-xs">
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      setBookingStep(3);
                      loadSlots();
                    }}
                    disabled={!selectedExam}
                    className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs flex items-center gap-2"
                  >
                    Continue to Slot Selection <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Select Date & Time Slot */}
            {bookingStep === 3 && (
              <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#2563EB]" />
                    <h3 className="font-bold text-slate-900 text-sm">Step 3: Select Date & Scanner Slot</h3>
                  </div>
                  <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                    {selectedExam?.name}
                  </Badge>
                </div>

                {/* Date Picker */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-lg border">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-500 mb-1">Appointment Date</label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                      }}
                      className="text-xs px-3 py-1.5 border rounded-lg bg-slate-50"
                    />
                  </div>

                  <Button size="sm" variant="outline" onClick={loadSlots} disabled={loading} className="text-xs self-end">
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Slots
                  </Button>
                </div>

                {/* Slots Grid */}
                {slotsData ? (
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                      <span>
                        Available Slots: <strong>{slotsData.availableSlotsCount}</strong> of {slotsData.totalSlotsCount}
                      </span>
                      <span className="text-2xs text-slate-500">30-minute intervals</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1">
                      {slotsData.slots.map((slot, idx) => {
                        const isSelected = selectedSlot === slot.startTime;
                        return (
                          <button
                            key={idx}
                            disabled={!slot.isAvailable}
                            onClick={() => {
                              setSelectedSlot(slot.startTime);
                              setSelectedEquipmentId(slot.equipmentId);
                            }}
                            className={`p-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : slot.isAvailable
                                ? 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                            }`}
                          >
                            <div className="font-semibold text-xs">{slot.displayTime.split(' - ')[0]}</div>
                            <div className="text-3xs opacity-80 mt-0.5">{slot.equipmentName}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">Loading open scanner slots...</div>
                )}

                {/* Clinical Notes */}
                <div>
                  <label className="block text-2xs font-semibold text-slate-700 mb-1">
                    Symptoms / Clinical Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Describe any symptoms or reasons for scan..."
                    className="w-full text-xs p-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setBookingStep(2)} className="text-xs">
                    Back
                  </Button>
                  <Button
                    onClick={handleBookAppointment}
                    disabled={loading || !selectedSlot || !selectedEquipmentId}
                    className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs flex items-center gap-2"
                  >
                    Confirm & Reserve Appointment <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Booking Confirmation & Post-Booking Actions */}
            {bookingStep === 4 && bookedAppointment && (
              <div className="space-y-5">
                {/* Confirmation Banner */}
                <div className="p-5 rounded border border-emerald-200 bg-emerald-50/60 text-slate-900 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded bg-emerald-600 text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-emerald-950">Appointment Successfully Booked & Confirmed!</h3>
                      <p className="text-xs text-emerald-800">
                        Confirmation reference: <strong>{bookedAppointment.appointment.appointmentNumber}</strong> • Accession: <strong>{bookedAppointment.accessionNumber}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white/80 rounded-lg border border-emerald-100 text-xs">
                    <div>
                      <span className="text-2xs text-slate-500">Patient MRN</span>
                      <div className="font-mono font-bold">{bookedAppointment.patientId}</div>
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Examination</span>
                      <div className="font-semibold">{bookedAppointment.appointment.examination}</div>
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Scheduled Time</span>
                      <div className="font-semibold">{new Date(bookedAppointment.appointment.scheduledStart).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-2xs text-slate-500">Notifications Sent</span>
                      <div className="text-emerald-700 font-semibold">SMS • WhatsApp • Email</div>
                    </div>
                  </div>
                </div>

                {/* Sub-steps Accordion: Prescription, Questionnaire, Advance Deposit */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Upload Doctor Prescription */}
                  <div className="p-4 rounded border border-slate-200 bg-white space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Upload className="w-4 h-4 text-cyan-600" />
                        <h4 className="font-bold text-slate-900 text-xs">Doctor Prescription</h4>
                      </div>
                      <p className="text-2xs text-slate-500 mb-3">
                        Attach referral from your referring doctor to streamline radiologist protocoling.
                      </p>

                      {prescriptionUploaded ? (
                        <div className="p-2.5 bg-cyan-50 rounded-lg border border-cyan-200 text-2xs text-cyan-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span>Prescription Attached ({prescriptionFile?.name || prescriptionDoctor})</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={handleFileSelect}
                            className="block w-full text-2xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-2xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                          />
                          <input
                            type="text"
                            value={prescriptionDoctor}
                            onChange={(e) => setPrescriptionDoctor(e.target.value)}
                            placeholder="Doctor Name"
                            className="w-full text-xs p-1.5 border rounded"
                          />
                          <input
                            type="text"
                            value={prescriptionNotes}
                            onChange={(e) => setPrescriptionNotes(e.target.value)}
                            placeholder="Indication / Diagnosis"
                            className="w-full text-xs p-1.5 border rounded"
                          />
                        </div>
                      )}
                    </div>

                    {!prescriptionUploaded && (
                      <Button
                        size="sm"
                        onClick={handleUploadPrescription}
                        disabled={loading}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs mt-2"
                      >
                        Upload Referral Note
                      </Button>
                    )}
                  </div>

                  {/* Pre-Visit Safety Questionnaire */}
                  <div className="p-4 rounded border border-slate-200 bg-white space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <h4 className="font-bold text-slate-900 text-xs">Safety Screening</h4>
                      </div>
                      <p className="text-2xs text-slate-500 mb-2">
                        Screening for metal implants, allergies, pregnancy, and kidney safety.
                      </p>

                      {questionnaireSubmitted ? (
                        <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-2xs text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Screening Cleared & Logged</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-2xs">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasMetal}
                              onChange={(e) => setHasMetal(e.target.checked)}
                              className="rounded"
                            />
                            <span>Metal implants / Pacemaker</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasAllergies}
                              onChange={(e) => setHasAllergies(e.target.checked)}
                              className="rounded"
                            />
                            <span>Contrast / Iodine allergy</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isPregnant}
                              onChange={(e) => setIsPregnant(e.target.checked)}
                              className="rounded"
                            />
                            <span>Possible Pregnancy</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasKidneyDisease}
                              onChange={(e) => setHasKidneyDisease(e.target.checked)}
                              className="rounded"
                            />
                            <span>Known Kidney Disease</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {!questionnaireSubmitted && (
                      <Button
                        size="sm"
                        onClick={handleSubmitQuestionnaire}
                        disabled={loading}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs mt-2"
                      >
                        Submit Safety Form
                      </Button>
                    )}
                  </div>

                  {/* Online Advance Deposit */}
                  <div className="p-4 rounded border border-slate-200 bg-white space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-slate-900 text-xs">Advance Booking Deposit</h4>
                      </div>
                      <p className="text-2xs text-slate-500 mb-2">
                        Deposit required: <strong>{formatINR(selectedExam?.advanceDepositRequired ?? 0)}</strong> (credited toward total fee).
                      </p>

                      {paymentReceipt ? (
                        <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-2xs text-emerald-800 space-y-1">
                          <div className="flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Paid {formatINR(paymentReceipt.amountPaid)}</span>
                          </div>
                          <div className="font-mono text-3xs text-slate-500">{paymentReceipt.receiptNumber}</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full text-xs p-1.5 border rounded bg-white"
                          >
                            <option value="UPI">UPI (Google Pay / PhonePe / QR)</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="DEBIT_CARD">Debit Card</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {!paymentReceipt && (
                      <Button
                        size="sm"
                        onClick={handlePayDeposit}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs mt-2"
                      >
                        Pay {formatINR(selectedExam?.advanceDepositRequired ?? 0)} Deposit
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t">
                  <Button
                    onClick={() => {
                      setActiveTab('MY_APPOINTMENTS');
                      loadMyAppointments();
                    }}
                    className="bg-slate-900 text-white text-xs flex items-center gap-2"
                  >
                    View All My Appointments <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: MY APPOINTMENTS & DOWNLOAD REPORT */}
        {activeTab === 'MY_APPOINTMENTS' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Your Scheduled & Historical Imaging Appointments
              </h3>
              <Button size="sm" variant="outline" onClick={loadMyAppointments} className="text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>

            {myAppointments.length === 0 ? (
              <div className="p-8 text-center border border-dashed rounded text-slate-500 text-xs">
                No appointment history found for this account.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {myAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-4 rounded border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{appt.examination}</span>
                          <Badge
                            variant={
                              appt.status === 'SCHEDULED'
                                ? 'default'
                                : appt.status === 'COMPLETED'
                                ? 'outline'
                                : 'destructive'
                            }
                            className="text-3xs"
                          >
                            {appt.status}
                          </Badge>
                        </div>
                        <p className="text-2xs text-slate-500 mt-0.5">
                          Ref: <span className="font-mono">{appt.appointmentNumber}</span> • Accession: <span className="font-mono">{appt.accessionNumber || 'N/A'}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-800">
                          {new Date(appt.scheduledStart).toLocaleDateString('en-IN')} at {new Date(appt.scheduledStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-2xs text-slate-500">{appt.equipmentName}</div>
                      </div>
                    </div>

                    {/* Reschedule inline drawer */}
                    {reschedulingId === appt.id && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                          <span>Select New Appointment Start Time:</span>
                          <button onClick={() => setReschedulingId(null)} className="text-[#2563EB] hover:text-indigo-800">
                            Cancel
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="datetime-local"
                            value={rescheduleSlotTime}
                            onChange={(e) => setRescheduleSlotTime(e.target.value)}
                            className="text-xs p-1.5 border rounded bg-white"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleReschedule(appt.id)}
                            className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs"
                          >
                            Confirm Reschedule
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Actions toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        {appt.invoice && (
                          <span className="text-2xs text-slate-600 font-medium">
                            Fee: {formatINR(appt.invoice.total)} (Paid: {formatINR(appt.invoice.paidAmount)})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {appt.status === 'SCHEDULED' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReschedulingId(appt.id);
                                setRescheduleSlotTime(appt.scheduledStart.slice(0, 16));
                              }}
                              className="text-2xs h-7 text-[#2563EB] hover:bg-[#2563EB]/10 border-slate-300"
                            >
                              <Clock className="w-3 h-3 mr-1" /> Reschedule
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(appt.id)}
                              className="text-2xs h-7 text-rose-700 hover:bg-rose-50"
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          </>
                        )}

                        {appt.prescription?.hasStoredFile && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadReferral(appt.id, appt.prescription?.fileName)}
                            disabled={actionLoading === `ref-${appt.id}`}
                            className="text-2xs h-7 text-cyan-700 hover:bg-cyan-50 border-cyan-200"
                          >
                            <Download className="w-3 h-3 mr-1" /> Prescription
                          </Button>
                        )}

                        {(appt.hasImages || appt.isReportFinalized) && appt.accessionNumber && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewImages(appt.accessionNumber!)}
                            disabled={actionLoading === `img-${appt.accessionNumber}`}
                            className="text-2xs h-7 bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300"
                          >
                            <Eye className="w-3 h-3 mr-1 text-[#2563EB]" /> View Images
                          </Button>
                        )}

                        {appt.isReportFinalized && appt.accessionNumber && (
                          <Button
                            size="sm"
                            onClick={() => handleDownloadReport(appt.accessionNumber!)}
                            disabled={actionLoading === `pdf-${appt.accessionNumber}`}
                            className="text-2xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                          >
                            {actionLoading === `pdf-${appt.accessionNumber}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FileDown className="w-3 h-3" />
                            )}
                            Download Final Report
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-6 border-t pt-3 flex items-center justify-between">
          <div className="text-2xs text-slate-500">
            Secure Radiology Patient Services
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close Portal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

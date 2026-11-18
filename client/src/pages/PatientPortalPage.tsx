import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  patientPortalBookingService,
  AvailableExamination,
  SlotsResponse,
  PortalAppointmentSummary,
} from '../services/patientPortalBookingService';
import {
  Calendar,
  Clock,
  FileText,
  Upload,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Phone,
  ShieldAlert,
  Loader2,
  RefreshCw,
  XCircle,
  FileDown,
  ArrowRight,
  Eye,
  LogOut,
  Download,
  Stethoscope,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { safeRandomUUID } from '../utils/uuid';

type TabType = 'BOOKING' | 'MY_APPOINTMENTS';

export function PatientPortalPage() {
  const [activeTab, setActiveTab] = useState<TabType>('BOOKING');

  // Auth state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('FEMALE');
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('radaxis_patient_token'));
  const [patient, setPatient] = useState<any>(() => {
    const saved = localStorage.getItem('radaxis_patient_data');
    return saved ? JSON.parse(saved) : null;
  });

  // Booking step: 1 = Exam selection, 2 = Slot selection, 3 = Confirmation & Prep
  const [bookingStep, setBookingStep] = useState<number>(1);

  // Booking state
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

  // Post-booking: Referral prescription upload
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionBase64, setPrescriptionBase64] = useState<string | null>(null);
  const [prescriptionDoctor, setPrescriptionDoctor] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post-booking: Safety checklist
  const [hasMetal, setHasMetal] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [hasKidneyDisease, setHasKidneyDisease] = useState(false);
  const [questionnaireSubmitted, setQuestionnaireSubmitted] = useState(false);

  // Post-booking: Deposit
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);
  const [paymentIdempotencyKey] = useState(() => safeRandomUUID());

  // My Appointments list
  const [myAppointments, setMyAppointments] = useState<PortalAppointmentSummary[]>([]);
  const [rescheduleSlotTime, setRescheduleSlotTime] = useState<string>('');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load examinations when modality changes
  useEffect(() => {
    loadExaminations();
  }, [selectedModality]);

  // Load my appointments if authenticated
  useEffect(() => {
    if (token) {
      loadMyAppointments();
    }
  }, [token]);

  const loadExaminations = async () => {
    try {
      const exams = await patientPortalBookingService.getExaminations(selectedModality);
      setExaminations(exams);
      if (exams.length > 0) {
        setSelectedExam(exams[0]);
      }
    } catch (e: any) {
      console.error('Failed to load examinations', e);
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
      setError(err?.message || 'Failed to load time slots');
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
      console.error('Failed to load patient appointments', err);
    }
  };

  const handleRequestOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientPortalBookingService.requestOtp(phone);
      setOtpSent(true);
      setOtp('');
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err?.message || 'Failed to request verification code');
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
      localStorage.setItem('radaxis_patient_token', res.token);
      localStorage.setItem('radaxis_patient_data', JSON.stringify(res.patient));
      setSuccessMsg(`Welcome, ${res.patient.firstName}! Patient ID: ${res.patient.patientId}`);
      setBookingStep(1);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setPatient(null);
    localStorage.removeItem('radaxis_patient_token');
    localStorage.removeItem('radaxis_patient_data');
    setBookedAppointment(null);
    setBookingStep(1);
    setSuccessMsg('You have been signed out securely.');
  };

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
      setSuccessMsg(queued > 0 ? 'Appointment confirmed. Notifications have been queued.' : 'Appointment confirmed. Notifications are simulated in this local environment.');
      setBookingStep(3); // Go to post-booking confirmation
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm appointment booking');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Selected file exceeds 5MB size limit.');
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

  const handleUploadPrescription = async () => {
    if (!token || !bookedAppointment) return;
    setLoading(true);
    setError(null);
    try {
      const fileName = prescriptionFile?.name || 'referral_note.pdf';
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
      setSuccessMsg('Doctor prescription attached successfully to your appointment.');
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.message || 'Failed to attach doctor prescription');
    } finally {
      setLoading(false);
    }
  };

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
        notes: 'Submitted via patient online checklist',
      });
      setQuestionnaireSubmitted(true);
      setSuccessMsg(res.message || 'Safety screening verified.');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit safety screening');
    } finally {
      setLoading(false);
    }
  };

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
        setSuccessMsg(`Advance payment of ${formatINR(res.amountPaid)} confirmed. Receipt #${res.receiptNumber}`);
      }
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!token) return;
    setActionLoading(appointmentId);
    try {
      await patientPortalBookingService.cancelAppointment(token, appointmentId, 'Cancelled online by patient');
      setSuccessMsg('Your appointment has been cancelled. Time slot released.');
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel appointment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (appointmentId: string) => {
    if (!token || !rescheduleSlotTime) return;
    setActionLoading(appointmentId);
    try {
      await patientPortalBookingService.rescheduleAppointment(
        token,
        appointmentId,
        rescheduleSlotTime,
        'Patient selected new time slot via online portal'
      );
      setSuccessMsg('Appointment successfully rescheduled.');
      setReschedulingId(null);
      loadMyAppointments();
    } catch (err: any) {
      setError(err?.message || 'Failed to reschedule appointment');
    } finally {
      setActionLoading(null);
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

  return (
    <div className="min-h-screen clinical-grid-bg text-slate-800 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Header */}
      <header className="sticky top-3 z-30 px-3 md:px-5 lg:px-6">
        <div className="max-w-7xl mx-auto rounded-3xl border border-[#dce6e0] bg-white/85 backdrop-blur-md shadow-soft px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <img
                src="/radaxis-symbol.png"
                alt="RadAxis"
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-2">
                RADAXIS <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">Patient Portal</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Online Self-Service Scheduling, Prescription Upload &amp; Diagnostic Reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {token && patient ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-bold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 font-semibold">MRN: {patient.patientId}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSignOut}
                  className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-full border-rose-200"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                </Button>
              </div>
            ) : (
              <a
                href="/login"
                className="text-xs text-slate-700 hover:text-emerald-700 font-bold px-3 py-1.5 rounded-full hover:bg-slate-100 transition"
              >
                Staff Login &rarr;
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {/* Banner Alert Messages */}
        {error && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-900 text-xs flex items-center justify-between shadow-soft">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 text-sm font-bold cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs flex items-center justify-between shadow-soft">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-sm font-bold cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* Unauthenticated View: Patient OTP Login / Registration */}
        {!token ? (
          <div className="max-w-md mx-auto my-8">
            <div className="bg-white border border-[#dce6e0] rounded-3xl shadow-soft overflow-hidden">
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 bg-white/10 rounded-2xl">
                    <Phone className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-extrabold tracking-tight">Patient Secure Login</h2>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Access examination booking, view scheduled appointments, and retrieve finalized diagnostic reports.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mobile Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 555-0199"
                      className="w-full text-xs px-4 py-2 border border-slate-200/80 rounded-full bg-[#f4f7f5] hover:bg-[#edf2ee] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    />
                    <Button
                      onClick={handleRequestOtp}
                      disabled={loading || !phone}
                      className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 rounded-full font-bold shadow-soft"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Code'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">The code expires in five minutes. Local development codes appear only in the server console.</p>
                </div>

                {otpSent && (
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 6-digit code"
                        className="w-full text-center tracking-widest text-lg font-mono px-3 py-2 border border-slate-200/80 rounded-2xl bg-[#f4f7f5] hover:bg-[#edf2ee] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="p-4 bg-[#f4f8f5] rounded-2xl space-y-2.5 border border-[#dce6e0]">
                      <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                        Patient Profile Details
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First Name"
                          className="text-xs px-3 py-2 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                        />
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last Name"
                          className="text-xs px-3 py-2 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="text-xs px-3 py-2 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-700"
                        />
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="text-xs px-3 py-2 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-700"
                        >
                          <option value="FEMALE">Female</option>
                          <option value="MALE">Male</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      onClick={handleVerifyOtp}
                      disabled={loading || otp.length < 6}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs py-2.5 rounded-full font-bold shadow-soft flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code & Enter Portal'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated View */
          <div className="space-y-6">
            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-3xl border border-[#dce6e0] shadow-soft">
              <div className="flex items-center gap-2">
                <Button
                  variant={activeTab === 'BOOKING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('BOOKING')}
                  className={`text-xs rounded-full font-bold shadow-soft ${
                    activeTab === 'BOOKING'
                      ? 'bg-slate-900 text-white'
                      : 'border-[#dce6e0] bg-[#f4f7f5] text-slate-700 hover:bg-[#edf2ee]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Book Examination
                </Button>
                <Button
                  variant={activeTab === 'MY_APPOINTMENTS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveTab('MY_APPOINTMENTS');
                    loadMyAppointments();
                  }}
                  className={`text-xs rounded-full font-bold shadow-soft ${
                    activeTab === 'MY_APPOINTMENTS'
                      ? 'bg-slate-900 text-white'
                      : 'border-[#dce6e0] bg-[#f4f7f5] text-slate-700 hover:bg-[#edf2ee]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> My Appointments &amp; Reports ({myAppointments.length})
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 pr-2">
                <span>Logged in as:</span>
                <span className="font-bold text-slate-800">
                  {patient?.firstName} {patient?.lastName} ({patient?.patientId})
                </span>
              </div>
            </div>

            {/* TAB 1: BOOKING FLOW */}
            {activeTab === 'BOOKING' && (
              <div className="space-y-6">
                {/* STEP 1: SELECT MODALITY & EXAMINATION */}
                {bookingStep === 1 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-6 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                          Step 1: Choose Modality & Examination
                        </h3>
                        <p className="text-xs text-slate-500">
                          Select your required imaging modality and protocol.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-2xs self-start sm:self-center">
                        Transparent Pricing & Prep
                      </Badge>
                    </div>

                    {/* Modality Chips */}
                    <div className="flex flex-wrap gap-2">
                      {['CT', 'MRI', 'XRAY', 'ULTRASOUND', 'MAMMOGRAPHY'].map((mod) => (
                        <button
                          key={mod}
                          onClick={() => {
                            setSelectedModality(mod);
                            setSelectedExam(null);
                          }}
                          className={`px-4 py-2 rounded text-xs font-bold transition-all border ${
                            selectedModality === mod
                              ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {mod === 'XRAY' ? 'X-Ray' : mod === 'MAMMOGRAPHY' ? 'Mammogram' : mod}
                        </button>
                      ))}
                    </div>

                    {/* Examinations Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {examinations.map((exam) => {
                        const isSelected = selectedExam?.id === exam.id;
                        return (
                          <div
                            key={exam.id}
                            onClick={() => setSelectedExam(exam)}
                            className={`p-4 rounded border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {exam.name}
                              </h4>
                              <span className="font-bold text-xs text-emerald-600 shrink-0">
                                {formatINR(exam.estimatedFee)}
                              </span>
                            </div>

                            <div className="text-2xs text-slate-500 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Duration: ~{exam.defaultDurationMinutes} mins</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Stethoscope className="w-3 h-3 text-slate-400" />
                                <span>Body Area: {exam.bodyPart}</span>
                              </div>
                              {exam.preparation.fastingRequired && (
                                <div className="text-amber-600 font-medium">
                                  Fasting: 4-6 hours required
                                </div>
                              )}
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-3xs text-slate-500">
                              <span>Deposit: {formatINR(exam.advanceDepositRequired)}</span>
                              <span className={isSelected ? 'text-cyan-700 font-bold' : ''}>
                                {isSelected ? 'Selected' : 'Click to select'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end pt-3 border-t">
                      <Button
                        onClick={() => {
                          setBookingStep(2);
                          loadSlots();
                        }}
                        disabled={!selectedExam}
                        className="bg-[#2563EB] hover:bg-[#123956] text-white text-xs flex items-center gap-2"
                      >
                        Continue to Time Slots <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: SELECT DATE & TIME SLOT */}
                {bookingStep === 2 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-6 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                          Step 2: Select Date & Available Scanner Slot
                        </h3>
                        <p className="text-xs text-slate-500">
                          Selected Exam: <strong>{selectedExam?.name}</strong>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadSlots}
                        disabled={loading}
                        className="text-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Availability
                      </Button>
                    </div>

                    {/* Date Picker Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded border">
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Appointment Date
                        </label>
                        <input
                          type="date"
                          value={selectedDate}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="text-xs px-3 py-2 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {slotsData && (
                          <span>
                            Open Slots: <strong>{slotsData.availableSlotsCount}</strong> of {slotsData.totalSlotsCount} available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Slots Grid */}
                    {loading ? (
                      <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                        <span>Querying scanner capacity...</span>
                      </div>
                    ) : slotsData ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-60 overflow-y-auto p-1">
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
                              className={`p-3 rounded text-xs font-medium border text-center transition-all ${
                                isSelected
                                  ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm'
                                  : slot.isAvailable
                                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-cyan-400'
                                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                              }`}
                            >
                              <div className="font-bold text-xs">{slot.displayTime.split(' - ')[0]}</div>
                              <div className="text-3xs opacity-80 mt-0.5">{slot.equipmentName}</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Clinical Notes Input */}
                    <div>
                      <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Reason for Examination / Symptoms (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="e.g. Chronic chest tightness, shortness of breath, follow-up scan..."
                        className="w-full text-xs p-2.5 border rounded-lg bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookingStep(1)}
                        className="text-xs"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleBookAppointment}
                        disabled={loading || !selectedSlot || !selectedEquipmentId}
                        className="bg-[#2563EB] hover:bg-[#123956] text-white text-xs flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Reserve Slot'} <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: BOOKING CONFIRMED & POST-BOOKING PREPARATION */}
                {bookingStep === 3 && bookedAppointment && (
                  <div className="space-y-6">
                    {/* Confirmation Banner */}
                    <div className="p-6 rounded border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded bg-emerald-600 text-white">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-emerald-950 dark:text-emerald-100">
                            Appointment Successfully Confirmed!
                          </h3>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300">
                            Booking Reference: <strong className="font-mono">{bookedAppointment.appointment.appointmentNumber}</strong> • Accession: <strong className="font-mono">{bookedAppointment.accessionNumber}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white/90 dark:bg-slate-900/90 rounded border border-emerald-100 dark:border-emerald-900 text-xs">
                        <div>
                          <span className="text-2xs text-slate-500">Patient MRN</span>
                          <div className="font-mono font-bold">{bookedAppointment.patientId}</div>
                        </div>
                        <div>
                          <span className="text-2xs text-slate-500">Examination</span>
                          <div className="font-semibold">{bookedAppointment.appointment.examination}</div>
                        </div>
                        <div>
                          <span className="text-2xs text-slate-500">Date & Time</span>
                          <div className="font-semibold">
                            {new Date(bookedAppointment.appointment.scheduledStart).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-2xs text-slate-500">Dispatched Via</span>
                          <div className="text-emerald-700 dark:text-emerald-400 font-semibold">SMS • WhatsApp • Email</div>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Visit Action Modules (Prescription, Safety Screening, Deposit) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* 1. Real Doctor Prescription Upload */}
                      <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-cyan-600" />
                            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              Attach Prescription / Referral
                            </h4>
                          </div>
                          <p className="text-2xs text-slate-500">
                            Upload your doctor's signed referral note (PDF or image).
                          </p>

                          {prescriptionUploaded ? (
                            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded border border-cyan-200 text-2xs text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
                              <span>Prescription attached: {prescriptionFile?.name || 'Uploaded'}</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/webp"
                                onChange={handleFileSelect}
                                className="block w-full text-2xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-2xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                              />
                              <input
                                type="text"
                                value={prescriptionDoctor}
                                onChange={(e) => setPrescriptionDoctor(e.target.value)}
                                placeholder="Referring Doctor Name"
                                className="w-full text-xs p-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                              />
                              <input
                                type="text"
                                value={prescriptionNotes}
                                onChange={(e) => setPrescriptionNotes(e.target.value)}
                                placeholder="Clinical Indication / Diagnosis"
                                className="w-full text-xs p-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                              />
                            </div>
                          )}
                        </div>

                        {!prescriptionUploaded && (
                          <Button
                            size="sm"
                            onClick={handleUploadPrescription}
                            disabled={loading || !prescriptionFile}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs mt-2"
                          >
                            Upload Prescription Document
                          </Button>
                        )}
                      </div>

                      {/* 2. Pre-Visit Safety Screening */}
                      <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              Pre-Visit Safety Screening
                            </h4>
                          </div>
                          <p className="text-2xs text-slate-500">
                            Screen for metal implants, contrast allergies, and pregnancy.
                          </p>

                          {questionnaireSubmitted ? (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 text-2xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Pre-visit questionnaire recorded. Final safety clearance is completed by the technologist.</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5 text-2xs">
                              <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                  type="checkbox"
                                  checked={hasMetal}
                                  onChange={(e) => setHasMetal(e.target.checked)}
                                  className="rounded text-[#2563EB]"
                                />
                                <span>Metal implants, pacemaker or surgical clips</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                  type="checkbox"
                                  checked={hasAllergies}
                                  onChange={(e) => setHasAllergies(e.target.checked)}
                                  className="rounded text-[#2563EB]"
                                />
                                <span>Prior contrast medium / iodine reaction</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                  type="checkbox"
                                  checked={isPregnant}
                                  onChange={(e) => setIsPregnant(e.target.checked)}
                                  className="rounded text-[#2563EB]"
                                />
                                <span>Possible pregnancy</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                  type="checkbox"
                                  checked={hasKidneyDisease}
                                  onChange={(e) => setHasKidneyDisease(e.target.checked)}
                                  className="rounded text-[#2563EB]"
                                />
                                <span>Diagnosed kidney disease</span>
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
                            Submit Pre-Visit Questionnaire
                          </Button>
                        )}
                      </div>

                      {/* 3. Advance Booking Deposit */}
                      <div className="p-5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              Advance Booking Deposit
                            </h4>
                          </div>
                          <p className="text-2xs text-slate-500">
                            Required deposit: <strong>{formatINR(selectedExam?.advanceDepositRequired ?? 0)}</strong> (credited to final invoice).
                          </p>

                          {paymentReceipt ? (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 text-2xs text-emerald-800 dark:text-emerald-200 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Payment Confirmed: {formatINR(paymentReceipt.amountPaid)}</span>
                              </div>
                              <div className="font-mono text-3xs text-slate-500">
                                Receipt: {paymentReceipt.receiptNumber}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full text-xs p-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                              >
                                <option value="UPI">UPI (Google Pay / PhonePe / QR)</option>
                                <option value="CREDIT_CARD">Credit Card</option>
                                <option value="DEBIT_CARD">Debit Card</option>
                                <option value="ONLINE">Net Banking</option>
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

                    <div className="flex justify-between pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBookingStep(1);
                          setSelectedExam(null);
                        }}
                        className="text-xs"
                      >
                        Book Another Exam
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('MY_APPOINTMENTS');
                          loadMyAppointments();
                        }}
                        className="bg-[#2563EB] hover:bg-[#123956] text-white text-xs flex items-center gap-2"
                      >
                        View My Appointments & Reports <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MY APPOINTMENTS & REPORTS */}
            {activeTab === 'MY_APPOINTMENTS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Your Scheduled Scans & Diagnostic History
                    </h3>
                    <p className="text-xs text-slate-500">
                      View preparation instructions, reschedule, download reports, or open imaging studies.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadMyAppointments}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Records
                  </Button>
                </div>

                {myAppointments.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed rounded text-slate-500 text-xs space-y-2">
                    <p>No imaging appointments found for your account.</p>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('BOOKING')}
                      className="bg-[#2563EB] text-white text-xs"
                    >
                      Book a Scan Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 p-5 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                {appt.examination}
                              </span>
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
                              Reference: <span className="font-mono font-semibold">{appt.appointmentNumber}</span>
                              {appt.accessionNumber && (
                                <> • Accession: <span className="font-mono font-semibold">{appt.accessionNumber}</span></>
                              )}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {new Date(appt.scheduledStart).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              at{' '}
                              {new Date(appt.scheduledStart).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-2xs text-slate-500">{appt.equipmentName}</div>
                          </div>
                        </div>

                        {/* Inline Reschedule Dialog */}
                        {reschedulingId === appt.id && (
                          <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded border border-cyan-200 text-xs space-y-2">
                            <div className="flex items-center justify-between font-semibold text-cyan-900 dark:text-cyan-200">
                              <span>Select New Appointment Start Date & Time:</span>
                              <button
                                onClick={() => setReschedulingId(null)}
                                className="text-cyan-700 hover:text-cyan-900 text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="datetime-local"
                                value={rescheduleSlotTime}
                                onChange={(e) => setRescheduleSlotTime(e.target.value)}
                                className="text-xs p-2 border rounded-lg bg-white dark:bg-slate-900"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleReschedule(appt.id)}
                                disabled={actionLoading === appt.id}
                                className="bg-[#2563EB] hover:bg-[#123956] text-white text-xs"
                              >
                                {actionLoading === appt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm New Time'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Card Footer: Metadata & Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                          <div className="flex items-center gap-3">
                            {appt.invoice && (
                              <span className="text-2xs text-slate-600 dark:text-slate-400">
                                Total: {formatINR(appt.invoice.total)} • Paid: {formatINR(appt.invoice.paidAmount)}
                              </span>
                            )}
                            {appt.prescription?.hasStoredFile && (
                              <button
                                onClick={() => handleDownloadReferral(appt.id, appt.prescription?.fileName)}
                                className="inline-flex items-center gap-1 text-2xs text-cyan-700 dark:text-cyan-400 hover:underline font-medium"
                              >
                                <Download className="w-3 h-3" /> Prescription Attached
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Reschedule & Cancel for Scheduled appointments */}
                            {appt.status === 'SCHEDULED' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReschedulingId(appt.id);
                                    setRescheduleSlotTime(appt.scheduledStart.slice(0, 16));
                                  }}
                                  className="text-2xs h-7 text-[#2563EB] hover:bg-[#2563EB]/10"
                                >
                                  <Clock className="w-3 h-3 mr-1" /> Reschedule
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelAppointment(appt.id)}
                                  disabled={actionLoading === appt.id}
                                  className="text-2xs h-7 text-rose-600 hover:bg-rose-50"
                                >
                                  <XCircle className="w-3 h-3 mr-1" /> Cancel
                                </Button>
                              </>
                            )}

                            {/* Fix #2: Authorized Patient Image Access */}
                            {(appt.hasImages || appt.isReportFinalized) && appt.accessionNumber && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewImages(appt.accessionNumber!)}
                                disabled={actionLoading === `img-${appt.accessionNumber}`}
                                className="text-2xs h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                              >
                                <Eye className="w-3 h-3 mr-1 text-[#2563EB]" /> View Images
                              </Button>
                            )}

                            {/* Fix #1: Authorized Patient Report PDF Download */}
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-2xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          RadAxis Radiology Information System • Secure Patient Self-Service Portal
        </div>
      </footer>
    </div>
  );
}

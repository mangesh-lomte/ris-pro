import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAppointments } from '../../services/appointmentService';
import { Appointment, LivePatientStatusData, ModalityType, UserRole } from '../../types';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { ChevronRight } from 'lucide-react';

interface Props {
  activePatients?: LivePatientStatusData['activePatients'];
  isLoading?: boolean;
  userRole?: UserRole;
}

interface AppointmentCardData {
  appointmentId?: string;
  patientName: string;
  patientDatabaseId: string;
  examination: string;
  accessionNumber: string;
  priority: string;
  status: string;
  scheduledTime?: string;
}

interface ScheduleSlot {
  timeLabel: string;
  startHour: number;
  endHour: number;
  mri?: AppointmentCardData;
  ct?: AppointmentCardData;
  xray?: AppointmentCardData;
}

function hospitalDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function hospitalHour(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date));
}

export function ModalityScheduleMatrix({ activePatients = [], isLoading: isOverviewLoading, userRole }: Props) {
  const navigate = useNavigate();
  const currentHospitalDate = hospitalDateKey(new Date());
  const currentHour = hospitalHour(new Date());
  const canManageSchedule = userRole === 'ADMIN' || userRole === 'RECEPTION';

  // Fetch real appointments to populate timeline
  const { data: appointmentData, isLoading: isApptLoading } = useQuery({
    queryKey: ['dashboard-modality-schedule', currentHospitalDate],
    queryFn: () => fetchAppointments({ date: currentHospitalDate, pageSize: 100 }),
    staleTime: 30000,
  });

  const appointments: Appointment[] = appointmentData?.data?.items || [];
  const isLoading = isOverviewLoading || isApptLoading;

  const standardTimeSlots: { label: string; startHour: number; endHour: number }[] = [
    { label: '09:00 - 10:00', startHour: 9, endHour: 10 },
    { label: '10:00 - 11:00', startHour: 10, endHour: 11 },
    { label: '11:00 - 12:00', startHour: 11, endHour: 12 },
    { label: '13:00 - 14:00', startHour: 13, endHour: 14 },
    { label: '14:00 - 15:00', startHour: 14, endHour: 15 },
    { label: '15:00 - 16:00', startHour: 15, endHour: 16 },
  ];

  const findAppointment = (modality: ModalityType, startHour: number, endHour: number): AppointmentCardData | undefined => {
    const matchingAppts = appointments.filter((a) => {
      if (a.modality !== modality) return false;
      const d = new Date(a.scheduledStart);
      if (hospitalDateKey(d) !== currentHospitalDate) return false;
      const h = hospitalHour(d);
      return h >= startHour && h < endHour;
    });

    if (matchingAppts.length > 0) {
      const priorityWeight: Record<string, number> = { STAT: 3, URGENT: 2, ROUTINE: 1 };
      const activeStatuses = ['CHECKED_IN', 'IN_PROGRESS', 'ARRIVED', 'SCHEDULED'];

      const sorted = [...matchingAppts].sort((a, b) => {
        const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        const aActive = activeStatuses.includes(a.status) ? 1 : 0;
        const bActive = activeStatuses.includes(b.status) ? 1 : 0;
        return bActive - aActive;
      });

      const chosen = sorted[0];
      const timeStr = new Date(chosen.scheduledStart).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      return {
        appointmentId: chosen.id,
        patientName: chosen.patient ? `${chosen.patient.firstName} ${chosen.patient.lastName}`.trim() : 'Patient',
        patientDatabaseId: chosen.patient?.id || chosen.patientId || '',
        examination: chosen.examination || chosen.imagingOrder?.examinationName || `${modality} Examination`,
        accessionNumber: chosen.imagingOrder?.accessionNumber || chosen.appointmentNumber,
        priority: chosen.priority || 'ROUTINE',
        status: chosen.status,
        scheduledTime: timeStr,
      };
    }

    const matchingActive = activePatients.find((p) => p.modality === modality && p.stage === 'SCANNING');
    if (matchingActive) {
      return {
        patientName: matchingActive.patientName,
        patientDatabaseId: matchingActive.databasePatientId,
        examination: matchingActive.examinationName,
        accessionNumber: matchingActive.accessionNumber,
        priority: matchingActive.priority,
        status: matchingActive.status,
      };
    }

    return undefined;
  };

  const slots: ScheduleSlot[] = standardTimeSlots.map((slot) => ({
    timeLabel: slot.label,
    startHour: slot.startHour,
    endHour: slot.endHour,
    mri: findAppointment('MRI', slot.startHour, slot.endHour),
    ct: findAppointment('CT', slot.startHour, slot.endHour),
    xray: findAppointment('XRAY', slot.startHour, slot.endHour),
  }));

  const handleCardClick = (card?: AppointmentCardData) => {
    if (!card) return;
    if (card.patientDatabaseId) {
      navigate(`/patients/${card.patientDatabaseId}`);
    } else if (card.accessionNumber) {
      navigate(`/orders?search=${card.accessionNumber}`);
    } else {
      navigate('/appointments');
    }
  };

  const renderCard = (card?: AppointmentCardData) => {
    if (!card) {
      return (
        <button
          type="button"
          onClick={() => (canManageSchedule ? navigate('/appointments') : undefined)}
          className="w-full p-3 rounded-2xl bg-white border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 flex items-center justify-between text-left transition group cursor-pointer"
        >
          <div>
            <span className="text-xs text-slate-500 font-semibold italic">Emergency Buffer Slot</span>
            <div className="text-[10px] text-slate-400">Available for Trauma / Inpatient</div>
          </div>
          {canManageSchedule && (
            <span className="text-[10px] font-bold text-slate-800 bg-[#e9f1ed] hover:bg-emerald-100 px-3 py-1 rounded-full transition">
              Assign
            </span>
          )}
        </button>
      );
    }

    const isStat = card.priority === 'STAT';
    const isUrgent = card.priority === 'URGENT';

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleCardClick(card)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick(card);
          }
        }}
        className={`p-3 rounded-2xl border transition-all cursor-pointer group text-left shadow-2xs ${
          isStat
            ? 'bg-rose-50/90 border-rose-200'
            : isUrgent
            ? 'bg-[#fdf9ee] border-amber-200/70'
            : 'bg-[#f4f7f5] border-slate-200/60'
        }`}
        title="Click to view patient clinical chart and order records"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className={`font-bold text-xs truncate ${isStat ? 'text-rose-950 font-extrabold' : 'text-slate-900'}`}>
            {card.patientName}
          </span>
          <PriorityBadge priority={card.priority as any} />
        </div>

        <p className="text-[11px] text-slate-600 truncate mt-1">
          {card.examination}
        </p>

        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-clinical-mono">
          <span className="truncate max-w-[120px]">{card.accessionNumber}</span>
          <span className={`font-bold font-sans ${isStat ? 'text-rose-700' : 'text-emerald-700'}`}>
            {card.scheduledTime ? `${card.scheduledTime} ` : ''}{card.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-[#dce6e0] shadow-soft p-5 lg:p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">Modality Operations Matrix</h2>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
              Live Progression
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Examination status and suite allocations for today
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center bg-[#f0f4f1] p-1 rounded-full">
          <Link to="/appointments" className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xs">
            All Suites
          </Link>
          <Link to="/appointments?modality=CT" className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 text-xs font-semibold">
            CT (128)
          </Link>
          <Link to="/appointments?modality=MRI" className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 text-xs font-semibold">
            MRI (3.0T)
          </Link>
        </div>
      </div>

      {/* Slots List */}
      <div className="divide-y divide-slate-100 text-xs mt-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-medium animate-pulse">
            Loading modality schedule matrix...
          </div>
        ) : (
          slots.map((slot, index) => {
          const isActive = currentHour >= slot.startHour && currentHour < slot.endHour;
          return (
            <div
              key={index}
              className={`py-3.5 grid grid-cols-12 gap-3 items-center rounded-2xl px-2 transition ${
                isActive ? 'bg-emerald-50/40 rounded-2xl' : 'hover:bg-slate-50/50'
              }`}
            >
              {/* Time Column */}
              <div className="col-span-12 sm:col-span-2 font-clinical-mono text-slate-500 font-bold text-xs flex items-center gap-1.5">
                {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {slot.timeLabel}
              </div>

              {/* CT Suite Column */}
              <div className="col-span-12 sm:col-span-5">
                {renderCard(slot.ct)}
              </div>

              {/* MRI Suite Column */}
              <div className="col-span-12 sm:col-span-5">
                {renderCard(slot.mri)}
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>Live feed synced with PACS DICOM listener</span>
        <Link to="/appointments" className="font-bold text-slate-900 hover:text-emerald-700 flex items-center gap-1">
          Full Modality Calendar
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
export default ModalityScheduleMatrix;

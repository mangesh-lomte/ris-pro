import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAppointments } from '../../services/appointmentService';
import { Appointment, LivePatientStatusData, ModalityType, UserRole } from '../../types';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

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
  const canManageSchedule = userRole === 'ADMIN' || userRole === 'RECEPTION';

  // Fetch real appointments to populate timeline
  const { data: appointmentData, isLoading: isApptLoading } = useQuery({
    queryKey: ['dashboard-modality-schedule', currentHospitalDate],
    queryFn: () => fetchAppointments({ date: currentHospitalDate, pageSize: 100 }),
    staleTime: 30000,
  });

  const appointments: Appointment[] = appointmentData?.data?.items || [];
  const isLoading = isOverviewLoading || isApptLoading;

  // Standard operational time slots matching clinical operating model
  const standardTimeSlots: { label: string; startHour: number; endHour: number }[] = [
    { label: '09:00 - 10:00', startHour: 9, endHour: 10 },
    { label: '10:00 - 11:00', startHour: 10, endHour: 11 },
    { label: '11:00 - 12:00', startHour: 11, endHour: 12 },
    { label: '13:00 - 14:00', startHour: 13, endHour: 14 },
    { label: '14:00 - 15:00', startHour: 14, endHour: 15 },
    { label: '15:00 - 16:00', startHour: 15, endHour: 16 },
  ];

  // Helper to find a real scheduled appointment for a modality and hourly window
  const findAppointment = (modality: ModalityType, startHour: number, endHour: number): AppointmentCardData | undefined => {
    // 1. Filter appointments by modality and scheduledStart hour
    const matchingAppts = appointments.filter((a) => {
      if (a.modality !== modality) return false;
      const d = new Date(a.scheduledStart);
      if (hospitalDateKey(d) !== currentHospitalDate) return false;
      const h = hospitalHour(d);
      return h >= startHour && h < endHour;
    });

    if (matchingAppts.length > 0) {
      // Prioritize STAT > URGENT > ROUTINE, then active statuses
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

    // 2. Check active patients if an active scan is ongoing for this modality
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
      if (!canManageSchedule) {
        return (
          <div className="w-full py-3 px-2 rounded-md border border-dashed border-slate-200 text-center text-[10px] text-slate-400 font-medium">
            Slot Available
          </div>
        );
      }
      return (
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="w-full py-3 px-2 rounded-md border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-colors text-center text-[10px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
          title="Suite available — click to open Clinical Scheduler"
        >
          Slot Available
        </button>
      );
    }

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
        className="p-2.5 rounded-md bg-white border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-[#174A70]/60 hover:shadow-xs transition-all cursor-pointer group text-left"
        title="Click to view patient clinical chart and order records"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-semibold text-xs text-[#152B42] group-hover:text-[#174A70] transition-colors truncate">
            {card.patientName}
          </span>
          <PriorityBadge priority={card.priority as any} />
        </div>
        <p className="text-[11px] text-slate-600 truncate leading-snug">
          {card.examination}
        </p>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="font-mono text-[10px] text-[#174A70] font-medium truncate">
            {card.accessionNumber}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {card.scheduledTime && (
              <span className="font-mono text-[10px] text-slate-500 font-medium">
                {card.scheduledTime}
              </span>
            )}
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal uppercase">
              {card.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#174A70] text-white rounded-md shadow-2xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#152B42] tracking-tight">
              Modality Schedule &amp; Operations Matrix
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Today's scheduled examinations &amp; live scan progression across imaging suites
            </p>
          </div>
        </div>

        {canManageSchedule && <div className="flex items-center gap-2">
          <Link
            to="/appointments"
            className="text-[11px] font-semibold text-[#174A70] hover:text-[#123855] px-2.5 py-1 rounded-md bg-[#174A70]/5 hover:bg-[#174A70]/10 border border-[#174A70]/20 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <span>Full Schedule</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>}
      </div>

      {/* Schedule Table / Grid with Contained Horizontal Scroll & Sticky Time Slot Column */}
      <div className="table-scroll-container thin-scroll w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <th className="sticky left-0 z-20 bg-slate-50 py-2.5 px-3 min-w-[120px] w-32 whitespace-nowrap border-r border-slate-200/80 shadow-[1px_0_0_0_#e2e8f0]">
                Time Slot
              </th>
              <th className="py-2.5 px-3 min-w-[210px] border-r border-slate-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span className="truncate">MRI Suite (1.5T / 3.0T)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[210px] border-r border-slate-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                  <span className="truncate">CT Suite (128-Slice)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 min-w-[210px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Digital X-Ray Suite</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                  Loading modality schedule telemetry...
                </td>
              </tr>
            ) : (
              slots.map((slot) => (
                <tr key={slot.timeLabel} className="hover:bg-slate-50/40 transition-colors">
                  {/* Sticky Time Column */}
                  <td className="sticky left-0 z-10 bg-slate-50/95 backdrop-blur-xs font-mono font-medium text-slate-600 text-[11px] whitespace-nowrap tabular-nums align-top border-r border-slate-200/80 shadow-[1px_0_0_0_#e2e8f0] py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{slot.timeLabel}</span>
                    </div>
                  </td>

                  {/* MRI Cell */}
                  <td className="py-2 px-3 border-r border-slate-100 align-top min-w-[210px]">
                    {renderCard(slot.mri)}
                  </td>

                  {/* CT Cell */}
                  <td className="py-2 px-3 border-r border-slate-100 align-top min-w-[210px]">
                    {renderCard(slot.ct)}
                  </td>

                  {/* X-Ray Cell */}
                  <td className="py-2 px-3 align-top min-w-[210px]">
                    {renderCard(slot.xray)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

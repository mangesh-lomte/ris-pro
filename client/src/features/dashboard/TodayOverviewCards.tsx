import { TodayOverviewData, UserRole } from '../../types';
import { CalendarCheck, CheckCircle2, Clock, IndianRupee, AlertTriangle, FileText } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface Props {
  data?: TodayOverviewData;
  criticalTasksCount?: number;
  userRole?: UserRole;
  isLoading?: boolean;
}

export function TodayOverviewCards({ data, criticalTasksCount = 0, userRole, isLoading }: Props) {
  let cards: Array<{
    title: string;
    value: string;
    subtext: string;
    pillText: string;
    pillClass: string;
    gradient: string;
    borderColor: string;
    icon: any;
    iconBg: string;
    iconColor: string;
    barBg: string;
    barFill: string;
    progressPercent: number;
  }>;

  if (userRole === 'TECHNOLOGIST') {
    cards = [
      {
        title: "Today's Bookings",
        value: isLoading ? '—' : (data?.totalBookings ?? 0).toString(),
        subtext: "Scheduled modality examinations",
        pillText: "+8% intake",
        pillClass: "text-emerald-700 bg-emerald-100/80",
        gradient: "from-[#eaf4fd] to-white",
        borderColor: "border-sky-100",
        icon: CalendarCheck,
        iconBg: "bg-sky-100",
        iconColor: "text-sky-700",
        barBg: "bg-sky-100/60",
        barFill: "bg-sky-600",
        progressPercent: Math.min(100, Math.max(15, (data?.totalBookings ?? 0) * 10)),
      },
      {
        title: 'Completed Scans',
        value: isLoading ? '—' : (data?.completedScans ?? 0).toString(),
        subtext: 'Acquired & QA confirmed',
        pillText: 'Verified',
        pillClass: "text-emerald-700 bg-emerald-100/80",
        gradient: "from-[#e8f7f0] to-white",
        borderColor: "border-emerald-100",
        icon: CheckCircle2,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
        barBg: "bg-emerald-100/60",
        barFill: "bg-emerald-500",
        progressPercent: Math.min(100, Math.max(20, (data?.completedScans ?? 0) * 15)),
      },
      {
        title: 'Acquisition Backlog',
        value: isLoading ? '—' : (data?.acquisitionBacklog ?? 0).toString(),
        subtext: 'Awaiting protocol or scan',
        pillText: 'Active',
        pillClass: "text-amber-800 bg-amber-100",
        gradient: "from-[#fef5e9] to-white",
        borderColor: "border-amber-100",
        icon: Clock,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
        barBg: "bg-amber-100/60",
        barFill: "bg-amber-500",
        progressPercent: Math.min(100, Math.max(25, (data?.acquisitionBacklog ?? 0) * 20)),
      },
      {
        title: 'Clinical Tasks',
        value: isLoading ? '—' : criticalTasksCount.toString(),
        subtext: 'STAT scans & emergency tasks',
        pillText: criticalTasksCount > 0 ? `${criticalTasksCount} STAT` : 'Normal',
        pillClass: criticalTasksCount > 0 ? "text-rose-700 bg-rose-100" : "text-slate-600 bg-slate-100",
        gradient: "from-[#fff2f2] to-white",
        borderColor: "border-rose-100",
        icon: AlertTriangle,
        iconBg: "bg-rose-100",
        iconColor: "text-rose-700",
        barBg: "bg-rose-100/60",
        barFill: "bg-rose-600",
        progressPercent: criticalTasksCount > 0 ? 85 : 10,
      },
    ];
  } else if (userRole === 'RADIOLOGIST') {
    cards = [
      {
        title: 'Pending Reports',
        value: isLoading ? '—' : (data?.pendingReports ?? 0).toString(),
        subtext: 'Ready for radiologist interpretation',
        pillText: `${data?.pendingReports ?? 0} in queue`,
        pillClass: "text-amber-800 bg-amber-100",
        gradient: "from-[#fef5e9] to-white",
        borderColor: "border-amber-100",
        icon: Clock,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
        barBg: "bg-amber-100/60",
        barFill: "bg-amber-500",
        progressPercent: Math.min(100, Math.max(20, (data?.pendingReports ?? 0) * 25)),
      },
      {
        title: 'Finalized Today',
        value: isLoading ? '—' : (data?.finalizedReportsToday ?? 0).toString(),
        subtext: 'Digitally signed reports',
        pillText: 'Signed',
        pillClass: "text-emerald-700 bg-emerald-100/80",
        gradient: "from-[#e8f7f0] to-white",
        borderColor: "border-emerald-100",
        icon: CheckCircle2,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
        barBg: "bg-emerald-100/60",
        barFill: "bg-emerald-500",
        progressPercent: Math.min(100, Math.max(15, (data?.finalizedReportsToday ?? 0) * 20)),
      },
      {
        title: 'STAT / Critical',
        value: isLoading ? '—' : criticalTasksCount.toString(),
        subtext: 'Critical findings & emergency alerts',
        pillText: criticalTasksCount > 0 ? `${criticalTasksCount} STAT` : 'Zero Alert',
        pillClass: criticalTasksCount > 0 ? "text-rose-700 bg-rose-100" : "text-slate-600 bg-slate-100",
        gradient: "from-[#fff2f2] to-white",
        borderColor: "border-rose-100",
        icon: AlertTriangle,
        iconBg: "bg-rose-100",
        iconColor: "text-rose-700",
        barBg: "bg-rose-100/60",
        barFill: "bg-rose-600",
        progressPercent: criticalTasksCount > 0 ? 80 : 5,
      },
      {
        title: "Today's Studies",
        value: isLoading ? '—' : (data?.totalBookings ?? 0).toString(),
        subtext: 'Departmental imaging caseload',
        pillText: 'Active Caseload',
        pillClass: "text-sky-800 bg-sky-100",
        gradient: "from-[#eaf4fd] to-white",
        borderColor: "border-sky-100",
        icon: FileText,
        iconBg: "bg-sky-100",
        iconColor: "text-sky-700",
        barBg: "bg-sky-100/60",
        barFill: "bg-sky-600",
        progressPercent: Math.min(100, Math.max(25, (data?.totalBookings ?? 0) * 15)),
      },
    ];
  } else {
    cards = [
      {
        title: "Today's Bookings",
        value: isLoading ? '—' : (data?.totalBookings ?? 0).toString(),
        subtext: "Scheduled & active clinical exams",
        pillText: "+8% yday",
        pillClass: "text-emerald-700 bg-emerald-100/80",
        gradient: "from-[#eaf4fd] to-white",
        borderColor: "border-sky-100",
        icon: CalendarCheck,
        iconBg: "bg-sky-100",
        iconColor: "text-sky-700",
        barBg: "bg-sky-100/60",
        barFill: "bg-sky-600",
        progressPercent: 76,
      },
      {
        title: 'Completed Scans',
        value: isLoading ? '—' : (data?.completedScans ?? 0).toString(),
        subtext: 'Scans acquired & PACS linked',
        pillText: `${data?.completedScans ?? 0} acquired`,
        pillClass: "text-emerald-700 bg-emerald-100/80",
        gradient: "from-[#e8f7f0] to-white",
        borderColor: "border-emerald-100",
        icon: CheckCircle2,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
        barBg: "bg-emerald-100/60",
        barFill: "bg-emerald-500",
        progressPercent: 47,
      },
      {
        title: 'Pending Reports',
        value: isLoading ? '—' : (data?.pendingReports ?? 0).toString(),
        subtext: 'Preliminary / awaiting radiologist',
        pillText: criticalTasksCount > 0 ? `${criticalTasksCount} STAT Alerts` : 'On track',
        pillClass: criticalTasksCount > 0 ? "text-rose-700 bg-rose-100" : "text-amber-800 bg-amber-100",
        gradient: "from-[#fef5e9] to-white",
        borderColor: "border-amber-100",
        icon: Clock,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
        barBg: "bg-amber-100/60",
        barFill: "bg-amber-500",
        progressPercent: 58,
      },
      {
        title: "Today's Revenue",
        value: isLoading ? '—' : (data?.totalRevenue && data.totalRevenue > 0 ? formatINR(data.totalRevenue) : '₹0'),
        subtext: 'Itemized clinical receipts',
        pillText: 'Audited',
        pillClass: "text-lime-800 bg-lime-100",
        gradient: "from-[#f2f7ec] to-white",
        borderColor: "border-lime-100",
        icon: IndianRupee,
        iconBg: "bg-lime-100",
        iconColor: "text-lime-800",
        barBg: "bg-lime-100/60",
        barFill: "bg-lime-600",
        progressPercent: 82,
      },
    ];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`bg-gradient-to-b ${card.gradient} p-5 rounded-3xl border ${card.borderColor} shadow-soft relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`w-8 h-8 rounded-full ${card.iconBg} flex items-center justify-center ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-clinical-mono">
                  {card.value}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.pillClass}`}>
                  {card.pillText}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium truncate">
                {card.subtext}
              </p>
            </div>

            <div className={`mt-4 w-full ${card.barBg} rounded-full h-2 overflow-hidden`}>
              <div
                className={`${card.barFill} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${card.progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

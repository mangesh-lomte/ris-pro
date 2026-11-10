import { TodayOverviewData, UserRole } from '../../types';
import { Card, CardContent } from '../../components/ui/card';
import { CalendarCheck, CheckCircle2, Clock, IndianRupee, AlertTriangle, FileText } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface Props {
  data?: TodayOverviewData;
  criticalTasksCount?: number;
  userRole?: UserRole;
  isLoading?: boolean;
}

export function TodayOverviewCards({ data, criticalTasksCount = 0, userRole, isLoading }: Props) {
  // Determine role-adapted 4-metric strip
  let cards: Array<{
    title: string;
    value: string;
    subtext: string;
    icon: any;
    iconColor: string;
    badgeBg: string;
  }>;

  if (userRole === 'TECHNOLOGIST') {
    // Technologist: Operational acquisition queue, safety/modality focus, NO prominent revenue
    cards = [
      {
        title: "Today's Bookings",
        value: isLoading ? '...' : (data?.totalBookings ?? 0).toString(),
        subtext: "Scheduled modality examinations",
        icon: CalendarCheck,
        iconColor: 'text-[#33398A]',
        badgeBg: 'bg-[#33398A]/10 border-[#33398A]/20',
      },
      {
        title: 'Completed Scans',
        value: isLoading ? '...' : (data?.completedScans ?? 0).toString(),
        subtext: 'Acquired & QC verified',
        icon: CheckCircle2,
        iconColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 border-emerald-200/70',
      },
      {
        title: 'Acquisition Backlog',
        value: isLoading ? '...' : (data?.acquisitionBacklog ?? 0).toString(),
        subtext: 'Awaiting protocol or exam completion',
        icon: Clock,
        iconColor: 'text-amber-700',
        badgeBg: 'bg-amber-50 border-amber-200/70',
      },
      {
        title: 'Clinical Tasks',
        value: isLoading ? '...' : criticalTasksCount.toString(),
        subtext: 'STAT scans & urgent technologist tasks',
        icon: AlertTriangle,
        iconColor: criticalTasksCount > 0 ? 'text-rose-700' : 'text-slate-500',
        badgeBg: criticalTasksCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200',
      },
    ];
  } else if (userRole === 'RADIOLOGIST') {
    // Radiologist: Diagnostic backlog, signed reports, critical findings
    cards = [
      {
        title: 'Pending Reports',
        value: isLoading ? '...' : (data?.pendingReports ?? 0).toString(),
        subtext: 'Ready for radiologist interpretation',
        icon: Clock,
        iconColor: 'text-amber-700',
        badgeBg: 'bg-amber-50 border-amber-200/70',
      },
      {
        title: 'Finalized Today',
        value: isLoading ? '...' : (data?.finalizedReportsToday ?? 0).toString(),
        subtext: 'Digitally signed diagnostic reports',
        icon: CheckCircle2,
        iconColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 border-emerald-200/70',
      },
      {
        title: 'STAT / Critical',
        value: isLoading ? '...' : criticalTasksCount.toString(),
        subtext: 'Critical findings & emergency alerts',
        icon: AlertTriangle,
        iconColor: criticalTasksCount > 0 ? 'text-rose-700' : 'text-slate-500',
        badgeBg: criticalTasksCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200',
      },
      {
        title: "Today's Studies",
        value: isLoading ? '...' : (data?.totalBookings ?? 0).toString(),
        subtext: 'Departmental imaging caseload',
        icon: FileText,
        iconColor: 'text-[#33398A]',
        badgeBg: 'bg-[#33398A]/10 border-[#33398A]/20',
      },
    ];
  } else {
    // Admin / Reception: Standard 4-metric departmental overview
    cards = [
      {
        title: "Today's Bookings",
        value: isLoading ? '...' : (data?.totalBookings ?? 0).toString(),
        subtext: "Today's scheduled & active exams",
        icon: CalendarCheck,
        iconColor: 'text-[#33398A]',
        badgeBg: 'bg-[#33398A]/10 border-[#33398A]/20',
      },
      {
        title: 'Completed Scans',
        value: isLoading ? '...' : (data?.completedScans ?? 0).toString(),
        subtext: 'Scans acquired & quality checked',
        icon: CheckCircle2,
        iconColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 border-emerald-200/70',
      },
      {
        title: 'Pending Reports',
        value: isLoading ? '...' : (data?.pendingReports ?? 0).toString(),
        subtext: 'Draft & preliminary radiologist review',
        icon: Clock,
        iconColor: 'text-amber-700',
        badgeBg: 'bg-amber-50 border-amber-200/70',
      },
      {
        title: 'Today Revenue',
        value: isLoading ? '...' : (data?.totalRevenue && data.totalRevenue > 0 ? formatINR(data.totalRevenue) : '₹0'),
        subtext: 'Processed & billed clinical charges',
        icon: IndianRupee,
        iconColor: 'text-[#33398A]',
        badgeBg: 'bg-[#33398A]/10 border-[#33398A]/20',
      },
    ];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="border-[#DCE2EC] bg-white shadow-card hover:border-[#33398A]/30 transition-all rounded-xl">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                    {card.title}
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#15233B] mt-1 tabular-nums">{card.value}</p>
                  <p className="text-xs text-[#64748B] mt-1 leading-snug line-clamp-1">{card.subtext}</p>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.badgeBg} ${card.iconColor} border`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

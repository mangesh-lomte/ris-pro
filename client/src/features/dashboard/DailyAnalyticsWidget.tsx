import { DailyAnalyticsData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart3, Clock, UserX, CheckCircle } from 'lucide-react';

interface Props {
  analytics?: DailyAnalyticsData;
  isLoading?: boolean;
}

export function DailyAnalyticsWidget({ analytics, isLoading }: Props) {
  const metrics = [
    {
      title: 'Scan Volume',
      value: isLoading ? '...' : `${analytics?.scanVolumeToday ?? 0} Scans`,
      subtext: `${analytics?.completionRatePercent ?? 0}% completed on schedule`,
      icon: BarChart3,
      color: 'text-[#174A70]',
      bg: 'bg-[#174A70]/10',
    },
    {
      title: 'Reporting TAT',
      value: isLoading ? '...' : `${analytics?.averageReportingTatMinutes ?? 0} min`,
      subtext:
        analytics?.averageReportingTatMinutes && analytics.averageReportingTatMinutes > 0
          ? 'Scan to signed final report'
          : 'No reports finalized today',
      icon: Clock,
      color: 'text-[#227DA5]',
      bg: 'bg-[#227DA5]/10',
    },
    {
      title: 'Delivery TAT',
      value: isLoading ? '...' : `${analytics?.averageDeliveryTatMinutes ?? 0} min`,
      subtext:
        analytics?.averageDeliveryTatMinutes && analytics.averageDeliveryTatMinutes > 0
          ? 'Final sign to front-desk delivery'
          : 'No deliveries recorded today',
      icon: CheckCircle,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      title: 'No-Shows & Cancellations',
      value: isLoading
        ? '...'
        : `${analytics?.noShowCountToday ?? 0} no-show / ${analytics?.cancelledCountToday ?? 0} cancelled`,
      subtext: 'Today unfulfilled slot capacity',
      icon: UserX,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#174A70]" />
            <CardTitle className="text-sm font-semibold text-[#152B42]">
              Daily Operational Analytics & Turnaround Benchmarks
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Telemetry timestamps</span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/70 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{m.title}</span>
                  <div className={`p-1.5 rounded-md ${m.bg} ${m.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-lg font-bold text-[#152B42] tabular-nums">{m.value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{m.subtext}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


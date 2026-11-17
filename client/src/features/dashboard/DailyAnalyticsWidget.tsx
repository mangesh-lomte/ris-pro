import { DailyAnalyticsData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart3, Clock, UserX, CheckCircle2 } from 'lucide-react';

interface Props {
  analytics?: DailyAnalyticsData;
  isLoading?: boolean;
}

export function DailyAnalyticsWidget({ analytics, isLoading }: Props) {
  const metrics = [
    {
      title: 'Scan Volume',
      value: isLoading ? '—' : `${analytics?.scanVolumeToday ?? 0}`,
      unit: 'Scans Today',
      subtext: `${analytics?.completionRatePercent ?? 0}% completed on schedule`,
      icon: BarChart3,
      color: 'text-sky-600',
      bg: 'bg-sky-50 border-sky-100',
    },
    {
      title: 'Reporting TAT',
      value: isLoading ? '—' : `${analytics?.averageReportingTatMinutes ?? 0}`,
      unit: 'Minutes Avg',
      subtext:
        analytics?.averageReportingTatMinutes && analytics.averageReportingTatMinutes > 0
          ? 'Acquisition to signed report'
          : 'No reports finalized today',
      icon: Clock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Delivery TAT',
      value: isLoading ? '—' : `${analytics?.averageDeliveryTatMinutes ?? 0}`,
      unit: 'Minutes Avg',
      subtext:
        analytics?.averageDeliveryTatMinutes && analytics.averageDeliveryTatMinutes > 0
          ? 'Final sign to front-desk delivery'
          : 'No deliveries recorded today',
      icon: CheckCircle2,
      color: 'text-emerald-700',
      bg: 'bg-emerald-100/60 border-emerald-200',
    },
    {
      title: 'No-Shows & Cancellations',
      value: isLoading
        ? '—'
        : `${(analytics?.noShowCountToday ?? 0) + (analytics?.cancelledCountToday ?? 0)}`,
      unit: `${analytics?.noShowCountToday ?? 0} no-show / ${analytics?.cancelledCountToday ?? 0} cx`,
      subtext: 'Today unfulfilled slot capacity',
      icon: UserX,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-100',
    },
  ];

  return (
    <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Operational Turnaround Benchmarks
              </CardTitle>
              <p className="text-[11px] text-slate-500 font-medium">Departmental efficiency &amp; SLA compliance</p>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-clinical-mono font-semibold">Real-time Telemetry</span>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className="p-3.5 rounded-2xl border border-[#dce6e0] bg-[#f8faf8]/70 hover:bg-white hover:shadow-card transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.title}</span>
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${m.bg} ${m.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-slate-900 font-mono">{m.value}</span>
                  <span className="text-xs font-semibold text-slate-500">{m.unit}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">{m.subtext}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

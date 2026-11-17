import { PendingTaskAlert } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { IdentifierPill } from '../../components/shared/IdentifierPill';
import { AlertCircle, ArrowRight, ShieldAlert, FileClock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  alerts?: PendingTaskAlert[];
  isLoading?: boolean;
}

export function PendingTaskAlerts({ alerts, isLoading }: Props) {
  return (
    <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Pending Tasks &amp; Operational Alerts
              </CardTitle>
              <p className="text-[11px] text-slate-500 font-medium">STAT exams, critical findings &amp; clinical blocks</p>
            </div>
          </div>
          {alerts && alerts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-800 bg-rose-100/70 px-2.5 py-0.5 rounded-full border border-rose-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {alerts.length} Action Required
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-2.5">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-slate-400 font-medium animate-pulse">Loading alerts...</div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="text-center py-5 text-xs text-slate-500 bg-[#f8faf8] rounded-2xl border border-dashed border-[#dce6e0] font-medium">
            No clinical alerts pending. All department queues are operating normally.
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-all duration-150 ${
                  isCritical
                    ? 'bg-rose-50/50 border-rose-200/70 text-rose-950 hover:bg-rose-50/80'
                    : 'bg-amber-50/50 border-amber-200/70 text-amber-950 hover:bg-amber-50/80'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    isCritical ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isCritical ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <FileClock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900">{alert.title}</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{alert.description}</p>
                    {alert.accessionNumber && (
                      <div className="mt-1.5">
                        <IdentifierPill type="accession" value={alert.accessionNumber} />
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to={alert.targetUrl}
                  className="shrink-0 text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Resolve <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

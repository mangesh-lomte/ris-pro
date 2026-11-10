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
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <CardTitle className="text-sm font-semibold text-[#152B42]">
              Pending Tasks & Clinical Alerts
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">STAT findings & workflow blocks</span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-2.5">
        {isLoading ? (
          <div className="text-center py-4 text-xs text-slate-400">Loading alerts...</div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            ✅ No urgent clinical tasks pending. All queues are current.
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border flex items-start justify-between gap-3 transition-all ${
                  isCritical
                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isCritical ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <FileClock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="text-xs font-bold">{alert.title}</h5>
                    <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">{alert.description}</p>
                    {alert.accessionNumber && (
                      <div className="mt-1.5">
                        <IdentifierPill type="accession" value={alert.accessionNumber} />
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to={alert.targetUrl}
                  className="shrink-0 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors text-slate-800"
                >
                  Resolve <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}


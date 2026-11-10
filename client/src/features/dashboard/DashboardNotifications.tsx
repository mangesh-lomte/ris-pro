import { DashboardNotificationItem } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Bell, AlertCircle, Info, Calendar, Server } from 'lucide-react';

interface Props {
  notifications?: DashboardNotificationItem[];
  isLoading?: boolean;
}

export function DashboardNotifications({ notifications, isLoading }: Props) {
  return (
    <Card className="border-slate-200/90 shadow-2xs rounded-lg bg-white">
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#174A70]" />
            <CardTitle className="text-sm font-semibold text-[#152B42]">
              Operational Notifications & System Alerts
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Critical results & feeds</span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-2">
        {isLoading ? (
          <div className="text-center py-4 text-xs text-slate-400">Loading notifications...</div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500">No active notifications</div>
        ) : (
          notifications.map((item) => {
            const isCritical = item.severity === 'CRITICAL';
            const isWarning = item.severity === 'WARNING';
            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors ${
                  isCritical
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-900'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.type === 'CRITICAL_FINDING' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  ) : item.type === 'APPOINTMENT_CHANGE' ? (
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  ) : item.type === 'SYSTEM_STATUS' ? (
                    <Server className="w-3.5 h-3.5 text-[#174A70]" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-[#227DA5]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-semibold truncate text-[#152B42]">{item.title}</h5>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono tabular-nums">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.message}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}


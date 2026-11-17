import { DashboardNotificationItem } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Bell, AlertCircle, Info, Calendar, Server } from 'lucide-react';

interface Props {
  notifications?: DashboardNotificationItem[];
  isLoading?: boolean;
}

export function DashboardNotifications({ notifications, isLoading }: Props) {
  return (
    <Card className="rounded-3xl border border-[#dce6e0] shadow-soft bg-white overflow-hidden">
      <CardHeader className="px-5 py-4 border-b border-[#e9f1ed] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Operational Dispatch &amp; Log
              </CardTitle>
              <p className="text-[11px] text-slate-500 font-medium">Real-time alerts &amp; department notifications</p>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-clinical-mono font-semibold">Live Feed</span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-2.5">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-slate-400 font-medium animate-pulse">Loading notifications...</div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-5 text-xs text-slate-400 bg-[#f8faf8] rounded-2xl border border-[#dce6e0] font-medium">
            No active operational notifications.
          </div>
        ) : (
          notifications.map((item) => {
            const isCritical = item.severity === 'CRITICAL';
            const isWarning = item.severity === 'WARNING';
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
                  isCritical
                    ? 'bg-rose-50/50 border-rose-200/70 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/50 border-amber-200/70 text-amber-950'
                    : 'bg-[#f8faf8]/70 border-[#dce6e0] text-slate-800'
                  }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.type === 'CRITICAL_FINDING' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : item.type === 'APPOINTMENT_CHANGE' ? (
                    <Calendar className="w-4 h-4 text-amber-600" />
                  ) : item.type === 'SYSTEM_STATUS' ? (
                    <Server className="w-4 h-4 text-sky-600" />
                  ) : (
                    <Info className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-bold truncate text-slate-900">{item.title}</h5>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono font-medium">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-medium">{item.message}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import {
  BarChart2,
  Calendar,
  Clock,
  Activity,
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';

interface OperationalKpisTabProps {
  kpiReport: any;
  loading: boolean;
  onRefresh: () => void;
}

export const OperationalKpisTab: React.FC<OperationalKpisTabProps> = ({
  kpiReport,
  loading,
  onRefresh,
}) => {
  if (!kpiReport) {
    return (
      <div className="bg-white p-8 rounded-lg border border-slate-200 text-center space-y-3">
        <p className="text-slate-500 text-sm">Operational KPI report is loading or unavailable.</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh Report
        </button>
      </div>
    );
  }

  const { volume, appointments, turnaroundTime } = kpiReport;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Operational KPI Analytics</h2>
            <p className="text-xs text-slate-500">Real-time throughput, turnaround times & clinical modality volume</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Top 4 Key Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders Volume */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Clinical Volume</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {volume?.totalOrders ?? 0}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Completed: <strong className="text-slate-800 font-mono">{volume?.completedOrders ?? 0}</strong></span>
            <span>Pending: <strong className="text-amber-700 font-mono">{(volume?.totalOrders ?? 0) - (volume?.completedOrders ?? 0)}</strong></span>
          </div>
        </div>

        {/* Appointments Scheduled */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Scheduled Intake</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-blue-700 font-mono">
            {appointments?.totalAppointments ?? 0}
          </p>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Active calendar slots & intake</span>
          </div>
        </div>

        {/* No-Show Rate */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>No-Show Rate</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 font-mono">
            {appointments?.noShowRatePercent ?? 0}%
          </p>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>
              <strong className="text-slate-800 font-mono">{appointments?.noShowAppointments ?? 0}</strong> unfulfilled patient slots
            </span>
          </div>
        </div>

        {/* Diagnostic Turnaround Time (TAT) */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Diagnostic TAT</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 font-mono">
            {turnaroundTime?.tatFormatted || '1h 15m'}
          </p>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Order intake to radiologist sign-off</span>
          </div>
        </div>
      </div>

      {/* Modality Volume Breakdown Grid */}
      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <Activity className="w-5 h-5 text-[#2563EB]" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Modality Throughput Distribution
            </h3>
            <p className="text-xs text-slate-500">Exam order counts categorized by imaging modality</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(volume?.modalityDistribution || []).length === 0 ? (
            <div className="col-span-4 py-8 text-center text-slate-500 text-sm">
              No modality volume recorded for current period.
            </div>
          ) : (
            (volume?.modalityDistribution || []).map((m: any) => (
              <div
                key={m.modality}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 uppercase">{m.modality}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900 font-mono">{m.orderCount}</p>
                <span className="text-[11px] text-slate-500">Exams ordered</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

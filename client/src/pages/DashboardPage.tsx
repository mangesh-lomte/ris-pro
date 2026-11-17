import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardOverview } from '../services/dashboardService';
import { TodayOverviewCards } from '../features/dashboard/TodayOverviewCards';
import { LivePatientStatusPipeline } from '../features/dashboard/LivePatientStatusPipeline';
import { ModalityScheduleMatrix } from '../features/dashboard/ModalityScheduleMatrix';
import { ModalityStatusTiles } from '../features/dashboard/ModalityStatusTiles';
import { PendingTaskAlerts } from '../features/dashboard/PendingTaskAlerts';
import { DashboardSearchBar } from '../features/dashboard/DashboardSearchBar';
import { QuickActionsBar } from '../features/dashboard/QuickActionsBar';
import { DailyAnalyticsWidget } from '../features/dashboard/DailyAnalyticsWidget';
import { DashboardNotifications } from '../features/dashboard/DashboardNotifications';
import { RoleBasedDashboardView } from '../features/dashboard/RoleBasedDashboardView';
import { RoleBadge } from '../components/shared/RoleBadge';
import { ShieldCheck, Stethoscope, RefreshCw, AlertTriangle, Bell } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardOverview,
    refetchInterval: 30000,
  });

  const currentDateString = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto pb-10">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dce6e0]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Department Operations Overview
            </h1>
            {user && <RoleBadge role={user.role} />}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            {user ? `${user.firstName} ${user.lastName}` : 'Clinician'} ·{' '}
            <span className="font-semibold text-slate-800">{currentDateString}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#dashboard-notifications"
            className="flex items-center gap-1.5 rounded-full border border-[#dce6e0] bg-white hover:bg-[#f8faf8] px-3.5 py-1.5 text-xs text-slate-700 font-bold transition-colors cursor-pointer shadow-soft"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-600" />
            <span>Alerts &amp; Dispatch ({data?.notifications?.length ?? 0})</span>
          </a>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-full border border-[#dce6e0] bg-white hover:bg-[#f8faf8] px-3.5 py-1.5 text-xs text-slate-800 font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-soft"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#dce6e0] bg-[#f8faf8] px-3 py-1.5 text-xs text-slate-600 font-bold">
            <Stethoscope className="w-3.5 h-3.5 text-slate-500" />
            Diagnostic Suite
          </span>
          <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/70 px-3 py-1.5 text-xs text-emerald-800 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Operational
          </span>
        </div>
      </div>

      {/* ── Role-based context ───────────────────────────── */}
      <RoleBasedDashboardView
        userRole={user?.role}
        userName={user ? `${user.firstName} ${user.lastName}` : ''}
      />

      {isError ? (
        <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-6 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-7 w-7 text-[#DC2626]" />
          <h2 className="mt-2 text-sm font-semibold text-rose-900">Unable to load dashboard data.</h2>
          <p className="mt-1 text-xs text-rose-700">The dashboard service did not return current operational data.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 inline-flex items-center gap-1.5 rounded bg-[#DC2626] px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── KPI strip ───────────────────────────────────── */}
          <TodayOverviewCards
            data={data?.todayOverview}
            criticalTasksCount={data?.pendingTaskAlerts?.length ?? 0}
            userRole={user?.role}
            isLoading={isLoading}
          />

          {/* ── Search + Quick actions ───────────────────────── */}
          <div className="space-y-3">
            <DashboardSearchBar />
            <QuickActionsBar userRole={user?.role} />
          </div>

          {/* ── Schedule matrix + Modality tiles ────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <ModalityScheduleMatrix
                activePatients={data?.livePatientStatus?.activePatients}
                isLoading={isLoading}
                userRole={user?.role}
              />
            </div>
            <div className="lg:col-span-4">
              <ModalityStatusTiles tiles={data?.modalityTiles} isLoading={isLoading} />
            </div>
          </div>

          {/* ── Pending tasks & alerts ───────────────────────── */}
          <PendingTaskAlerts alerts={data?.pendingTaskAlerts} isLoading={isLoading} />

          {/* ── Live patient pipeline ────────────────────────── */}
          <LivePatientStatusPipeline data={data?.livePatientStatus} isLoading={isLoading} />

          {/* ── Analytics + Notifications ───────────────────── */}
          <div id="dashboard-notifications" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-6">
            <DailyAnalyticsWidget analytics={data?.dailyAnalytics} isLoading={isLoading} />
            <DashboardNotifications notifications={data?.notifications} isLoading={isLoading} />
          </div>
        </>
      )}
    </div>
  );
}

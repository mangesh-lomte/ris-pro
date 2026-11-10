import { useState } from 'react';
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
import { PatientAppointmentPortalModal } from '../features/patientPortal/PatientAppointmentPortalModal';
import { RoleBadge } from '../components/shared/RoleBadge';
import { ShieldCheck, Stethoscope, RefreshCw, Smartphone, AlertTriangle } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const [patientPortalOpen, setPatientPortalOpen] = useState(false);

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
    <div className="space-y-6 sm:space-y-8 max-w-[1500px] mx-auto pb-12">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#DCE2EC]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#15233B]">
              Department Overview
            </h1>
            {user && <RoleBadge role={user.role} />}
          </div>
          <p className="mt-1 text-sm text-[#64748B]">
            {user ? `${user.firstName} ${user.lastName}` : 'Clinician'} ·{' '}
            <span className="font-semibold text-[#15233B]">{currentDateString}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setPatientPortalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[#33398A]/30 bg-[#33398A]/5 hover:bg-[#33398A]/10 px-3 py-2 text-xs text-[#33398A] font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <Smartphone className="w-4 h-4" />
            Patient Portal
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg border border-[#DCE2EC] bg-white hover:bg-[#F3F6FC] px-3 py-2 text-xs text-[#15233B] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#33398A] ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#DCE2EC] bg-[#F3F6FC] px-3 py-2 text-xs text-[#64748B] font-medium">
            <Stethoscope className="w-3.5 h-3.5 text-[#33398A]" />
            Diagnostic Radiology
          </span>
          <span className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-[#15966A] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
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
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center shadow-2xs">
          <AlertTriangle className="mx-auto h-8 w-8 text-[#D92D4C]" />
          <h2 className="mt-2 text-base font-bold text-rose-900">Unable to load dashboard data.</h2>
          <p className="mt-1 text-xs text-rose-700">The dashboard service did not return current operational data.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#D92D4C] px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
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
            <QuickActionsBar userRole={user?.role} onOpenPatientPortal={() => setPatientPortalOpen(true)} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyAnalyticsWidget analytics={data?.dailyAnalytics} isLoading={isLoading} />
            <DashboardNotifications notifications={data?.notifications} isLoading={isLoading} />
          </div>
        </>
      )}

      <PatientAppointmentPortalModal
        open={patientPortalOpen}
        onOpenChange={setPatientPortalOpen}
      />
    </div>
  );
}

import { useAuth } from '../hooks/useAuth';
import { StatsOverview } from '../features/dashboard/StatsOverview';
import { WorkflowVisualizer } from '../features/dashboard/WorkflowVisualizer';
import { DomainRuleDemo } from '../features/dashboard/DomainRuleDemo';
import { RoleBadge } from '../components/shared/RoleBadge';
import { ShieldCheck, Stethoscope } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome header banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.firstName} {user?.lastName}
            </h1>
            {user && <RoleBadge role={user.role} />}
          </div>
          <p className="text-xs text-slate-500">
            Radiology Information System (RIS) — Phase 1 Domain Foundation & Core Architecture
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <Stethoscope className="w-4 h-4 text-cyan-600" />
            <span className="font-medium">Department: Diagnostic Radiology</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Session: Encrypted</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <StatsOverview />

      {/* Domain Rule Demo (Patient ID & Accession persistence) */}
      <DomainRuleDemo />

      {/* End-to-end Workflow Visualizer */}
      <WorkflowVisualizer />
    </div>
  );
}

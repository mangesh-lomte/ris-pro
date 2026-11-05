import { Outlet } from 'react-router-dom';
import { Activity, ShieldCheck, HeartPulse } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle background clinical gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 mb-4">
          <Activity className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Radiology Information System
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Enterprise Healthcare Workflow & Orchestration Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Outlet />
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 z-10 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          HIPAA & Title 21 CFR Compliant Foundation
        </span>
        <span className="flex items-center gap-1">
          <HeartPulse className="w-3.5 h-3.5 text-cyan-400" />
          DICOM / HL7 Ready
        </span>
      </div>
    </div>
  );
}

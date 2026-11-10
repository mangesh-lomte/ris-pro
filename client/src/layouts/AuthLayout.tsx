import { Outlet } from 'react-router-dom';
import { ShieldCheck, HeartPulse } from 'lucide-react';
import { RadAxisLogo } from '../components/shared/RadAxisLogo';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#172554] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(51,57,138,0.6) 0%, transparent 75%)' }}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 flex flex-col items-center">
        <RadAxisLogo variant="light" size="lg" className="mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
          RadAxis Radiology Information System
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Enterprise clinical workflow &amp; PACS orchestration
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <Outlet />
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400 z-10 flex flex-wrap items-center justify-center gap-6">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Audit &amp; Electronic Signature Controls
        </span>
        <span className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-[#F4B629]" />
          DICOM / HL7 Ready
        </span>
      </footer>
    </div>
  );
}

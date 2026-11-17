import { Outlet } from 'react-router-dom';
import { ShieldCheck, HeartPulse, Activity, Lock } from 'lucide-react';
import { RadAxisLogo } from '../components/shared/RadAxisLogo';
import { EcgBackground } from '../components/shared/EcgBackground';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#e9f1ed] text-slate-800 flex flex-col justify-center py-6 sm:py-8 sm:px-6 lg:px-8 relative selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* Dynamic Medical ECG Heartbeat & Grid Background */}
      <EcgBackground />

      {/* Header / Brand Area */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 flex flex-col items-center px-4">
        {/* Live Clinical Telemetry Chip */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#dce6e0] shadow-2xs backdrop-blur-md text-[11px] font-semibold text-slate-700 mb-3 animate-in fade-in duration-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="font-mono text-emerald-800 font-bold">72 BPM</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-medium">Lead II Telemetry</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-semibold">PACS Ready</span>
        </div>

        {/* Brand Logo */}
        <RadAxisLogo variant="dark" size="lg" showDescriptor className="mb-1.5" />

        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
          RadAxis Radiology Information System
        </h1>
        <p className="text-[11px] text-slate-500 font-medium">
          Enterprise clinical imaging &amp; diagnostic workflow platform
        </p>
      </div>

      {/* Main Card View */}
      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <Outlet />
      </div>

      {/* Clinical Verification Footer Badges */}
      <footer className="mt-5 text-center z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-[#dce6e0] shadow-2xs text-[11px] font-semibold text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Audit &amp; Cryptographic Signatures</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-[#dce6e0] shadow-2xs text-[11px] font-semibold text-slate-600">
          <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
          <span>DICOMweb &amp; HL7 Integrated</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-[#dce6e0] shadow-2xs text-[11px] font-semibold text-slate-600">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>256-Bit TLS</span>
        </div>
      </footer>
    </div>
  );
}

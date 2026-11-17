import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/shared/Header';
import { Sidebar } from '../components/shared/Sidebar';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <div className="h-screen h-dvh w-full flex p-3 md:p-4 lg:p-5 gap-4 lg:gap-5 overflow-hidden clinical-grid-bg text-slate-800 antialiased relative">
      {/* Ambient subtle light depth orbs */}
      <div className="absolute -top-32 left-1/3 w-[650px] h-[350px] bg-white/40 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-24 right-1/4 w-[500px] h-[350px] bg-emerald-100/35 blur-3xl pointer-events-none rounded-full" />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-full focus:shadow-md focus:outline-none font-bold text-xs"
      >
        Skip to main content
      </a>

      {/* Floating Left Navigation Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main View Area: Floating Header & Scrollable Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full gap-4 overflow-hidden">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden outline-none custom-scroll flex flex-col justify-between"
        >
          <div>
            <Outlet />
          </div>

          {/* Application Footer (Clean & Rounded) */}
          <footer className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#dce6e0] px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0 select-none shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-800">RadAxis RIS Clinical Workstation</span>
              <span className="text-slate-300">•</span>
              <span>RadAxis Healthcare System</span>
              <span className="text-slate-300">•</span>
              <span className="font-clinical-mono text-[11px] text-slate-400">ris-node-01.local</span>
            </div>
            <div className="flex items-center gap-3 font-semibold text-emerald-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live PACS &amp; HL7 Sync
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-clinical-mono text-[11px] text-slate-400">v2.4.1 PROD</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default AppLayout;

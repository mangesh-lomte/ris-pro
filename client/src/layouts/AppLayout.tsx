import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/shared/Header';
import { Sidebar } from '../components/shared/Sidebar';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#F7F8FB] text-[#15233B]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#33398A] focus:text-white focus:rounded-md focus:shadow-xl focus:outline-none font-semibold text-xs"
      >
        Skip to main content
      </a>

      {/* Full-Height Left-Docked Dark Navy Sidebar (Desktop fixed, Mobile drawer) */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main View Area: Header on top, Scrollable Content below */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export default AppLayout;

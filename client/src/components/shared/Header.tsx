import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../../services/healthService';
import { RoleBadge } from './RoleBadge';
import { Button } from '../ui/button';
import { UserRole } from '../../types';
import { LogOut, ChevronDown, UserCheck, ShieldCheck, Building2, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RadAxisLogo } from './RadAxisLogo';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout, quickLoginAsRole } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const { data: health, isSuccess, isError } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: fetchHealth,
    refetchInterval: 20000,
  });

  const availableRoles: { role: UserRole; title: string; desc: string }[] = [
    { role: 'ADMIN',        title: 'Administrator',           desc: 'System management, users, audit logs' },
    { role: 'RECEPTION',    title: 'Reception / Front Desk',  desc: 'Patient registration, booking, check-in' },
    { role: 'TECHNOLOGIST', title: 'Radiologic Technologist', desc: 'Modality worklists, acquisition, safety' },
    { role: 'RADIOLOGIST',  title: 'Attending Radiologist',   desc: 'Interpretation, dictation, signing' },
  ];

  const handleRoleSwitch = async (role: UserRole) => {
    setRoleMenuOpen(false);
    await quickLoginAsRole(role);
  };

  const healthStatus =
    isSuccess && health?.status === 'healthy' ? 'operational' :
    isError ? 'offline' : 'checking';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-[#DCE2EC] bg-white px-4 sm:px-6 shadow-xs">
      {/* Left side: Mobile menu toggle + Mobile brand / Desktop facility context */}
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A]"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile brand (shown only on mobile when sidebar is hidden) */}
        <div className="md:hidden">
          <Link to="/dashboard" className="flex items-center focus-visible:outline-none">
            <RadAxisLogo variant="dark" size="sm" showDescriptor={false} />
          </Link>
        </div>

        {/* Desktop facility context (shown on desktop, no duplicate sidebar logo) */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#15233B]">
          <span className="flex h-2 w-2 rounded-full bg-[#33398A]" />
          <span className="font-semibold text-slate-700">RadAxis Enterprise RIS</span>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-500">Clinical Workflow Suite</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Facility */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border border-[#DCE2EC] bg-[#F3F6FC] px-3 py-1.5 text-xs text-[#15233B]">
          <Building2 className="w-3.5 h-3.5 text-[#33398A]" />
          <span className="font-semibold">RadAxis Main Campus</span>
        </div>

        {/* System health */}
        <Link
          to="/health"
          className="hidden sm:flex items-center gap-2 rounded-lg border border-[#DCE2EC] bg-[#F3F6FC] px-3 py-1.5 text-xs hover:bg-[#E8EDF9] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A]"
          title="View system diagnostics"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              healthStatus === 'operational' ? 'bg-[#15966A]' :
              healthStatus === 'offline'     ? 'bg-[#D92D4C]' :
                                               'bg-[#D97706]'
            }`}
          />
          <span className="font-medium text-[#15233B]">
            {healthStatus === 'operational' ? 'Operational' :
             healthStatus === 'offline'     ? 'Offline' : 'Checking…'}
          </span>
        </Link>

        {/* User / Role switcher */}
        {user && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                aria-haspopup="true"
                aria-expanded={roleMenuOpen}
                aria-label={`${user.firstName} ${user.lastName} — ${user.role}. Click to switch role.`}
                className="flex items-center gap-2.5 rounded-lg border border-[#DCE2EC] bg-white px-2.5 py-1.5 hover:bg-[#F3F6FC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#33398A] shadow-xs cursor-pointer"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EDF9] text-[#33398A] font-bold text-xs ring-1 ring-[#33398A]/20">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div className="hidden sm:block leading-none text-left">
                  <p className="text-xs font-semibold text-[#15233B]">{user.firstName} {user.lastName}</p>
                </div>
                <RoleBadge role={user.role} />
                <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="text-[#64748B] hover:text-[#D92D4C] hover:bg-rose-50 h-8 w-8 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {roleMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-80 rounded-xl border border-[#DCE2EC] bg-white shadow-dropdown z-50 animate-in"
                onMouseLeave={() => setRoleMenuOpen(false)}
              >
                <div className="px-4 py-3 border-b border-[#F3F6FC]">
                  <p className="text-xs font-bold text-[#15233B]">Demo Role Switcher</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Evaluate perspective-specific workflows
                  </p>
                </div>

                <div className="p-2 space-y-1">
                  {availableRoles.map((r) => (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => handleRoleSwitch(r.role)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer ${
                        user.role === r.role
                          ? 'bg-[#E8EDF9] border border-[#33398A]/30 text-[#33398A]'
                          : 'hover:bg-[#F3F6FC] text-[#15233B]'
                      }`}
                    >
                      <RoleBadge role={r.role} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#15233B] flex items-center justify-between">
                          {r.title}
                          {user.role === r.role && <UserCheck className="h-4 w-4 text-[#33398A]" />}
                        </p>
                        <p className="text-[11px] text-[#64748B] leading-tight mt-0.5 truncate">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="border-t border-[#F3F6FC] px-4 py-2.5 flex items-center justify-between text-[11px] text-[#64748B] bg-[#F7F8FB] rounded-b-xl">
                  <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-[#33398A]" />RadAxis Main Campus</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#15966A]" />RBAC Active</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
export default Header;

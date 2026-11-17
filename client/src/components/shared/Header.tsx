import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../../services/healthService';
import { fetchDashboardOverview } from '../../services/dashboardService';
import { RoleBadge } from './RoleBadge';
import { UserRole } from '../../types';
import { LogOut, ChevronDown, Menu, Bell, AlertCircle, Info, Calendar, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout, quickLoginAsRole } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRoleMenuOpen(false);
        setNotificationsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { data: health, isSuccess, isError } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: fetchHealth,
    refetchInterval: 20000,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardOverview,
    refetchInterval: 30000,
  });

  const notifications = dashboardData?.notifications || [];
  const unreadCount = notifications.length;

  const availableRoles: { role: UserRole; title: string; desc: string }[] = [
    { role: 'ADMIN',        title: 'Administrator',           desc: 'System governance, user provisioning & audits' },
    { role: 'RECEPTION',    title: 'Reception / Front Desk',  desc: 'Registration, slot booking, check-in queue' },
    { role: 'TECHNOLOGIST', title: 'Radiologic Technologist', desc: 'Acquisition worklist, safety check, QA handoff' },
    { role: 'RADIOLOGIST',  title: 'Attending Radiologist',   desc: 'Interpretation, voice dictation & report signing' },
  ];

  const handleRoleSwitch = async (role: UserRole) => {
    setRoleMenuOpen(false);
    await quickLoginAsRole(role);
  };

  const healthStatus =
    isSuccess && health?.status === 'healthy' ? 'operational' :
    isError ? 'offline' : 'checking';

  return (
    <header className="relative z-40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/85 backdrop-blur-md p-3 sm:p-4 lg:px-6 rounded-3xl border border-[#dce6e0] shadow-soft shrink-0">
      {/* Left side: Mobile menu toggle + Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7f5] text-slate-700 hover:text-slate-900 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <img
          src="/radaxis-symbol.png"
          alt="RadAxis"
          className="w-8 h-8 md:hidden object-contain drop-shadow-xs"
        />

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              RADAXIS <span className="text-slate-400 font-semibold text-sm">RIS</span>
            </h1>
            <div className="hidden sm:flex items-center gap-2 pl-2.5 border-l border-slate-200">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60">
                Diagnostic Radiology
              </span>
              <span className="text-xs text-slate-400 font-medium hidden lg:inline">Main Campus Suite</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right controls: System Health + Notifications + Role Switcher */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* System Health Pill */}
        <Link
          to="/health"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f7f5] hover:bg-[#edf2ee] text-xs transition border border-slate-200/60"
          title="System Telemetry"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              healthStatus === 'operational' ? 'bg-emerald-500 animate-pulse' :
              healthStatus === 'offline'     ? 'bg-rose-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-[11px] font-semibold text-slate-600">
            {healthStatus === 'operational' ? 'PACS Live' : 'Checking'}
          </span>
        </Link>

        {/* Notifications Popover */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="View notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f7f5] hover:bg-[#edf2ee] text-slate-700 transition border border-slate-200/60 shadow-2xs cursor-pointer"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Window */}
          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white p-4 shadow-dropdown border border-[#dce6e0] z-50 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Clinical Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                      {unreadCount} active
                    </span>
                  )}
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                >
                  View Feed
                </Link>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scroll">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No active operational alerts.</p>
                ) : (
                  notifications.map((item) => {
                    const isCritical = item.severity === 'CRITICAL';
                    const isWarning = item.severity === 'WARNING';
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-2xl border flex items-start gap-2.5 text-xs transition ${
                          isCritical
                            ? 'bg-rose-50/60 border-rose-200/70 text-rose-950'
                            : isWarning
                            ? 'bg-amber-50/60 border-amber-200/70 text-amber-950'
                            : 'bg-[#f8faf8] border-[#dce6e0] text-slate-800'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.type === 'CRITICAL_FINDING' ? (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          ) : item.type === 'APPOINTMENT_CHANGE' ? (
                            <Calendar className="w-4 h-4 text-amber-600" />
                          ) : item.type === 'SYSTEM_STATUS' ? (
                            <Server className="w-4 h-4 text-sky-600" />
                          ) : (
                            <Info className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <h5 className="font-bold text-xs truncate text-slate-900">{item.title}</h5>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{item.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile & Role switcher dropdown */}
        {user && (
          <div ref={roleRef} className="relative">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                aria-haspopup="true"
                aria-expanded={roleMenuOpen}
                aria-label={`${user.firstName} ${user.lastName} — ${user.role}. Click to switch role.`}
                className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-2.5 py-1 hover:bg-[#f4f7f5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 shadow-2xs cursor-pointer"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-[10px]">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div className="hidden sm:block leading-none text-left">
                  <p className="text-xs font-bold text-slate-900">{user.firstName} {user.lastName}</p>
                </div>
                <RoleBadge role={user.role} />
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {/* Dropdown Menu */}
            {roleMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-72 rounded-3xl bg-white p-2.5 shadow-dropdown border border-[#dce6e0] z-50 animate-in fade-in zoom-in-95"
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">Switch Clinical Persona</p>
                  <p className="text-[10px] text-slate-500">1-click test role permissions</p>
                </div>
                <div className="py-1 space-y-1">
                  {availableRoles.map((r) => {
                    const isActive = user.role === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        role="menuitem"
                        onClick={() => handleRoleSwitch(r.role)}
                        className={`w-full text-left px-3 py-2 rounded-2xl text-xs transition flex items-center justify-between ${isActive
                          ? 'bg-slate-900 text-white font-bold'
                          : 'hover:bg-[#f4f7f5] text-slate-700'
                          }`}
                      >
                        <div>
                          <p className="font-bold">{r.title}</p>
                          <p className={`text-[10px] ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                            {r.desc}
                          </p>
                        </div>
                        {isActive && (
                          <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
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

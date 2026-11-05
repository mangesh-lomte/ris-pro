import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../../services/healthService';
import { RoleBadge } from './RoleBadge';
import { Button } from '../ui/button';
import { UserRole } from '../../types';
import {
  Activity,
  LogOut,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  const { user, logout, quickLoginAsRole } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // Poll system health every 20 seconds
  const { data: health, isSuccess, isError } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: fetchHealth,
    refetchInterval: 20000,
  });

  const availableRoles: { role: UserRole; title: string; desc: string }[] = [
    { role: 'ADMIN', title: 'Administrator', desc: 'System management, users, and audit logs' },
    { role: 'RECEPTION', title: 'Reception / Front Desk', desc: 'Patient registration, booking, and check-in' },
    { role: 'TECHNOLOGIST', title: 'Radiologic Technologist', desc: 'Modality worklists, acquisition, safety checks' },
    { role: 'RADIOLOGIST', title: 'Attending Radiologist', desc: 'Study interpretation, dictation, and signing' },
  ];

  const handleRoleSwitch = async (role: UserRole) => {
    setRoleMenuOpen(false);
    await quickLoginAsRole(role);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-xs">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight text-base">RadNexus RIS</span>
            <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 border border-cyan-200">
              PHASE 1
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Healthcare Radiology Information System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live System Diagnostics Pill */}
        <Link
          to="/health"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs hover:bg-slate-100 transition-colors"
          title="Click to view live API & Database Diagnostics"
        >
          <span className="relative flex h-2 w-2">
            {isSuccess && health?.status === 'healthy' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : isError ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </span>
          <span className="font-medium text-slate-700">
            {isSuccess && health?.status === 'healthy'
              ? `API: Healthy (${health.database.responseTimeMs}ms)`
              : isError
              ? 'API: Offline'
              : 'API: Connecting...'}
          </span>
        </Link>

        {/* User Role Switcher & Profile */}
        {user && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 pr-2.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-900 leading-none">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{user.email}</p>
                </div>
                <RoleBadge role={user.role} className="ml-1" />
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Sign out"
                className="text-slate-500 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Role Switcher Dropdown */}
            {roleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setRoleMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Demo Role Switcher
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Switch role to evaluate perspective-specific workflows
                  </p>
                </div>

                <div className="space-y-1">
                  {availableRoles.map((r) => (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => handleRoleSwitch(r.role)}
                      className={`flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors ${
                        user.role === r.role
                          ? 'bg-cyan-50 border border-cyan-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        <RoleBadge role={r.role} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                          {r.title}
                          {user.role === r.role && (
                            <UserCheck className="h-3.5 w-3.5 text-cyan-600" />
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                          {r.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 px-3 py-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Springfield General Hospital
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    RBAC Active
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { UserRole } from '../../types';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Activity,
  Calendar,
  Layers,
  FileText,
  CreditCard,
  Package,
  Ticket,
  Stethoscope,
  Wrench,
  Share2,
  Shield,
  X,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  allowedRoles?: UserRole[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user } = useAuth();
  const userRole = user?.role;

  const navItems: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Patient Ops',
      items: [
        { to: '/patients',     label: 'Patient Index',     icon: Users },
        { to: '/orders',       label: 'Imaging Orders',    icon: FileSpreadsheet },
        { to: '/appointments', label: 'Scheduling',        icon: Calendar, allowedRoles: ['RECEPTION', 'ADMIN'] },
        { to: '/reception',    label: 'Reception & Queue', icon: Ticket,   allowedRoles: ['RECEPTION', 'ADMIN'] },
      ],
    },
    {
      title: 'Clinical Workflows',
      items: [
        { to: '/technologist',         label: 'Technologist Worklist', icon: Layers,      allowedRoles: ['TECHNOLOGIST', 'ADMIN'] },
        { to: '/radiologist/worklist',  label: 'Radiologist Worklist',  icon: Stethoscope, allowedRoles: ['RADIOLOGIST', 'ADMIN'] },
        { to: '/reporting',            label: 'Diagnostic Reporting',  icon: FileText,    allowedRoles: ['RADIOLOGIST', 'ADMIN'] },
        { to: '/external-shares',      label: 'DICOM Sharing',         icon: Share2,      allowedRoles: ['ADMIN', 'RADIOLOGIST', 'RECEPTION', 'TECHNOLOGIST'] },
      ],
    },
    {
      title: 'Business & Facilities',
      items: [
        { to: '/billing',     label: 'Billing & Accounts',     icon: CreditCard, allowedRoles: ['RECEPTION', 'ADMIN'] },
        { to: '/inventory',   label: 'Inventory & Contrast',   icon: Package,    allowedRoles: ['TECHNOLOGIST', 'ADMIN', 'RECEPTION'] },
        { to: '/maintenance', label: 'Equipment & Maintenance', icon: Wrench,     allowedRoles: ['TECHNOLOGIST', 'ADMIN', 'RECEPTION'] },
      ],
    },
    {
      title: 'System & Security',
      items: [
        { to: '/admin',  label: 'Administration', icon: Shield,   allowedRoles: ['ADMIN'] },
        { to: '/health', label: 'System Health',  icon: Activity },
      ],
    },
  ];

  const filteredNavGroups = navItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.allowedRoles) return true;
        if (!userRole) return false;
        return item.allowedRoles.includes(userRole);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const renderSidebar = (isMobile: boolean) => (
    <div className="flex flex-col h-full w-full bg-[#172554] text-white select-none">
      {/* ── 1. RadAxis Brand Header (Fixed at top inside navy sidebar) ── */}
      <div className="shrink-0 h-16 flex items-center justify-between px-4 border-b border-white/10 bg-[#172554]">
        <NavLink
          to="/dashboard"
          onClick={isMobile ? onCloseMobile : undefined}
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg group"
        >
          {/* Approved RadAxis Symbol */}
          <div className="relative flex items-center justify-center shrink-0 w-9 h-9 rounded-lg bg-[#0b1329] ring-1 ring-white/15 shadow-sm overflow-hidden group-hover:ring-sky-400/40 transition-all">
            <img
              src="/radaxis-symbol.png"
              alt="RadAxis Emblem"
              className="w-full h-full object-contain p-0.5"
            />
          </div>

          {/* Wordmark */}
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Rad<span className="text-[#38BDF8]">Axis</span>
              </span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                RIS
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wider uppercase text-slate-400 mt-0.5">
              Enterprise RIS
            </span>
          </div>
        </NavLink>

        {/* Mobile close button only in mobile drawer */}
        {isMobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── 2. Scrollable Navigation (Visually hidden scrollbar) ── */}
      <nav
        aria-label="Primary navigation"
        className="sidebar-navigation flex-1 min-h-0 overflow-y-auto py-3 px-3 space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {filteredNavGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={isMobile ? onCloseMobile : undefined}
                    className={({ isActive }) =>
                      [
                        'group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-[13px] font-medium transition-all select-none min-h-[40px]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                        isActive
                          ? 'bg-[#E8EDF9] text-[#33398A] font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-[#33398A]' : 'text-slate-400 group-hover:text-white'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                              isActive
                                ? 'bg-[#33398A]/15 text-[#33398A]'
                                : 'bg-white/15 text-slate-200'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── 3. Fixed Enterprise System Status Footer (Compact Status Only) ── */}
      <div className="shrink-0 border-t border-white/10 bg-[#0F172A]/60 px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-slate-400">
            RadAxis RIS v2.4
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-300 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#15966A] animate-pulse" />
            PACS Online
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left-Docked Full-Height Sidebar (256px / w-64) */}
      <aside
        aria-label="Application navigation"
        className="hidden md:flex w-64 shrink-0 bg-[#172554] border-r border-[#0F172A] h-screen sticky top-0 z-30"
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile Drawer (When open) */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Slide-over drawer */}
          <div className="relative flex w-72 max-w-[85vw] flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebar(true)}
          </div>
        </div>
      )}
    </>
  );
}

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { UserRole } from '../../types';
import { RadAxisLogo } from './RadAxisLogo';
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
  badgeClass?: string;
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
        { to: '/patients', label: 'Patient Index', icon: Users },
        { to: '/orders', label: 'Imaging Orders', icon: FileSpreadsheet },
        { to: '/appointments', label: 'Scheduling', icon: Calendar, allowedRoles: ['RECEPTION', 'ADMIN'] },
        { to: '/reception', label: 'Reception & Queue', icon: Ticket, badge: 'Active', badgeClass: 'bg-emerald-100 text-emerald-800', allowedRoles: ['RECEPTION', 'ADMIN'] },
      ],
    },
    {
      title: 'Clinical Workflows',
      items: [
        { to: '/technologist', label: 'Technologist Worklist', icon: Layers, allowedRoles: ['TECHNOLOGIST', 'ADMIN'] },
        { to: '/radiologist/worklist', label: 'Radiologist Worklist', icon: Stethoscope, badge: 'STAT', badgeClass: 'bg-rose-500 text-white', allowedRoles: ['RADIOLOGIST', 'ADMIN'] },
        { to: '/reporting', label: 'Diagnostic Reporting', icon: FileText, allowedRoles: ['RADIOLOGIST', 'ADMIN'] },
        { to: '/external-shares', label: 'DICOM Sharing', icon: Share2, allowedRoles: ['ADMIN', 'RADIOLOGIST', 'RECEPTION', 'TECHNOLOGIST'] },
      ],
    },
    {
      title: 'Business & Facilities',
      items: [
        { to: '/billing', label: 'Billing & Accounts', icon: CreditCard, allowedRoles: ['RECEPTION', 'ADMIN'] },
        { to: '/inventory', label: 'Inventory & Contrast', icon: Package, allowedRoles: ['TECHNOLOGIST', 'ADMIN', 'RECEPTION'] },
        { to: '/maintenance', label: 'Equipment & Maintenance', icon: Wrench, allowedRoles: ['TECHNOLOGIST', 'ADMIN', 'RECEPTION'] },
      ],
    },
    {
      title: 'System & Security',
      items: [
        { to: '/admin', label: 'Administration', icon: Shield, allowedRoles: ['ADMIN'] },
        { to: '/health', label: 'System Health', icon: Activity },
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

  const renderNav = (isMobile: boolean) => (
    <div className="flex flex-col h-full select-none min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Brand / Logo Area */}
        <div className="flex items-center justify-between px-1 mb-6 shrink-0">
          <NavLink
            to="/dashboard"
            onClick={isMobile ? onCloseMobile : undefined}
            className="flex items-center focus-visible:outline-none"
          >
            <RadAxisLogo size="lg" showDescriptor />
          </NavLink>

          {isMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-5 text-sm font-semibold overflow-y-auto flex-1 custom-sidebar-scroll pr-1">
          {filteredNavGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={isMobile ? onCloseMobile : undefined}
                      className={({ isActive }) =>
                        `group flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-150 ${
                          isActive
                            ? 'bg-[#0d172a] text-white shadow-[0_4px_12px_rgba(15,23,42,0.10)] border border-[#0d172a] font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-[#eaf5ee] border border-transparent font-semibold'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3">
                            <Icon
                              className={`w-4 h-4 transition-colors shrink-0 ${
                                isActive
                                  ? 'text-[#45d6a8]'
                                  : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                            />
                            <span className={isActive ? 'text-white' : ''}>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? item.badge === 'STAT'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-emerald-400/20 text-[#45d6a8] border border-emerald-400/30'
                                  : item.badgeClass || 'bg-slate-900 text-white'
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
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Floating Sidebar */}
      <aside
        className="w-64 bg-[#f4f8f5]/85 backdrop-blur-md rounded-3xl p-5 flex flex-col shrink-0 select-none border border-[#dce6e0] shadow-soft justify-between hidden md:flex h-full"
        aria-label="Clinical Navigation"
      >
        {renderNav(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#f4f8f5] p-5 shadow-2xl flex flex-col justify-between overflow-y-auto z-10 rounded-r-3xl border-r border-[#dce6e0]">
            {renderNav(true)}
          </aside>
        </div>
      )}
    </>
  );
}
export default Sidebar;

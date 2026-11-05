import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  Users,
  FileSpreadsheet,
  Activity,
  Calendar,
  Layers,
  FileText,
  CreditCard,
  History,
  Info,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const navItems: NavGroup[] = [
    {
      title: 'Phase 1 Active Modules',
      items: [
        {
          to: '/dashboard',
          label: 'Executive Dashboard',
          icon: LayoutDashboard,
          description: 'Domain & workflow overview',
        },
        {
          to: '/workflow',
          label: 'RIS Workflow Visualizer',
          icon: GitFork,
          description: 'Patient ID & Accession path',
        },
        {
          to: '/patients',
          label: 'Patient Master Index',
          icon: Users,
          description: 'Persistent Patient IDs (MRN)',
        },
        {
          to: '/orders',
          label: 'Imaging Orders Registry',
          icon: FileSpreadsheet,
          description: 'Accession Number tracing',
        },
        {
          to: '/health',
          label: 'System & Database Health',
          icon: Activity,
          description: 'Live PostgreSQL connection',
        },
      ],
    },
    {
      title: 'Phase 2+ Workflow Pipeline',
      items: [
        {
          to: '/appointments',
          label: 'Scheduling & Arrival',
          icon: Calendar,
          badge: 'Phase 2',
        },
        {
          to: '/worklist',
          label: 'Technologist Console (MWL)',
          icon: Layers,
          badge: 'Phase 2',
        },
        {
          to: '/reporting',
          label: 'Radiologist Dictation',
          icon: FileText,
          badge: 'Phase 3',
        },
        {
          to: '/billing',
          label: 'Billing & Payments',
          icon: CreditCard,
          badge: 'Phase 4',
        },
        {
          to: '/audit-trail',
          label: 'System Audit Trail',
          icon: History,
          badge: 'Admin',
        },
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6 overflow-y-auto">
        {navItems.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1.5">
            <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {group.title}
            </h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-50 text-cyan-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-normal">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Domain Rule Callout in footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-2 rounded-xl">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-600 leading-snug">
            <p className="font-semibold text-slate-900">Critical Domain Rule:</p>
            <p className="mt-0.5 text-slate-500">
              Patient ID & Accession Number remain constant throughout all downstream stages.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

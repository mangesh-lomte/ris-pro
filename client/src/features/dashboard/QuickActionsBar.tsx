import { UserPlus, CalendarPlus, CreditCard, Layers, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '../../types';

interface Props {
  userRole?: UserRole;
}

export function QuickActionsBar({ userRole }: Props) {
  // Select appropriate worklist destination according to user role
  const worklistDestination =
    userRole === 'RADIOLOGIST'
      ? '/radiologist/worklist'
      : userRole === 'TECHNOLOGIST'
        ? '/technologist/worklist'
        : '/reception';

  // Role-customized action buttons
  let actions: Array<{
    label: string;
    description: string;
    icon: any;
    to: string;
    isPrimary: boolean;
  }>;

  if (userRole === 'TECHNOLOGIST') {
    actions = [
      {
        label: 'Open Worklist',
        description: 'Scan acquisition queue',
        icon: Layers,
        to: '/technologist/worklist',
        isPrimary: true,
      },
      {
        label: 'Imaging Orders',
        description: 'Review assigned exams',
        icon: FileText,
        to: '/orders',
        isPrimary: false,
      },
      {
        label: 'Patient Registry',
        description: 'Demographics & safety',
        icon: UserPlus,
        to: '/patients',
        isPrimary: false,
      },
      {
        label: 'Inventory & Lots',
        description: 'Contrast & consumables',
        icon: CreditCard,
        to: '/inventory',
        isPrimary: false,
      },
    ];
  } else if (userRole === 'RADIOLOGIST') {
    actions = [
      {
        label: 'Reading Worklist',
        description: 'Diagnostic interpretation queue',
        icon: Layers,
        to: '/radiologist/worklist',
        isPrimary: true,
      },
      {
        label: 'Diagnostic Reporting',
        description: 'Authoring & digital sign',
        icon: FileText,
        to: '/reporting',
        isPrimary: false,
      },
      {
        label: 'Imaging Orders',
        description: 'Review study protocols',
        icon: FileText,
        to: '/orders',
        isPrimary: false,
      },
      {
        label: 'Patient Registry',
        description: 'Demographics & history',
        icon: UserPlus,
        to: '/patients',
        isPrimary: false,
      },
    ];
  } else {
    // Admin & Reception
    actions = [
      {
        label: 'New Patient',
        description: 'Register patient with unique MRN',
        icon: UserPlus,
        to: '/patients',
        isPrimary: true,
      },
      {
        label: 'Book Scan',
        description: 'Schedule modality appointment',
        icon: CalendarPlus,
        to: '/appointments',
        isPrimary: false,
      },
      {
        label: 'Billing & POS',
        description: 'Accept deposit or scan invoice',
        icon: CreditCard,
        to: '/billing',
        isPrimary: false,
      },
      {
        label: 'Open Queue',
        description: userRole === 'RECEPTION' ? 'Front desk check-in queue' : 'Operational clinical queue',
        icon: Layers,
        to: worklistDestination,
        isPrimary: false,
      },
    ];
  }

  return (
    <div className="bg-white p-5 rounded-3xl border border-[#dce6e0] shadow-soft">
      <div className="mb-3.5">
        <div className="text-xs font-bold text-slate-900 tracking-tight">
          Fast Clinical Actions
        </div>
        <p className="text-[11px] text-slate-500 font-medium">Frequent shortcuts for {userRole || 'operational'} workflows</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.label}
              to={act.to}
              className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3 group ${act.isPrimary
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-soft'
                : 'bg-[#f8faf8]/80 hover:bg-white border border-[#dce6e0] hover:border-emerald-300 hover:shadow-card text-slate-800'
                }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${act.isPrimary
                  ? 'bg-white/10 text-emerald-400'
                  : 'bg-white text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 border border-slate-100'
                  }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className={`font-bold text-xs truncate ${act.isPrimary ? 'text-white' : 'text-slate-900'}`}>
                  {act.label}
                </div>
                <div
                  className={`text-[11px] line-clamp-1 font-medium mt-0.5 ${act.isPrimary ? 'text-slate-400' : 'text-slate-500'
                    }`}
                >
                  {act.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

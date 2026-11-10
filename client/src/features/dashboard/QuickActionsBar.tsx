import { UserPlus, CalendarPlus, CreditCard, Layers, Smartphone, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '../../types';

interface Props {
  userRole?: UserRole;
  onOpenPatientPortal?: () => void;
}

export function QuickActionsBar({ userRole, onOpenPatientPortal }: Props) {
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
        description: 'Technologist scan acquisition queue',
        icon: Layers,
        to: '/technologist/worklist',
        isPrimary: true,
      },
      {
        label: 'Imaging Orders',
        description: 'Review assigned examination orders',
        icon: FileText,
        to: '/orders',
        isPrimary: false,
      },
      {
        label: 'Patient Registry',
        description: 'View patient clinical records',
        icon: UserPlus,
        to: '/patients',
        isPrimary: false,
      },
      {
        label: 'Inventory & Contrast',
        description: 'Contrast lots & consumables',
        icon: CreditCard,
        to: '/inventory',
        isPrimary: false,
      },
    ];
  } else if (userRole === 'RADIOLOGIST') {
    actions = [
      {
        label: 'Open Worklist',
        description: 'Diagnostic reporting worklist',
        icon: Layers,
        to: '/radiologist/worklist',
        isPrimary: true,
      },
      {
        label: 'Reporting',
        description: 'Diagnostic report authoring queue',
        icon: FileText,
        to: '/reporting',
        isPrimary: false,
      },
      {
        label: 'Imaging Orders',
        description: 'Review patient imaging orders',
        icon: FileText,
        to: '/orders',
        isPrimary: false,
      },
      {
        label: 'Patient Registry',
        description: 'Master patient demographic index',
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
        label: 'Collect Payment',
        description: 'Accept deposit or scan billing',
        icon: CreditCard,
        to: '/billing',
        isPrimary: false,
      },
      {
        label: 'Open Worklist',
        description: userRole === 'RECEPTION' ? 'Front desk queue & check-in' : 'Operational clinical queue',
        icon: Layers,
        to: worklistDestination,
        isPrimary: false,
      },
    ];
  }

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-slate-200/90 shadow-2xs">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Quick Actions & Clinical Launchpad
        </div>
        {onOpenPatientPortal && (
          <button
            onClick={onOpenPatientPortal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#227DA5]"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#174A70]" />
            <span>Online Patient Portal</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.label}
              to={act.to}
              className={`p-2.5 sm:p-3 rounded-lg transition-all flex items-center gap-2.5 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#227DA5] ${
                act.isPrimary
                  ? 'bg-[#174A70] hover:bg-[#123855] text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-[#152B42] shadow-2xs'
              }`}
            >
              <div
                className={`p-2 rounded-md shrink-0 transition-colors ${
                  act.isPrimary
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-[#174A70]/10 group-hover:text-[#174A70]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className={`font-semibold text-xs truncate ${act.isPrimary ? 'text-white' : 'text-[#152B42]'}`}>
                  {act.label}
                </div>
                <div
                  className={`text-[10px] line-clamp-1 ${
                    act.isPrimary ? 'text-white/80' : 'text-slate-500'
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

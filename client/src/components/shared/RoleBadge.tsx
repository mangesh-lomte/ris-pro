import { UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { ShieldCheck, UserCog, Stethoscope, Sliders } from 'lucide-react';

const roleConfig: Record<UserRole, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  ADMIN:        { label: 'Admin',        icon: ShieldCheck,  cls: 'bg-[#E8EDF9] text-[#33398A] border-[#33398A]/30' },
  RECEPTION:    { label: 'Reception',    icon: UserCog,      cls: 'bg-blue-50 text-[#2563B8] border-blue-200' },
  TECHNOLOGIST: { label: 'Technologist', icon: Sliders,      cls: 'bg-emerald-50 text-[#15966A] border-emerald-200' },
  RADIOLOGIST:  { label: 'Radiologist',  icon: Stethoscope,  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const { label, icon: Icon, cls } = roleConfig[role] ?? roleConfig['ADMIN'];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold leading-none select-none',
        cls,
        className
      )}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
